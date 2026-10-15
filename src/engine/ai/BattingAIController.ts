import { Player } from '../../types/common';
import { ArenaFormat } from '../models/ArenaState';
import { BatterDecisionEngine, BattingIntent, BatterInningsState } from './BatterDecisionEngine';

// ─────────────────────────────────────────────────────────────────────────────
// AUTONOMOUS BATTING AI — controls the *opponent* team's batting (and, when the
// user is fielding, the user's team never bats so there is nothing to control).
//
// Responsibilities:
//   • choose the two opening batters
//   • choose the incoming batter after a wicket
//   • choose batting intent for each delivery
//
// Selections are situation-aware: the AI promotes an aggressor when the required
// rate climbs, and sends in a steadying anchor during a collapse. With no RNG
// injected the behaviour is fully deterministic, which keeps it unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

export interface BattingAIInput {
  format: ArenaFormat;
  squad: Player[];
  batters?: Record<string, { runs: number; balls: number; out?: boolean } | undefined>;
  strikerId?: string | null;
  nonStrikerId?: string | null;
  /** Index into the squad's (already ordered) batting line-up. */
  battingCursor?: number;
  wickets: number;
  runs: number;
  balls: number;
  target?: number;
  recentBalls?: string[];
  random?: () => number;
}

export type AIBatterReason = 'BATTING_ORDER' | 'ACCELERATE' | 'STABILISE';

export interface AIBatterSelection {
  player: Player | null;
  reason: AIBatterReason;
  explanation: string;
}

function battingScore(p: Player | undefined | null): number {
  if (!p) return 0;
  return p.stats?.batting ?? p.rating ?? 60;
}

function aggressionScore(p: Player): number {
  return battingScore(p) * 0.6 + (p.aggression ?? 50) * 0.4;
}

function anchorScore(p: Player): number {
  return battingScore(p) * 0.7 + (p.temperament ?? 50) * 0.3;
}

/** Batters eligible to come to the crease (not out, not already batting). */
export function getAvailableAIBatters(input: BattingAIInput): Player[] {
  return input.squad.filter((p) => {
    if (input.batters?.[p.id]?.out) return false;
    if (p.id === input.strikerId || p.id === input.nonStrikerId) return false;
    return true;
  });
}

function isCollapse(input: BattingAIInput): boolean {
  if (input.wickets >= 6) return true;
  const recent = (input.recentBalls || []).slice(-3);
  return recent.filter((b) => b === 'W').length >= 2;
}

function requiredRunRate(input: BattingAIInput): number {
  if (!input.target) return 0;
  const maxBalls = input.format === 'ODI' ? 300 : input.format === 'TEST' ? 9999 : 120;
  const remaining = Math.max(1, maxBalls - input.balls);
  const needed = Math.max(0, input.target - input.runs);
  return (needed / remaining) * 6;
}

function shouldAccelerate(input: BattingAIInput): boolean {
  if (input.format === 'TEST' || !input.target) return false;
  const rrr = requiredRunRate(input);
  const maxBalls = input.format === 'ODI' ? 300 : 120;
  const phase: 'EARLY' | 'MIDDLE' | 'LATE' =
    input.balls / maxBalls < 0.34 ? 'EARLY' : input.balls / maxBalls < 0.72 ? 'MIDDLE' : 'LATE';
  const threshold = phase === 'LATE' ? 8 : phase === 'MIDDLE' ? 9.5 : 11;
  return rrr >= threshold;
}

/**
 * Chooses the next batter for the opponent: batting order by default, with a
 * situational promotion (aggressor) or steadying pick (anchor) when warranted.
 */
export function selectAINextBatter(input: BattingAIInput): AIBatterSelection {
  const available = getAvailableAIBatters(input);
  if (available.length === 0) {
    return { player: null, reason: 'BATTING_ORDER', explanation: 'No further batters are available.' };
  }

  if (isCollapse(input) && available.length > 1) {
    const anchor = [...available].sort((a, b) => anchorScore(b) - anchorScore(a))[0];
    return {
      player: anchor,
      reason: 'STABILISE',
      explanation: `${anchor.name} sent in to steady the innings after a wicket cluster.`,
    };
  }

  if (shouldAccelerate(input) && available.length > 1) {
    const aggressor = [...available].sort((a, b) => aggressionScore(b) - aggressionScore(a))[0];
    return {
      player: aggressor,
      reason: 'ACCELERATE',
      explanation: `${aggressor.name} promoted to accelerate the chase at ${requiredRunRate(input).toFixed(1)} rpo required.`,
    };
  }

  const next = available[0];
  return {
    player: next,
    reason: 'BATTING_ORDER',
    explanation: `${next.name} comes in at the fall of the wicket per the batting order.`,
  };
}

/**
 * Selects the two opening batters. Prefers the configured top order but allows a
 * mild promotion of a specialist opener; the more aggressive opener takes strike.
 */
export function selectAIOpeningBatters(input: BattingAIInput): {
  striker: Player | null;
  nonStriker: Player | null;
  explanation: string;
} {
  const available = getAvailableAIBatters(input);
  if (available.length === 0) {
    return { striker: null, nonStriker: null, explanation: 'No opening batters available.' };
  }
  if (available.length === 1) {
    return { striker: available[0], nonStriker: null, explanation: `${available[0].name} opens alone.` };
  }

  const pool = available.slice(0, Math.max(2, Math.min(6, available.length)));
  const openingScore = (p: Player) => battingScore(p) * 0.8 + (p.temperament ?? 50) * 0.2;
  const ranked = [...pool].sort((a, b) => openingScore(b) - openingScore(a));

  const first = ranked[0];
  const second = ranked.find((p) => p.id !== first.id) ?? available.find((p) => p.id !== first.id) ?? null;

  let striker = first;
  let nonStriker = second;
  if (nonStriker && aggressionScore(nonStriker) > aggressionScore(striker)) {
    striker = second;
    nonStriker = first;
  }

  return {
    striker,
    nonStriker,
    explanation: `${striker.name} and ${nonStriker?.name ?? 'TBC'} to open the batting.`,
  };
}

/** Freezes the opponent's batting intent for the upcoming delivery. */
export function decideAIBattingIntent(
  batterState: BatterInningsState | null,
  input: {
    format: ArenaFormat;
    batter: Player;
    bowler?: Player | null;
    score: number;
    wickets: number;
    balls: number;
    target?: number;
    partnershipRuns?: number;
    partnershipBalls?: number;
    pitchType?: string;
  },
): BattingIntent {
  const state =
    batterState ||
    BatterDecisionEngine.createInitialBatterState(input.batter.id, 'ai_innings', input.batter);
  return BatterDecisionEngine.selectBattingIntent(state, {
    format: input.format,
    batter: input.batter,
    bowler: input.bowler ?? undefined,
    inningsState: {
      score: input.score,
      wickets: input.wickets,
      balls: input.balls,
      target: input.target,
      partnershipRuns: input.partnershipRuns,
      partnershipBalls: input.partnershipBalls,
    },
    pitchType: input.pitchType,
  });
}
