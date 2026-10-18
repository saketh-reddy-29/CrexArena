import { Player } from './common';
import type { MatchConditionReport } from '../engine/conditions/types';

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
  COMPLETED = 'Completed',
  ABANDONED = 'Abandoned',
  POSTPONED = 'Postponed'
}

export type FixtureStatus =
  | 'SCHEDULED'
  | 'SQUAD_ANNOUNCED'
  | 'TOSS_PENDING'
  | 'LIVE'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'POSTPONED';

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
  inningsNumber: number; // 1-2 for limited overs, 1-4 for Test
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

export type MatchResultType = 'WIN' | 'DRAW' | 'TIE' | 'NO_RESULT';

export interface MatchScorecard {
  team1Id: string;
  team2Id: string;
  /**
   * All innings in batting order. Limited-overs matches have 2; Test matches
   * have up to 4 (innings 3/4 only exist if the match reaches them).
   */
  innings: InningsData[];
  winnerId?: string;
  margin?: string;
  result?: MatchResultType;
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
  // Test-specific (optional so limited-overs innings remain valid)
  inningsNumber?: number;             // 1-4, batting order across the match
  declared?: boolean;                 // Captain declared the innings closed
  isFollowOn?: boolean;               // Batting again because of an enforced follow-on
}

export interface TestDaySession {
  day: number;                        // 1-5
  session: 'Morning' | 'Afternoon' | 'Evening';
}

export interface Fixture {
  id: string;
  matchNumber: number;
  day: number;
  team1Id: string;
  team2Id: string;
  status: MatchStatus;
  fixtureStatus?: FixtureStatus;
  format?: MatchFormat;
  scorecard?: MatchScorecard;
  /**
   * Set once a result has been committed. Acts as the permanent replay lock:
   * a finalised fixture can never be started, watched or simulated again, even
   * if its coarse status is somehow left inconsistent.
   */
  finalized?: boolean;
  conditions?: MatchConditions;
  /** Full persisted pitch/ground/weather/toss-report bundle, seeded per fixture. */
  conditionReport?: MatchConditionReport;
  isPlayoff?: boolean;
  playoffType?: 'Qualifier 1' | 'Eliminator' | 'Qualifier 2' | 'Final';
  venue?: string;
  startTime?: number;
  endTime?: number;
  tournamentId?: string;
  team1PlayingXI?: string[];
  team2PlayingXI?: string[];
  team1Squad?: string[];
  team2Squad?: string[];
}

export interface Standing {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  drawn?: number;
  tied?: number;
  points: number;
  pct?: number; // Test Championship points percentage
  nrr: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  form: Array<'W' | 'L' | 'D' | 'T'>;
}

// ─── Series (bilateral) ──────────────────────────────────────────────

export type SeriesFormat = 'T20' | 'ODI' | 'TEST';

/**
 * A bilateral series: exactly two teams meeting over a fixed number of
 * matches. This is the configuration a player chooses on the Series setup
 * screen before fixtures are generated.
 */
export interface SeriesConfig {
  id: string;
  name: string;
  format: SeriesFormat;
  team1Id: string;
  team2Id: string;
  /** Number of matches in the series (1-7). */
  matchCount: number;
  createdAt: number;
}

/** A single row of a bilateral series points table. */
export interface SeriesStanding {
  teamId: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  points: number;
  /** WTC-style points percentage (points / (played * maxPoints) * 100). */
  pct: number;
  nrr: number;
  runsScored: number;
  oversFaced: number;
  runsConceded: number;
  oversBowled: number;
  form: Array<'W' | 'L' | 'D' | 'T'>;
}

