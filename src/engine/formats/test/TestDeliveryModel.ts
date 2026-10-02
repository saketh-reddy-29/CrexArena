import { Player } from '../../../types/common';
import { ScoringZoneName } from '../../scoring/ScoringZones';

export type TestDeliveryLength = 'GOOD_LENGTH' | 'FULL' | 'YORKER' | 'SHORT' | 'BOUNCER';

export type TestDeliveryLine =
  | 'OUTSIDE_OFF'
  | 'ON_STUMPS'
  | 'LEG_STUMP'
  | 'WIDE_OUTSIDE_OFF'
  | 'SWINGING'
  | 'SEAMING'
  | 'SPIN'
  | 'ARM_BALL'
  | 'DRIFTING_SPIN';

export type TestShotType =
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

export type TestWicketType =
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_BEHIND'
  | 'CAUGHT_SLIP'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET';

export type TestBattingIntent =
  | 'SURVIVAL'
  | 'SETTLING'
  | 'DEFENSIVE'
  | 'NORMAL'
  | 'CONTROLLED_ATTACK'
  | 'ACCELERATE';

export interface TestDeliveryTrajectory {
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

export interface TestDeliveryRecord {
  deliveryId: string; // e.g. "TEST_INNINGS_2_OVER_103_BALL_1"
  matchId: string;
  inningsId: number; // 1, 2, 3, 4
  over: number;      // 0-indexed over (e.g. 103 for over 104)
  ball: number;      // 1 to 6
  ballDisplay: string; // e.g. "103.1"
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  fieldConfiguration: string; // e.g. "SPIN_TRAP", "ATTACKING_TEST"
  deliveryType: string;
  line: TestDeliveryLine;
  length: TestDeliveryLength;
  intent: TestBattingIntent;
  shot: TestShotType;
  targetZone: ScoringZoneName;
  result: 'DOT' | 'SINGLE' | 'TWO' | 'THREE' | 'FOUR' | 'SIX' | 'WICKET';
  runs: number;
  extras: number;
  extraType?: 'WIDE' | 'NO_BALL' | 'BYE' | 'LEG_BYE' | null;
  wicket: boolean;
  wicketType?: TestWicketType | null;
  dismissalFielder?: string | null;
  fielderName?: string | null;
  trajectory: TestDeliveryTrajectory;
  timestamp: number;
  commentaryText: string;
  stepMessages: string[];
}

export interface TestBatterScorecardLine {
  id: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  out: boolean;
  dismissalInfo: string;
  intent: TestBattingIntent;
  scoringZonesMap: Record<string, number>;
}

export interface TestBowlerScorecardLine {
  id: string;
  name: string;
  overs: number; // e.g. 18.2
  balls: number; // total legal balls
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  dots: number;
  boundaries: number;
  currentSpellOvers: number;
  currentSpellRuns: number;
  currentSpellWickets: number;
}

export interface TestFallOfWicket {
  wicketNumber: number;
  score: number;
  over: string;
  batterId: string;
  batterName: string;
  bowlerId: string;
  bowlerName: string;
  dismissal: string;
}

export interface TestPartnership {
  batter1Id: string;
  batter1Name: string;
  batter2Id: string;
  batter2Name: string;
  runs: number;
  balls: number;
  wicketNumber: number;
  active: boolean;
}

export interface TestInningsData {
  inningsNumber: 1 | 2 | 3 | 4;
  battingTeamId: string;
  bowlingTeamId: string;
  battingTeamName: string;
  bowlingTeamName: string;
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  legalBalls: number;
  isDeclared: boolean;
  isAllOut: boolean;
  isCompleted: boolean;
  statusText: string;
  batters: Record<string, TestBatterScorecardLine>;
  bowlers: Record<string, TestBowlerScorecardLine>;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    total: number;
  };
  fallOfWickets: TestFallOfWicket[];
  partnerships: TestPartnership[];
  deliveries: TestDeliveryRecord[];
}

export interface TestMatchSummary {
  matchId: string;
  day: number; // 1 to 5
  session: 'MORNING' | 'AFTERNOON' | 'EVENING';
  sessionName: string;
  sessionOvers: number;
  oversToday: number;
  currentInningsIndex: number; // 0 to 3 (Innings 1 to 4)
  innings: TestInningsData[];
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  ballAge: number; // in overs
  oversSinceNewBall: number;
  newBallAvailable: boolean;
  pitch: {
    pace: number;
    bounce: number;
    seam: number;
    swing: number;
    spin: number;
    deterioration: number;
  };
  fieldPreset: string;
  lead: number | null;
  trail: number | null;
  target: number | null;
  result: 'IN_PROGRESS' | 'TEAM_1_WIN' | 'TEAM_2_WIN' | 'DRAW' | 'TIE';
  resultDescription: string;
}
