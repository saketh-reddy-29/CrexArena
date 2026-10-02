import { ScoringZoneName } from '../scoring/ScoringZones';

export type WicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET';

export type ShotType =
  | 'FORWARD_DEFENCE'
  | 'BACKFOOT_DEFENCE'
  | 'LEAVE'
  | 'COVER_DRIVE'
  | 'SQUARE_DRIVE'
  | 'STRAIGHT_DRIVE'
  | 'ON_DRIVE'
  | 'SQUARE_CUT'
  | 'LATE_CUT'
  | 'UPPER_CUT'
  | 'PULL_SHOT'
  | 'HOOK_SHOT'
  | 'FLICK'
  | 'SWEEP'
  | 'REVERSE_SWEEP'
  | 'LOFTED_SIX'
  | 'DIG_OUT_YORKER'
  | 'EDGE';

export type BatterOutcomeType =
  | 'DOT'
  | 'SINGLE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'SIX'
  | 'WICKET';

export interface BallTrajectoryData {
  startPos: { x: number; y: number; z: number };
  bouncePos: { x: number; y: number; z: number };
  targetPos: { x: number; y: number; z: number };
  apexHeight: number;
  swingFactor: number;
  seamDeviation: number;
  isAerial: boolean;
}

export interface DeliveryResult {
  deliveryId: string;
  matchId?: string;
  inningsNumber: number;
  overNumber: number;
  ballNumber: number;

  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;

  legalBall: boolean;

  batterRuns: number;
  extraRuns: number;
  totalRuns: number;
  extraType?: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | null;

  wicket: boolean;
  wicketType?: WicketType | null;
  dismissalFielderId?: string | null;

  shotType?: ShotType;
  shotDirection?: ScoringZoneName;
  targetZone?: ScoringZoneName;

  trajectory?: BallTrajectoryData;

  fielderId?: string | null;
  catchType?: string | null;
  runsCompleted?: number;

  batterOutcome: BatterOutcomeType;
  confidence: number;
  timestamp: number;
}

export interface BatterInningsStats {
  id: string;
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalInfo?: string;
  scoringZonesMap: Record<string, number>;
}

export interface BowlerInningsStats {
  id: string;
  name: string;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  dots: number;
  boundaries: number;
}

export interface MatchState {
  matchId: string;
  format: 'T20' | 'IPL' | 'ODI' | 'TEST' | string;
  phase: string;
  inningsNumber: number;
  overs: number;
  balls: number;
  score: number;
  wickets: number;
  legalBalls: number;
  currentOver: number;

  striker: BatterInningsStats;
  nonStriker: BatterInningsStats;
  bowler: BowlerInningsStats;

  batters: Record<string, BatterInningsStats>;
  bowlers: Record<string, BowlerInningsStats>;

  currentPartnership: {
    runs: number;
    balls: number;
  };

  target: number | null;
  runsRequired: number | null;
  ballsRemaining: number | null;
  requiredRunRate: number | null;
  currentRunRate: number;

  fieldConfigurationId: string;
  deliveriesHistory: DeliveryResult[];
  isCompleted: boolean;
  winner?: string | null;
}

/**
 * ATOMIC SCORECARD UPDATE
 * Executes state mutation exactly ONCE upon confirmed delivery completion
 */
export function applyDeliveryResult(
  state: MatchState,
  result: DeliveryResult
): MatchState {
  const next = { ...state };

  // 1. Total score & extras
  next.score += result.totalRuns;

  // 2. Batter Stats Update
  const striker = next.batters[result.strikerId] || next.striker;
  if (striker) {
    striker.runs += result.batterRuns;
    if (result.legalBall) {
      striker.ballsFaced += 1;
    }
    if (result.batterRuns === 4) striker.fours += 1;
    if (result.batterRuns === 6) striker.sixes += 1;
    striker.strikeRate = striker.ballsFaced > 0 ? (striker.runs / striker.ballsFaced) * 100 : 0;

    // Track zone scoring
    if (result.targetZone && result.batterRuns > 0) {
      striker.scoringZonesMap[result.targetZone] = (striker.scoringZonesMap[result.targetZone] || 0) + result.batterRuns;
    }

    if (result.wicket) {
      striker.isOut = true;
      striker.dismissalInfo = result.wicketType || 'Out';
    }
  }

  // 3. Bowler Stats Update
  const bowler = next.bowlers[result.bowlerId] || next.bowler;
  if (bowler) {
    bowler.runsConceded += result.totalRuns;
    if (result.wicket && result.wicketType !== 'RUN_OUT') {
      bowler.wickets += 1;
    }
    if (result.totalRuns === 0 && result.legalBall) {
      bowler.dots += 1;
    }
    if (result.totalRuns >= 4) {
      bowler.boundaries += 1;
    }
    if (result.legalBall) {
      const totalLegal = next.legalBalls + 1;
      const completeOvers = Math.floor(totalLegal / 6);
      const remBalls = totalLegal % 6;
      bowler.overs = Number(`${completeOvers}.${remBalls}`);
      const oversFrac = completeOvers + remBalls / 6;
      bowler.economy = oversFrac > 0 ? bowler.runsConceded / oversFrac : 0;
    }
  }

  // 4. Partnership Update
  next.currentPartnership = {
    runs: next.currentPartnership.runs + result.totalRuns,
    balls: next.currentPartnership.balls + (result.legalBall ? 1 : 0),
  };

  // 5. Wickets Update
  if (result.wicket) {
    next.wickets += 1;
    next.currentPartnership = { runs: 0, balls: 0 };
  }

  // 6. Overs & Balls Progression
  if (result.legalBall) {
    next.legalBalls += 1;
    next.balls = next.legalBalls % 6;
    next.overs = Math.floor(next.legalBalls / 6);
    next.currentOver = next.overs;
  }

  // 7. Run Rate & Chase Metrics
  const totalOversFraction = next.overs + next.balls / 6;
  next.currentRunRate = totalOversFraction > 0 ? (next.score / totalOversFraction) : 0;

  if (next.target) {
    next.runsRequired = Math.max(0, next.target - next.score);
    const maxBalls = (next.format.toUpperCase() === 'TEST' ? 450 : next.format.toUpperCase() === 'ODI' ? 300 : 120);
    next.ballsRemaining = Math.max(0, maxBalls - next.legalBalls);
    next.requiredRunRate = next.ballsRemaining > 0 ? (next.runsRequired / (next.ballsRemaining / 6)) : 0;

    if (next.score >= next.target) {
      next.isCompleted = true;
    }
  }

  if (next.wickets >= 10) {
    next.isCompleted = true;
  }

  // 8. Strike Rotation (Odd runs or Over end)
  if (result.batterRuns % 2 === 1) {
    const temp = next.striker;
    next.striker = next.nonStriker;
    next.nonStriker = temp;
  }
  if (result.legalBall && next.balls === 0 && next.legalBalls > 0) {
    // End of over strike rotation
    const temp = next.striker;
    next.striker = next.nonStriker;
    next.nonStriker = temp;
  }

  // 9. Persist to history
  next.deliveriesHistory.push(result);

  return next;
}
