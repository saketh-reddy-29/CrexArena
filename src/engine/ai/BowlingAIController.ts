import { Player } from '../../types/common';
import { PitchType, WeatherCondition } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';
import { BowlingPlanEngine, DetailedBowlingPlan } from './BowlingPlanEngine';
import {
  BowlerFieldStrategyEngine,
  FieldConfiguration,
  CANONICAL_POSITIONS,
} from '../strategy/BowlerFieldStrategyEngine';
import { getFieldingPhase, validateField } from '../fielding/FieldingRestrictionEngine';
import { recommendFieldPreset, selectStrategicSetup, type ScoringZoneName } from './AdaptiveCaptainEngine';

// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS BOWLING AI — the bowling team's captain.
//
// Given the live match situation this controller independently chooses the next
// bowler, an intelligent bowling plan and a *legal* field formation, then emits
// a short user-facing notification describing any field change.
//
// Every field it produces is validated against the authoritative fielding
// restrictions (FieldingRestrictionEngine) before being returned, so the AI can
// never field an illegal formation. The selection is deterministic unless a
// random source is injected, which keeps the behaviour unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export type BowlingChangeTrigger =
  | 'OVER_END'
  | 'INITIAL'
  | 'WICKET_FALL'
  | 'BOUNDARY_CLUSTER'
  | 'MANUAL_REQUEST';

export interface BowlingAIInput {
  format: ArenaFormat;
  /** 1-indexed over about to be bowled. */
  over: number;
  /** Legal balls bowled so far in the innings. */
  balls: number;
  wickets: number;
  runs: number;
  target?: number;
  recentBalls?: string[];
  fieldingSquad: Player[];
  bowlerStats: Record<string, { balls: number; runs: number; wickets: number }>;
  previousOverBowlerId?: string | null;
  currentBowler?: Player | null;
  striker?: Player | null;
  nonStriker?: Player | null;
  /** Balls the striker has faced (drives the new-batter attacking override). */
  strikerBalls?: number;
  pitch: PitchType;
  weather?: WeatherCondition;
  /** 0-100 fatigue per player id (higher = more tired). */
  fatigue?: Record<string, number>;
  /** Optional pre-computed eligible pool from the caller. */
  eligibleBowlerIds?: string[];
  previousFieldPresetKey?: string | null;
  /** The currently deployed field — enables the strict per-update movement budget. */
  previousFieldConfiguration?: FieldConfiguration | null;
  trigger: BowlingChangeTrigger;
  /** Recent boundary arcs punished by the striker (Section 12-A). */
  recentBoundaryZones?: ScoringZoneName[];
  /** Shortlist of zones (wagon arcs) the AI should prioritise covering. */
  hotZones?: ScoringZoneName[];
  /** Total overs of the (possibly reduced) innings — rescales phase windows. */
  totalOvers?: number;
  /** Competition season — used for season-keyed rules (e.g. IPL). */
  season?: number;
  /** Injectable RNG (0..1) for deterministic tests. Omit for deterministic picks. */
  random?: () => number;
}

export interface BowlingAIDecision {
  bowlerId: string | null;
  bowlerName: string | null;
  bowlingPlan: DetailedBowlingPlan | null;
  fieldPresetKey: string;
  fieldConfiguration: FieldConfiguration | null;
  fieldValid: boolean;
  fieldMessage: string;
  fieldChanged: boolean;
  /** The single coordinated game-plan chosen for this delivery. */
  strategicSetup: string;
  fieldReason: string;
  changeBowler: boolean;
  notification: string | null;
  reasoning: string;
  confidence: number;
}

/** Mapping from BowlingPlanEngine preset recommendations to real PRESET_OVERLAYS keys. */
export const PLAN_PRESET_TO_FIELD_KEY: Record<string, string> = {
  SPIN_WEB: 'SPIN_TRAP_WEB',
  MIDDLE_SQUEEZE: 'BALANCED_RING',
  ATTACKING_PACE: 'ATTACKING_SLIP_CORDON',
  DEATH_YORKER_SHIELD: 'DEATH_YORKER_SHIELD',
  SHORT_BALL_TRAP: 'SHORT_BALL_AMBUSH',
  SHORT_BALL_AMBUSH: 'SHORT_BALL_AMBUSH',
  BALANCED_RING: 'BALANCED_RING',
  ATTACKING_SLIP_CORDON: 'ATTACKING_SLIP_CORDON',
  SPIN_TRAP_WEB: 'SPIN_TRAP_WEB',
};

function maxBowlerBalls(format: ArenaFormat): number {
  const overs = format === 'TEST' ? 999 : format === 'ODI' ? 10 : 4;
  return overs * 6;
}

export function isSpinBowler(bowler: Player): boolean {
  const style = (bowler.bowlingStyle || '').toLowerCase();
  if (style.includes('spin') || style.includes('leg') || style.includes('off') || style.includes('slow')) {
    return true;
  }
  const known = ['rashid', 'chahal', 'kuldeep', 'varun', 'narine', 'ashwin', 'jadeja', 'bishnoi', 'zampa', 'hasaranga'];
  return known.some((t) => bowler.name.toLowerCase().includes(t));
}

/** Number of outfielders a preset places outside the 30-yard circle. */
export function presetOutsideCount(presetKey: string): number {
  const preset = BowlerFieldStrategyEngine.PRESET_OVERLAYS[presetKey];
  if (!preset) return 0;
  return preset.keys.filter((k) => CANONICAL_POSITIONS[k]?.isOutsideCircle).length;
}

/**
 * Chooses a field preset that is guaranteed legal for the format + over. The
 * preferred preset wins when legal; otherwise the most aggressive legal preset
 * (i.e. the one that keeps the most fielders on the boundary) is used.
 */
export function chooseLegalFieldPresetKey(
  preferredKey: string | null | undefined,
  format: ArenaFormat,
  over: number,
  totalOvers?: number,
): string {
  const phase = getFieldingPhase(format, over, undefined, totalOvers);
  const max = phase.restricted ? phase.maxOutsideCircle : Number.POSITIVE_INFINITY;

  const validKeys = Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS);

  const mapped = preferredKey ? PLAN_PRESET_TO_FIELD_KEY[preferredKey] ?? preferredKey : null;
  if (mapped && validKeys.includes(mapped) && presetOutsideCount(mapped) <= max) {
    return mapped;
  }

  const ranked = validKeys
    .filter((k) => presetOutsideCount(k) <= max)
    .sort((a, b) => presetOutsideCount(b) - presetOutsideCount(a));

  return ranked[0] ?? 'ATTACKING_SLIP_CORDON';
}

/**
 * Boundary-prevention field pick (Section 12-A): among the presets that are
 * legal for the current phase, choose the one that best protects the striker's
 * scoring arcs. When `biasSweepers` is set (used right after a boundary cluster)
 * the score is nudged toward formations that keep more fielders on the rope.
 * Returns the fallback preset when no striker is known.
 */
export function chooseBatterAdaptivePresetKey(
  input: BowlingAIInput,
  fallback: string,
  biasSweepers: boolean,
): string {
  const striker = input.striker;
  if (!striker) return fallback;

  const phase = getFieldingPhase(input.format, input.over, undefined, input.totalOvers);
  const max = phase.restricted ? phase.maxOutsideCircle : Number.POSITIVE_INFINITY;
  const legalKeys = Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS).filter(
    (k) => presetOutsideCount(k) <= max,
  );
  if (legalKeys.length === 0) return fallback;

  let bestKey = fallback;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const key of legalKeys) {
    const rec = recommendFieldPreset({
      format: input.format,
      striker,
      overs: Math.floor(input.balls / 6),
      recentBoundaryZones: input.recentBoundaryZones,
      legalPresets: [key],
    });
    const score = rec.score + (biasSweepers ? presetOutsideCount(key) * 0.2 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}

/** Eligible bowling candidates honouring quota, consecutive-over and role rules. */
export function getEligibleBowlers(input: BowlingAIInput): Player[] {
  const quota = maxBowlerBalls(input.format);
  return input.fieldingSquad.filter((p) => {
    if (input.eligibleBowlerIds && !input.eligibleBowlerIds.includes(p.id)) return false;
    if (input.previousOverBowlerId && p.id === input.previousOverBowlerId) return false;

    const balls = input.bowlerStats[p.id]?.balls || 0;
    if (balls >= quota) return false;

    const bowling = p.stats?.bowling ?? 0;
    if (p.role === 'Batsman' && bowling < 40) return false;
    if (p.role === 'Wicketkeeper' && bowling < 35) return false;
    return true;
  });
}

function bowlerPhaseScore(p: Player, input: BowlingAIInput): number {
  let score = p.stats?.bowling ?? p.rating ?? 70;
  const balls = input.bowlerStats[p.id]?.balls ?? 0;
  const overs = balls / 6;
  const phase = getFieldingPhase(input.format, input.over, undefined, input.totalOvers).key;
  const spinner = isSpinBowler(p);

  if (phase === 'POWERPLAY') {
    score += spinner ? -10 : 12;
    score -= overs * 4;
  } else if (phase === 'DEATH') {
    score += spinner ? -15 : 8;
    score -= overs * 1.5;
  } else {
    score += spinner ? 14 : 0;
    score -= overs * 4;
  }
  score += ((p.form ?? 50) - 50) * 0.2;
  const fat = input.fatigue?.[p.id];
  if (typeof fat === 'number') score -= fat * 0.15;
  return score;
}

/** Selects the AI captain's bowler for a new over. */
export function selectAIBowler(input: BowlingAIInput): Player | null {
  const pool = getEligibleBowlers(input);
  const candidates = pool.length > 0 ? pool : input.fieldingSquad.filter((p) => p.id !== input.previousOverBowlerId);
  if (candidates.length === 0) return null;

  const rng = input.random;
  const jitter = () => (rng ? (rng() - 0.5) * 6 : 0);
  const ranked = [...candidates].sort(
    (a, b) => bowlerPhaseScore(b, input) + jitter() - (bowlerPhaseScore(a, input) + jitter()),
  );
  return ranked[0] ?? null;
}

function buildFieldConfiguration(
  input: BowlingAIInput,
  bowler: Player | null,
  presetKey: string,
): FieldConfiguration | null {
  if (input.fieldingSquad.length < 2) return null;
  const overs = Math.floor(input.balls / 6);
  try {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: input.format,
      bowler,
      striker: input.striker || null,
      nonStriker: input.nonStriker || null,
      overs,
      balls: input.balls,
      wickets: input.wickets,
      runs: input.runs,
      target: input.target,
      pitch: input.pitch,
      weather: input.weather ?? WeatherCondition.SUNNY,
      fieldingSquad: input.fieldingSquad,
      manualPresetKey: presetKey,
      previousConfig: input.previousFieldConfiguration ?? null,
      hotZones: input.hotZones,
      totalOvers: input.totalOvers,
      season: input.season,
    });
    // Authoritative legality gate — the AI never returns an illegal field.
    const validation = validateField({
      format: input.format,
      over: input.over,
      fielders: config.fielders.map((f) => ({
        id: f.id,
        name: f.name,
        role: f.role,
        x: f.targetPos.x,
        y: f.targetPos.y,
        isOutsideCircle: f.isOutsideCircle,
      })),
      options: { enforcePlayerCount: false },
      totalOvers: input.totalOvers,
      season: input.season,
    });
    if (!validation.valid) return null;
    return config;
  } catch {
    return null;
  }
}

function describeFieldChange(config: FieldConfiguration | null, presetKey: string, setup?: string): string {
  const presetName = BowlerFieldStrategyEngine.PRESET_OVERLAYS[presetKey]?.name ?? 'New field';
  const intentText = config?.tacticalIntent ? ` — ${config.tacticalIntent.toLowerCase()}` : '';
  const setupText = setup ? ` (${setup} setup)` : '';
  return `Field adjusted: ${presetName}${intentText}${setupText}.`;
}

/**
 * Full autonomous bowling decision for a given trigger. For over changes it
 * selects a fresh bowler (never the previous over's bowler). For wicket/boundary
 * triggers it keeps the current bowler but re-plans the field to apply pressure.
 */
export function decideBowlingChange(input: BowlingAIInput): BowlingAIDecision {
  const isOverChange = input.trigger === 'OVER_END' || input.trigger === 'INITIAL' || input.trigger === 'MANUAL_REQUEST';

  const current = input.currentBowler ?? null;
  let bowler: Player | null = current;
  if (isOverChange || !current) {
    bowler = selectAIBowler(input);
  }

  const plan = bowler
    ? BowlingPlanEngine.selectBowlingPlan(bowler, input.striker || input.fieldingSquad[0] || bowler, {
        format: input.format,
        overs: Math.floor(input.balls / 6),
        balls: input.balls,
        wickets: input.wickets,
        target: input.target,
        pitch: input.pitch,
        strikerBalls: 0,
        strikerRuns: 0,
      })
    : null;

  // The single coordinated game-plan: format + phase + batter resolve to one
  // of Attacking / Containment / Death, realised with a legal preset formation.
  const setupDecision = selectStrategicSetup({
    format: input.format,
    over: input.over,
    wickets: input.wickets,
    requiredRate: input.target ? (input.target - input.runs) / Math.max(1, (maxBowlerBalls(input.format) - input.balls) / 6) : undefined,
    striker: input.striker ?? null,
    strikerBalls: input.strikerBalls,
    recentOutcomes: input.recentBalls,
    trigger: input.trigger,
    bowlerIsSpin: bowler ? isSpinBowler(bowler) : undefined,
  });
  let presetKey = chooseLegalFieldPresetKey(setupDecision.presetKey, input.format, input.over, input.totalOvers);

  // Boundary-prevention refinement (Section 12-A): when the batter has just
  // hurt us or a new batter is in, look at *their* scoring zones and move the
  // field there instead of relying on the phase plan alone.
  if (input.trigger === 'BOUNDARY_CLUSTER' || input.trigger === 'WICKET_FALL') {
    const adaptiveKey = chooseBatterAdaptivePresetKey(
      input,
      presetKey,
      input.trigger === 'BOUNDARY_CLUSTER',
    );
    presetKey = chooseLegalFieldPresetKey(adaptiveKey, input.format, input.over, input.totalOvers);
  }

  const fieldConfiguration = buildFieldConfiguration(input, bowler, presetKey);
  const fieldValid = Boolean(fieldConfiguration);
  const fieldChanged = Boolean(presetKey && presetKey !== input.previousFieldPresetKey);

  const validation = fieldConfiguration
    ? validateField({
        format: input.format,
        over: input.over,
        fielders: fieldConfiguration.fielders.map((f) => ({
          id: f.id,
          role: f.role,
          x: f.targetPos.x,
          y: f.targetPos.y,
          isOutsideCircle: f.isOutsideCircle,
        })),
        options: { enforcePlayerCount: false },
        totalOvers: input.totalOvers,
        season: input.season,
      })
    : null;

  const notification = fieldChanged ? describeFieldChange(fieldConfiguration, presetKey, setupDecision.setup) : null;

  return {
    bowlerId: bowler?.id ?? null,
    bowlerName: bowler?.name ?? null,
    bowlingPlan: plan,
    fieldPresetKey: presetKey,
    fieldConfiguration,
    fieldValid,
    fieldMessage: validation?.message ?? 'Field not generated.',
    fieldChanged,
    strategicSetup: setupDecision.setup,
    fieldReason: setupDecision.reason,
    changeBowler: isOverChange || !current,
    notification,
    reasoning: bowler
      ? `${bowler.name} to bowl over ${input.over}${isSpinBowler(bowler) ? ' (spin)' : ' (pace)'} — ${setupDecision.setup} setup: ${setupDecision.reason}${
          plan ? ` ${plan.summary}` : ''
        }`
      : 'No eligible bowler available.',
    confidence: isOverChange ? 80 : 72,
  };
}
