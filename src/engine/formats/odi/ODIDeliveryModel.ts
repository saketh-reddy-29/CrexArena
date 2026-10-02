import { Player } from '../../../types/common';
import { ScoringZoneName } from '../../scoring/ScoringZones';

export type ODIPhase = 'POWERPLAY' | 'MIDDLE_OVERS' | 'DEATH_OVERS';

export type ODIBattingStrategy =
  | 'DEFENSIVE'
  | 'BUILDING'
  | 'ROTATE'
  | 'CONTROLLED_ATTACK'
  | 'ACCELERATE'
  | 'AGGRESSIVE'
  | 'ALL_OUT_ATTACK';

export type ODIBowlingStrategy =
  | 'ATTACK_STUMPS'
  | 'SWING_SEAM'
  | 'DOT_BALL_PRESSURE'
  | 'CONTAINMENT'
  | 'BREAK_PARTNERSHIP'
  | 'DEATH_EXECUTION';

export type ODIDeliveryLength = 'GOOD_LENGTH' | 'FULL' | 'YORKER' | 'SHORT' | 'SLOWER_BALL';

export type ODIDeliveryLine =
  | 'OUTSIDE_OFF'
  | 'ON_STUMPS'
  | 'LEG_STUMP'
  | 'WIDE_OUTSIDE_OFF'
  | 'INSWING'
  | 'OUTSWING'
  | 'OFF_BREAK'
  | 'LEG_BREAK';

export type ODIShotType =
  | 'FORWARD_DEFENCE'
  | 'BACKFOOT_DEFENCE'
  | 'LEAVE'
  | 'COVER_DRIVE'
  | 'SQUARE_CUT'
  | 'LATE_CUT'
  | 'STRAIGHT_DRIVE'
  | 'ON_DRIVE'
  | 'PULL_SHOT'
  | 'HOOK_SHOT'
  | 'FLICK'
  | 'GLANCE'
  | 'SWEEP'
  | 'LOFTED_SIX'
  | 'DIG_OUT_YORKER'
  | 'EDGE';

export type ODIWicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_BEHIND'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET';

export interface ODIDeliveryTrajectory {
  startPos: { x: number; y: number; z: number };
  bouncePos: { x: number; y: number; z: number };
  contactPos: { x: number; y: number; z: number };
  targetPos: { x: number; y: number; z: number };
  isAerial: boolean;
  apexHeight: number;
  swingFactor: number;
  seamDeviation: number;
  shotAngleDeg: number;
}

export interface ODIDeliveryRecord {
  deliveryId: string; // e.g. "ODI_INNINGS_1_OVER_28_BALL_3"
  matchId: string;
  inningsId: 1 | 2;
  over: number;      // 0-49
  ball: number;      // 1-6
  ballDisplay: string; // e.g. "28.3"
  phase: ODIPhase;
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  fieldConfiguration: string; // e.g. "POWERPLAY", "MIDDLE_OVERS", "DEATH_OVERS"
  deliveryType: string;
  line: ODIDeliveryLine;
  length: ODIDeliveryLength;
  intent: ODIBattingStrategy;
  shot: ODIShotType;
  targetZone: ScoringZoneName;
  result: 'DOT' | 'SINGLE' | 'TWO' | 'THREE' | 'FOUR' | 'SIX' | 'WICKET';
  runs: number;
  extras: number;
  extraType?: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | null;
  wicket: boolean;
  wicketType?: ODIWicketType | null;
  dismissalFielder?: string | null;
  fielderName?: string | null;
  trajectory: ODIDeliveryTrajectory;
  timestamp: number;
  commentaryText: string;
  stepMessages: string[];
}

export interface ODIBatterScorecardLine {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  dismissalInfo: string;
  intent: ODIBattingStrategy;
  scoringZonesMap: Record<string, number>;
}

export interface ODIBowlerScorecardLine {
  id: string;
  name: string;
  overs: number; // e.g. 6.2
  balls: number; // total legal balls (max 60)
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dots: number;
  boundaries: number;
  currentSpellOvers: number;
}

export interface ODIFallOfWicket {
  wicketNumber: number;
  score: number;
  over: string;
  batterId: string;
  batterName: string;
  bowlerId: string;
  bowlerName: string;
  dismissal: string;
}

export interface ODIPartnership {
  batter1Id: string;
  batter1Name: string;
  batter2Id: string;
  batter2Name: string;
  runs: number;
  balls: number;
  wicketNumber: number;
  active: boolean;
}

export interface ODIInningsData {
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  legalBalls: number;
  maxOvers: number; // 50
  maxBalls: number; // 300
  isAllOut: boolean;
  isCompleted: boolean;
  statusText: string;
  batters: Record<string, ODIBatterScorecardLine>;
  bowlers: Record<string, ODIBowlerScorecardLine>;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    total: number;
  };
  fallOfWickets: ODIFallOfWicket[];
  partnerships: ODIPartnership[];
  deliveries: ODIDeliveryRecord[];
}

export interface ODIMatchSummary {
  matchId: string;
  currentInningsIndex: 0 | 1; // 0 = 1st, 1 = 2nd
  currentPhase: ODIPhase;
  phaseName: string;
  phaseDescription: string;
  innings: [ODIInningsData, ODIInningsData];
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  currentRunRate: number;
  requiredRunRate: number | null;
  target: number | null;
  runsRequired: number | null;
  ballsRemaining: number | null;
  oversRemaining: number | null;
  projectedScore: number;
  fieldPreset: string;
  fieldStrategyPlan: string;
  fieldChanges: string[];
  result: 'IN_PROGRESS' | 'TEAM_1_WIN' | 'TEAM_2_WIN' | 'TIE' | 'NO_RESULT';
  resultDescription: string;
}
