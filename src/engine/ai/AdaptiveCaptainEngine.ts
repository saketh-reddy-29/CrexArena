import { Player } from '../../types/common';
import { ArenaFormat } from '../models/ArenaState';
import {
  BowlerFieldStrategyEngine,
  CANONICAL_POSITIONS,
  FieldConfiguration,
  FielderAssignment,
} from '../strategy/BowlerFieldStrategyEngine';
import { getFieldingPhase, type FieldingPhaseKey } from '../fielding/FieldingRestrictionEngine';
import { BatterScoringMemory } from '../analytics/BatterScoringMemory';

// ═══════════════════════════════════════════════════════════════════════════════
//  ADAPTIVE AI CAPTAIN — Boundary Prevention, Realistic Wicket Strategy &
//  Reversible Pressure Modelling
//
//  This engine is the single, deterministic source of *tactical delivery
//  context*. It converts a field layout + batter profile + recent match events
//  into bounded, symmetric multipliers that the authoritative delivery model
//  (`MatchEngine.simulateBall`) applies to its run distribution and single
//  wicket roll.
//
//  Design guarantees (Section 12 of the spec):
//    • No forced wickets. Wicket opportunity is a small, bounded factor whose
//      range is centred on 1.0 — it can never guarantee a dismissal and can
//      never guarantee survival.
//    • No hidden bowling bonuses keyed to balls-since-wicket. Nothing here
//      reads "balls since last wicket"; that modifier lives (and stays neutral)
//      in the engine.
//    • Symmetric field influence: a field that covers a batter's scoring zones
//      reduces boundaries; an open field increases them.
//    • Reversible pressure: pressure is derived only from genuine match events
//      and decays the moment those events are relieved.
//    • Format scaling: Test fields matter more, T20 fields matter less.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Canonical 360° wagon-wheel zones (ground coords, right-hander frame) ──
export interface WagonZone {
  zone: ScoringZoneName;
  angleRange: [number, number];
}

export type ScoringZoneName =
  | 'THIRD_MAN_GULLY'
  | 'POINT_SQUARE'
  | 'COVER'
  | 'LONG_OFF'
  | 'LONG_ON'
  | 'MID_WICKET_COW'
  | 'SQUARE_LEG'
  | 'FINE_LEG';

export const WAGON_ZONES: WagonZone[] = [
  { zone: 'THIRD_MAN_GULLY', angleRange: [-150, -110] },
  { zone: 'POINT_SQUARE', angleRange: [-110, -70] },
  { zone: 'COVER', angleRange: [-70, -25] },
  { zone: 'LONG_OFF', angleRange: [-25, 0] },
  { zone: 'LONG_ON', angleRange: [0, 25] },
  { zone: 'MID_WICKET_COW', angleRange: [25, 70] },
  { zone: 'SQUARE_LEG', angleRange: [70, 110] },
  { zone: 'FINE_LEG', angleRange: [110, 150] },
];

export interface ZoneCoverage {
  zone: ScoringZoneName;
  angleRange: [number, number];
  deepCovered: boolean; // a boundary-category fielder patrols this arc
  ringCovered: boolean; // an inner-ring fielder patrols this arc
  catcherCovered: boolean; // a close-catching fielder sits in this arc
}

export type BatterArchetype = 'anchor' | 'finisher' | 'accumulator' | 'attacker' | 'tail';

// Multipliers the authoritative delivery model consumes. All are centred on
// 1.0 and strictly bounded — they shape probabilities, they never dictate them.
export interface TacticalDeliveryModel {
  /** Applied to the four/six weights. <1 suppresses boundaries, >1 opens them. */
  boundarySuppression: number;
  /** Applied to the single weight. <1 chokes rotation, >1 eases it. */
  rotationSuppression: number;
  /** Applied to the single wicket roll. Small, bounded, centred on 1.0. */
  wicketOpportunity: number;
  /** Diagnostic 0-1 contextual pressure from genuine events (reversible). */
  pressureScore: number;
  /** Source field preset (for the visualiser / lifecycle animation). */
  fieldPresetKey: string | null;
  /** Coordinated line/length this delivery is being bowled to. */
  line: string;
  length: string;
  variation: string;
  /** Per-zone coverage used to derive the multipliers. */
  coverage: ZoneCoverage[];
  /** Human-readable explanation of the single coordinated decision. */
  explanation: string;
}

export interface DeliveryModelInput {
  format: ArenaFormat | string;
  field: FieldConfiguration | null;
  fieldPresetKey?: string | null;
  bowler: Player | null;
  striker: Player | null;
  overs: number;
  wickets: number;
  requiredRate?: number;
  recentOutcomes?: string[];
  line?: string;
  length?: string;
  variation?: string;
  /** Optional explicitly-tracked recent boundary arcs (batch simulation). */
  recentBoundaryZones?: ScoringZoneName[];
}

export interface FieldPresetRecommendation {
  presetKey: string;
  reason: string;
  score: number;
}

// Format-scaled amplitudes. Fields matter more in the longer formats where
// batters score more conventionally; T20 is more about raw power.
const FORMAT_AMPLITUDE: Record<string, { boundary: number; rotation: number; wicket: number; pressure: number }> = {
  T20: { boundary: 0.14, rotation: 0.10, wicket: 0.05, pressure: 1.0 },
  IPL: { boundary: 0.14, rotation: 0.10, wicket: 0.05, pressure: 1.0 },
  ODI: { boundary: 0.17, rotation: 0.12, wicket: 0.07, pressure: 0.8 },
  TEST: { boundary: 0.20, rotation: 0.13, wicket: 0.09, pressure: 0.5 },
};

// Preference weight = how much a batter likes to score *boundaries* in a zone.
// Values are relative and get normalised at runtime.
const ARCHETYPE_ZONE_WEIGHTS: Record<BatterArchetype, Record<ScoringZoneName, number>> = {
  finisher: {
    THIRD_MAN_GULLY: 0.25, POINT_SQUARE: 0.4, COVER: 0.6, LONG_OFF: 0.8,
    LONG_ON: 1.0, MID_WICKET_COW: 1.4, SQUARE_LEG: 1.0, FINE_LEG: 0.7,
  },
  attacker: {
    THIRD_MAN_GULLY: 0.5, POINT_SQUARE: 0.8, COVER: 1.0, LONG_OFF: 1.1,
    LONG_ON: 1.1, MID_WICKET_COW: 1.1, SQUARE_LEG: 0.8, FINE_LEG: 0.6,
  },
  anchor: {
    THIRD_MAN_GULLY: 0.7, POINT_SQUARE: 0.9, COVER: 1.1, LONG_OFF: 1.0,
    LONG_ON: 0.8, MID_WICKET_COW: 0.8, SQUARE_LEG: 0.6, FINE_LEG: 0.5,
  },
  accumulator: {
    THIRD_MAN_GULLY: 0.6, POINT_SQUARE: 1.0, COVER: 1.0, LONG_OFF: 0.9,
    LONG_ON: 0.8, MID_WICKET_COW: 0.9, SQUARE_LEG: 0.7, FINE_LEG: 0.6,
  },
  tail: {
    THIRD_MAN_GULLY: 1.2, POINT_SQUARE: 0.9, COVER: 0.6, LONG_OFF: 0.6,
    LONG_ON: 0.5, MID_WICKET_COW: 0.6, SQUARE_LEG: 0.7, FINE_LEG: 1.0,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatAmplitude(format: ArenaFormat | string) {
  return FORMAT_AMPLITUDE[String(format).toUpperCase()] || FORMAT_AMPLITUDE.T20;
}

export function isLeftHandedBatter(batter: Player | null): boolean {
  if (!batter) return false;
  const hand = (batter as any).battingHand || (batter as any).hand;
  if (hand) return String(hand).toLowerCase().includes('left');
  const knownLefties = [
    'rishabh pant', 'shivam dube', 'quinton de kock', 'yashasvi jaiswal',
    'ravindra jadeja', 'david warner', 'travis head', 'abhishek sharma',
    'nicholas pooran', 'shikhar dhawan', 'rinku singh', 'devdutt padikkal',
    'ben stokes', 'rachin ravindra', 'tilak varma', 'axar patel',
  ];
  return knownLefties.some((name) => batter.name.toLowerCase().includes(name));
}

export function classifyBatterArchetype(batter: Player | null): BatterArchetype {
  if (!batter) return 'accumulator';
  const name = batter.name.toLowerCase();
  const aggression = batter.aggression ?? (batter.role === 'Bowler' ? 35 : 72);
  const temperament = batter.temperament ?? (batter.role === 'Bowler' ? 35 : 76);
  const batting = batter.stats?.batting || 0;

  if (batting < 45 && (batter.role === 'Bowler' || (batter.role === 'All-rounder' && batting < 35))) return 'tail';
  if (['kohli', 'williamson', 'rahul', 'gill', 'rahane', 'sudharsan', 'gaikwad', 'shreyas', 'jaiswal'].some((t) => name.includes(t))) return 'anchor';
  if (['russell', 'pooran', 'hetmyer', 'klaasen', 'tim david', 'stoinis', 'livingstone', 'stubbs', 'rinku', 'buttler', 'pant'].some((t) => name.includes(t))) return 'finisher';
  if (temperament >= 86 && aggression <= 78) return 'anchor';
  if (aggression >= 90 && batting >= 70) return 'finisher';
  if (temperament >= 80 && aggression < 85) return 'accumulator';
  return 'attacker';
}

/** Angle of a ground point as seen from the batter crease, in the batter's own frame. */
export function zoneAngleDeg(x: number, y: number, isLeftHanded: boolean): number {
  const dx = x - 300;
  const dy = y - 410;
  let deg = Math.atan2(dx, -dy) * (180 / Math.PI);
  if (isLeftHanded) deg = -deg;
  return deg;
}

export function classifyZone(deg: number): ScoringZoneName {
  for (const z of WAGON_ZONES) {
    if (deg >= z.angleRange[0] && deg <= z.angleRange[1]) return z.zone;
  }
  // Wrap the seam (±180 is the same arc as Fine Leg / Third Man).
  return deg > 150 || deg < -150 ? 'THIRD_MAN_GULLY' : 'FINE_LEG';
}

function fielderCategory(f: FielderAssignment): 'CATCHING' | 'RING' | 'BOUNDARY' {
  const canonical = CANONICAL_POSITIONS[f.positionKey];
  if (canonical) return canonical.category;
  if (f.isOutsideCircle) return 'BOUNDARY';
  if (f.isCatching) return 'CATCHING';
  return 'RING';
}

/**
 * Maps an explicit field layout onto the 8 wagon-wheel zones, reporting which
 * arcs carry a deep sweeper, an inner-ring fielder and a close catcher.
 */
export function analyzeFieldCoverage(
  field: FieldConfiguration | null,
  isLeftHanded: boolean
): ZoneCoverage[] {
  const coverage: ZoneCoverage[] = WAGON_ZONES.map((z) => ({
    zone: z.zone,
    angleRange: z.angleRange,
    deepCovered: false,
    ringCovered: false,
    catcherCovered: false,
  }));
  if (!field) return coverage;

  for (const f of field.fielders) {
    // The keeper is a permanent close catcher behind the stumps.
    if (f.positionKey === 'WICKETKEEPER') {
      const zone = coverage.find((c) => c.zone === classifyZone(zoneAngleDeg(f.targetPos.x, f.targetPos.y, isLeftHanded)));
      if (zone) zone.catcherCovered = true;
      continue;
    }
    const deg = zoneAngleDeg(f.targetPos.x, f.targetPos.y, isLeftHanded);
    const zone = coverage.find((c) => c.zone === classifyZone(deg));
    if (!zone) continue;
    const cat = fielderCategory(f);
    if (cat === 'BOUNDARY') zone.deepCovered = true;
    else if (cat === 'CATCHING') zone.catcherCovered = true;
    else zone.ringCovered = true;
  }
  return coverage;
}

/** Deterministic, normalised boundary-scoring preference per zone for a batter. */
export function getBatterZonePreference(batter: Player | null, format?: ArenaFormat | string): Record<ScoringZoneName, number> {
  const archetype = classifyBatterArchetype(batter);
  const base = { ...ARCHETYPE_ZONE_WEIGHTS[archetype] };

  // If batter has genuine historical scoring zone records, blend them in
  if (batter?.id) {
    const profile = BatterScoringMemory.getBatterProfile(batter.id, {
      format: (format && format !== 'ALL' ? format : 'ALL') as any,
    });
    if (profile && profile.totalBalls >= 8 && profile.totalBoundaries > 0) {
      // Map 16 canonical zones into 8 broad wagon zones
      const histWeights: Record<ScoringZoneName, number> = {
        THIRD_MAN_GULLY: (profile.zones.FINE_THIRD_MAN.boundaryCount + profile.zones.THIRD_MAN.boundaryCount),
        POINT_SQUARE: (profile.zones.DEEP_BACKWARD_POINT.boundaryCount + profile.zones.POINT.boundaryCount),
        COVER: (profile.zones.COVER_POINT.boundaryCount + profile.zones.COVER.boundaryCount + profile.zones.EXTRA_COVER.boundaryCount),
        LONG_OFF: (profile.zones.LONG_OFF.boundaryCount + profile.zones.STRAIGHT_OFF.boundaryCount),
        LONG_ON: (profile.zones.STRAIGHT_ON.boundaryCount + profile.zones.LONG_ON.boundaryCount),
        MID_WICKET_COW: (profile.zones.MID_WICKET.boundaryCount + profile.zones.COW_CORNER.boundaryCount),
        SQUARE_LEG: (profile.zones.SQUARE_LEG.boundaryCount + profile.zones.BACKWARD_SQUARE_LEG.boundaryCount),
        FINE_LEG: (profile.zones.FINE_LEG.boundaryCount),
      };
      const totalHist = Object.values(histWeights).reduce((a, b) => a + b, 0);
      if (totalHist > 0) {
        // Blend: 50% archetype prior + 50% actual historical observations
        for (const z of WAGON_ZONES) {
          base[z.zone] = 0.5 * base[z.zone] + 0.5 * (histWeights[z.zone] / totalHist) * 8;
        }
      }
    }
  }

  const total = WAGON_ZONES.reduce((sum, z) => sum + base[z.zone], 0) || 1;
  const normalised = {} as Record<ScoringZoneName, number>;
  for (const z of WAGON_ZONES) normalised[z.zone] = base[z.zone] / total;
  return normalised;
}

/**
 * Reversible contextual pressure (0-1) built ONLY from genuine match events.
 * The moment the events are relieved (runs scored, partnerships rebuilt), the
 * score falls back — it is never sticky.
 */
export function computePressureScore(input: {
  format: ArenaFormat | string;
  overs: number;
  wickets: number;
  requiredRate?: number;
  consecutiveDots?: number;
  recentOutcomes?: string[];
}): number {
  const format = String(input.format).toUpperCase();
  const overs = input.overs || 0;
  const isDeath = format === 'TEST' ? false : format === 'ODI' ? overs >= 40 : overs >= 16;
  const isMiddle = format === 'TEST' ? false : format === 'ODI' ? overs >= 10 && overs < 40 : overs >= 6 && overs < 16;

  const recent = input.recentOutcomes || [];
  const last6 = recent.slice(-6);
  const dots6 = last6.filter((o) => o === '0' || o === 'W').length;
  const boundaries6 = last6.filter((o) => o === '4' || o === '6').length;
  const wickets6 = last6.filter((o) => o === 'W').length;

  const rrr = input.requiredRate ?? 0;
  const parRate = isDeath ? 10.5 : isMiddle ? 8.5 : 9.2;
  const rrrPressure = rrr > 0 ? clamp((rrr - parRate) / 8, -0.18, 0.5) : 0;

  const dotPressure = clamp((input.consecutiveDots || 0) * 0.05 + dots6 * 0.04, 0, 0.4);
  const wicketPressure = wickets6 * 0.15 + (input.wickets >= 7 ? 0.2 : input.wickets >= 5 ? 0.12 : 0);

  // Relief — boundaries and a settled partnership actively reduce pressure.
  const relief = boundaries6 * 0.08;

  return clamp(rrrPressure + dotPressure + wicketPressure - relief, 0, 1);
}

/**
 * Chooses the available field preset that best protects the arcs this batter
 * scores in — the concrete "move fielders toward the batter's high-frequency
 * scoring zones" behaviour (Section 12-A).
 */
export function recommendFieldPreset(input: {
  format: ArenaFormat | string;
  striker: Player | null;
  overs: number;
  recentBoundaryZones?: ScoringZoneName[];
  legalPresets?: string[];
}): FieldPresetRecommendation {
  const isLeftHanded = isLeftHandedBatter(input.striker);
  const pref = getBatterZonePreference(input.striker);

  // Blend the batter's long-run preference with recently-punished arcs.
  const weight = {} as Record<ScoringZoneName, number>;
  for (const z of WAGON_ZONES) weight[z.zone] = pref[z.zone];
  for (const z of input.recentBoundaryZones || []) weight[z] = (weight[z] || 0) + 0.15;
  const totalWeight = WAGON_ZONES.reduce((s, z) => s + weight[z.zone], 0) || 1;

  const allowed = input.legalPresets && input.legalPresets.length
    ? input.legalPresets
    : Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS);

  let best: FieldPresetRecommendation = { presetKey: allowed[0], reason: 'Default phase field', score: -Infinity };

  for (const key of allowed) {
    const overlay = BowlerFieldStrategyEngine.PRESET_OVERLAYS[key];
    if (!overlay) continue;
    const fake: FieldConfiguration = {
      ...({} as FieldConfiguration),
      fielders: overlay.keys.map((k, idx) => {
        const p = CANONICAL_POSITIONS[k] || CANONICAL_POSITIONS.MID_OFF;
        const mirrored = isLeftHanded ? { x: 600 - p.x, y: p.y } : { x: p.x, y: p.y };
        return {
          id: `probe_${k}_${idx}`,
          name: p.name,
          role: 'Batsman',
          positionKey: p.key,
          positionName: p.name,
          currentPos: mirrored,
          targetPos: mirrored,
          isOutsideCircle: p.isOutsideCircle,
          isCatching: p.category === 'CATCHING',
          tacticalRole: p.tacticalRole,
        } as FielderAssignment;
      }),
    };
    const coverage = analyzeFieldCoverage(fake, isLeftHanded);
    let score = 0;
    for (const c of coverage) {
      const w = weight[c.zone] / totalWeight;
      if (c.deepCovered) score += w * 1.0;
      else if (c.ringCovered) score += w * 0.35;
      else score -= w * 0.4; // leaving a favoured arc open is actively costly
    }
    if (score > best.score) {
      best = {
        presetKey: key,
        score,
        reason: `Protects ${topZones(weight, 2).join(' & ')} — the arcs this batter scores in`,
      };
    }
  }
  return best;
}

function topZones(weight: Record<ScoringZoneName, number>, n: number): ScoringZoneName[] {
  return (Object.keys(weight) as ScoringZoneName[])
    .sort((a, b) => weight[b] - weight[a])
    .slice(0, n);
}

// ─────────────────────────────────────────────────────────────────────────────
//  STRATEGIC SETUP — the captain's three canonical game-plans.
//
//  A field is a whole-ground decision (off side / leg side, across the close /
//  inner-ring / boundary zones). Rather than pick positions ad hoc, the captain
//  first commits to ONE of three classic setups — Attacking, Containment or
//  Death — driven by the match format, the innings phase and the batter at the
//  crease, then realises it with a legal preset formation.
// ─────────────────────────────────────────────────────────────────────────────

export type StrategicSetup = 'ATTACKING' | 'CONTAINMENT' | 'DEATH';

/** The canonical preset formation each setup is realised with. */
export const SETUP_PRESET_KEY: Record<StrategicSetup, string> = {
  ATTACKING: 'ATTACKING_SLIP_CORDON',
  CONTAINMENT: 'BALANCED_RING',
  DEATH: 'DEATH_YORKER_SHIELD',
};

export interface StrategicSetupInput {
  format: ArenaFormat | string;
  /** 1-indexed over about to be bowled. */
  over: number;
  wickets?: number;
  requiredRate?: number;
  striker?: Player | null;
  /** Balls the striker has faced — a small number marks a new batter. */
  strikerBalls?: number;
  recentOutcomes?: string[];
  trigger?: 'INITIAL' | 'OVER_END' | 'WICKET_FALL' | 'BOUNDARY_CLUSTER' | 'MANUAL_REQUEST';
  /** True when the bowler for this over is a spinner (enables the spin web). */
  bowlerIsSpin?: boolean;
}

export interface StrategicSetupDecision {
  setup: StrategicSetup;
  presetKey: string;
  phase: FieldingPhaseKey;
  reason: string;
}

/**
 * The single coordinated game-plan decision: format + phase + batter resolve to
 * one of Attacking / Containment / Death, which maps to one legal preset key.
 * Deterministic — the same situation always yields the same setup.
 */
export function selectStrategicSetup(input: StrategicSetupInput): StrategicSetupDecision {
  const format = String(input.format).toUpperCase();
  const over = input.over || 1;
  const phase = getFieldingPhase(format as any, over).key;
  const archetype = classifyBatterArchetype(input.striker ?? null);
  const isNewBatter = Boolean(input.striker) && (input.strikerBalls ?? 0) <= 6;

  let setup: StrategicSetup;
  let reason: string;

  if (phase === 'DEATH') {
    setup = 'DEATH';
    reason = 'Death overs — protect the rope and force low-percentage shots.';
  } else if (phase === 'TEST') {
    // Test cricket has no limited-overs urgency: attack the new ball, then
    // settle into patience and squeeze.
    setup = over <= 15 ? 'ATTACKING' : 'CONTAINMENT';
    reason = over <= 15
      ? 'Test new-ball spell — catchers behind the bat, attacking line outside off.'
      : 'Test match — containment; dry the runs and wait for the pitch.';
  } else if (phase === 'POWERPLAY') {
    setup = 'ATTACKING';
    reason = 'Powerplay — only two fielders back, so attack with catchers.';
  } else {
    setup = 'CONTAINMENT';
    reason = 'Middle overs — pack the ring, choke singles, force the risky shot.';
  }

  // Batter context can override a passive middle-overs plan — attack the tail
  // or a brand-new batter even outside the powerplay.
  if ((phase === 'MIDDLE' || phase === 'TEST') && archetype === 'tail') {
    setup = 'ATTACKING';
    reason = 'Tailender at the crease — crowd the bat and attack.';
  } else if (phase === 'MIDDLE' && isNewBatter) {
    setup = 'ATTACKING';
    reason = 'New batter at the crease — bring the catchers in.';
  }

  // Reactive triggers (Section 12-A): one coordinated override.
  if (input.trigger === 'BOUNDARY_CLUSTER') {
    setup = phase === 'DEATH' ? 'DEATH' : 'CONTAINMENT';
    reason = 'Boundary cluster conceded — pull sweepers back and rebuild pressure.';
  } else if (input.trigger === 'WICKET_FALL' && phase !== 'DEATH') {
    setup = 'ATTACKING';
    reason = 'Wicket just fell — attacking the incoming batter.';
  }

  let presetKey = SETUP_PRESET_KEY[setup];
  // A spinner's containment plan is realised with the spin web (leg slip/short leg).
  if (setup === 'CONTAINMENT' && input.bowlerIsSpin) {
    presetKey = 'SPIN_TRAP_WEB';
  }

  return { setup, presetKey, phase, reason };
}

/**
 * Builds the single coordinated per-delivery tactical model. One call resolves
 * field placement influence, the bowling line/length and the reversible
 * pressure reading together — there are no contradictory sub-decisions.
 */
export function buildDeliveryModel(input: DeliveryModelInput): TacticalDeliveryModel {
  const format = String(input.format).toUpperCase();
  const amp = formatAmplitude(format);
  const isLeftHanded = isLeftHandedBatter(input.striker);
  const coverage = analyzeFieldCoverage(input.field, isLeftHanded);
  const pref = getBatterZonePreference(input.striker);

  // ── Boundary prevention: how well is the batter's favoured arcs protected? ──
  let totalPref = 0;
  let boundaryProtect = 0;
  let rotationProtect = 0;
  let catcherProtect = 0;
  for (const c of coverage) {
    const w = pref[c.zone];
    totalPref += w;
    // Deep sweepers are the real boundary deterrent; ring help counts partially.
    boundaryProtect += w * (c.deepCovered ? 1 : c.ringCovered ? 0.35 : 0);
    // Singles are choked by ring coverage; deep cover helps a little.
    rotationProtect += w * (c.ringCovered ? 1 : c.deepCovered ? 0.3 : 0);
    // Catching threat comes from close catchers and boundary catchers in the arc.
    catcherProtect += w * (c.catcherCovered ? 1 : c.deepCovered ? 0.4 : 0);
  }
  const norm = totalPref || 1;
  const boundaryFraction = boundaryProtect / norm;
  const rotationFraction = rotationProtect / norm;
  const catcherFraction = catcherProtect / norm;

  // Centred on 1.0 → a well-set field suppresses, an open field invites.
  const boundarySuppression = clamp(1 - amp.boundary * (boundaryFraction - 0.5) * 2, 0.72, 1.22);
  const rotationSuppression = clamp(1 - amp.rotation * (rotationFraction - 0.5) * 2, 0.82, 1.14);
  const wicketOpportunity = clamp(1 + amp.wicket * (catcherFraction - 0.5) * 2, 0.90, 1.12);

  const pressureScore = computePressureScore({
    format,
    overs: input.overs,
    wickets: input.wickets,
    requiredRate: input.requiredRate,
    recentOutcomes: input.recentOutcomes,
  });

  const line = input.line || input.field?.bowlingPlan?.line || 'GOOD_LENGTH';
  const length = input.length || input.field?.bowlingPlan?.length || 'GOOD';
  const variation = input.variation || input.field?.bowlingPlan?.variation || 'NORMAL';

  return {
    boundarySuppression: round3(boundarySuppression),
    rotationSuppression: round3(rotationSuppression),
    wicketOpportunity: round3(wicketOpportunity),
    pressureScore: round3(pressureScore),
    fieldPresetKey: input.fieldPresetKey ?? null,
    line,
    length,
    variation,
    coverage,
    explanation:
      `Field ${Math.round(boundaryFraction * 100)}% protects this batter's scoring arcs ` +
      `(boundary x${boundarySuppression.toFixed(2)}, rotation x${rotationSuppression.toFixed(2)}, ` +
      `catch x${wicketOpportunity.toFixed(2)}); pressure ${pressureScore.toFixed(2)}.`,
  };
}

/** A neutral model = zero tactical influence (backward-compatible default). */
export function neutralDeliveryModel(): TacticalDeliveryModel {
  return {
    boundarySuppression: 1,
    rotationSuppression: 1,
    wicketOpportunity: 1,
    pressureScore: 0,
    fieldPresetKey: null,
    line: 'GOOD_LENGTH',
    length: 'GOOD',
    variation: 'NORMAL',
    coverage: WAGON_ZONES.map((z) => ({
      zone: z.zone,
      angleRange: z.angleRange,
      deepCovered: false,
      ringCovered: false,
      catcherCovered: false,
    })),
    explanation: 'Neutral tactical model (no field influence applied).',
  };
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Thin static facade mirroring the other AI engines, so call sites can use
 * `AdaptiveCaptainEngine.buildDeliveryModel(...)` uniformly.
 */
export class AdaptiveCaptainEngine {
  static buildDeliveryModel = buildDeliveryModel;
  static recommendFieldPreset = recommendFieldPreset;
  static selectStrategicSetup = selectStrategicSetup;
  static computePressureScore = computePressureScore;
  static analyzeFieldCoverage = analyzeFieldCoverage;
  static getBatterZonePreference = getBatterZonePreference;
  static classifyBatterArchetype = classifyBatterArchetype;
  static isLeftHandedBatter = isLeftHandedBatter;
  static neutralDeliveryModel = neutralDeliveryModel;
  static readonly WAGON_ZONES = WAGON_ZONES;
}
