import { Player } from './common';

// ─── Enums ───────────────────────────────────────────────────────────

export enum PitchType {
  BATTING = 'Batting',
  PACE = 'Pace',
  SPIN = 'Spin',
  SLOW = 'Slow',
  BALANCED = 'Balanced'
}

export enum WeatherCondition {
  SUNNY = 'Sunny',
  CLOUDY = 'Cloudy',
  HUMID = 'Humid',
  DEW = 'Dew'
}

export enum MatchFormat {
  T20 = 'T20',
  ODI = 'ODI',
  TEST = 'TEST'
}

export enum MatchStatus {
  UPCOMING = 'Upcoming',
  LIVE = 'Live',
  COMPLETED = 'Completed'
}

export enum TossDecision {
  BAT = 'Bat',
  BOWL = 'Bowl'
}

export enum PowerPlayPhase {
  MANDATORY = 'Mandatory',   // Overs 1-6: only 2 fielders outside 30-yard circle
  MIDDLE = 'Middle',          // Overs 7-16: up to 5 fielders outside
  DEATH = 'Death'             // Overs 17-20: up to 5 fielders outside
}

export enum DRSResult {
  UPHELD = 'Upheld',                // Umpire decision stays
  OVERTURNED = 'Overturned',        // Decision reversed
  UMPIRES_CALL = "Umpire's Call"    // Stays with on-field (review retained)
}

// ─── Interfaces ──────────────────────────────────────────────────────

export interface MatchConditions {
  pitchType: PitchType;
  weather: WeatherCondition;
  tossWinnerId: string;
  tossDecision: TossDecision;
}

export interface BallOutcome {
  runs: number;
  isWicket: boolean;
  wicketType?: 'Bowled' | 'Caught' | 'Caught Behind' | 'LBW' | 'Run Out' | 'Stumped' | 'Timed Out' | 'Hit Wicket';
  isExtra: boolean;
  extraType?: 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye';
  batsmanId: string;
  bowlerId: string;
  commentary: string;
  fieldingEvent?: 'Dropped Catch' | 'Brilliant Catch' | 'Direct Hit' | 'Misfield' | 'Boundary Save';
  // IPL-specific
  isFreeHit?: boolean;          // Was this delivery a free hit?
  triggeredFreeHit?: boolean;   // Does this delivery trigger a free hit for the NEXT ball? (no ball)
  drsReview?: DRSReview;        // If a DRS review happened on this ball
}

export interface DRSReview {
  reviewingTeamId: string;     // Team that initiated the review
  originalDecision: 'Out' | 'Not Out';
  reviewType: 'LBW' | 'Caught Behind' | 'Caught';
  result: DRSResult;
  overturned: boolean;
}

export interface ImpactPlayerSubstitution {
  incomingPlayerId: string;     // Player coming in
  outgoingPlayerId: string;     // Player being replaced
  teamId: string;
  overNumber: number;           // When the substitution happened
  reason: string;               // e.g., "Batting reinforcement", "Bowling reinforcement"
}

export interface StrategicTimeout {
  teamType: 'bowling' | 'batting';
  overNumber: number;
  inningsNumber: 1 | 2;
}

export interface SuperOverInnings {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  balls: number;
  batsmanIds: [string, string, string];  // striker, non-striker, next
  bowlerId: string;
  ballByBall: BallOutcome[];
}

export interface SuperOver {
  innings: [SuperOverInnings, SuperOverInnings];
  winnerId?: string;
  attempt: number;  // 1st super over, 2nd, etc.
}

export interface PlayerMatchStats {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  isOut?: boolean;
  dismissalType?: string;
  overs: number;
  runsConceded: number;
  dots: number;
  momentum?: number;
  fatigue?: number;
  consecutiveDots?: number;
  ballsSinceBoundary?: number;
  lastOverRuns?: number;
  wicketBurst?: number;
  // Bowling tracking
  bouncersThisOver?: number;    // Max 2 per over
  oversBowled?: number;         // Track total overs for 4-over limit
  legalBallsThisOver?: number;  // Track balls in current over
}

export interface MatchScorecard {
  team1Id: string;
  team2Id: string;
  innings: [InningsData, InningsData];
  winnerId?: string;
  margin?: string;
  playerOfMatchId?: string;
  superOver?: SuperOver;        // If match tied
}

export interface InningsData {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  batsmen: Record<string, PlayerMatchStats>;
  bowlers: Record<string, PlayerMatchStats>;
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
  };
  fallOfWickets: Array<{ score: number; wicket: number; over: number }>;
  // IPL-specific
  isFreeHitPending: boolean;          // Next ball is a free hit
  drsReviews: DRSReview[];            // Reviews used this innings
  drsReviewsRemaining: number;        // Starts at 2
  impactPlayer?: ImpactPlayerSubstitution;
  strategicTimeouts: StrategicTimeout[];
  currentPhase: PowerPlayPhase;
}

export interface Fixture {
  id: string;
  matchNumber: number;
  day: number;
  team1Id: string;
  team2Id: string;
  status: MatchStatus;
  format?: MatchFormat;
  scorecard?: MatchScorecard;
  conditions?: MatchConditions;
  isPlayoff?: boolean;
  playoffType?: 'Qualifier 1' | 'Eliminator' | 'Qualifier 2' | 'Final';
}

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  nrr: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  form: Array<'W' | 'L'>;
}
