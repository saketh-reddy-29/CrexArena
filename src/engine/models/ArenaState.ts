import { FormatType } from '../rules/RulesEngine';

export type ArenaFormat = 'IPL' | 'T20' | 'ODI' | 'TEST';

export interface ArenaProfile {
  id: string;
  userId: string;
  name: string;
  format: FormatType;
  seasonId: string;
  userTeamId: string;
  status: 'DRAFT' | 'AUCTION' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: number;
  updatedAt: number;
}

export interface PlayerDevelopmentCategories {
  bat: number;
  bowl: number;
  field: number;
  keeping: number;
  mental: number;
  technique: number;
  fitness: number;
}

export interface MatchPerformanceRecord {
  matchId: string;
  date: number;
  format: ArenaFormat;
  oppositionTeamId?: string;
  oppositionName?: string;
  venue?: string;
  result?: 'WIN' | 'LOSS' | 'DRAW' | 'TIE';
  
  // Batting
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  strikeRate: number;
  
  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;

  // Test specifics
  ballsSurvived?: number;
  dots?: number;
  timeAtCrease?: number;
  settlednessMax?: number;
  fourthInnings?: boolean;

  // Progression metrics
  performanceScore: number;
  expectedScore: number;
  formBefore: number;
  formAfter: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingDelta: number;
}

export interface TestBowlerMemory {
  ballsSeen: number;
  movementSeen: number;
  swingSeen: number;
  bounceSeen: number;
  wicketsLost: number;
  adaptationLevel: number; // 0 to 100
}

export interface CareerStatsModel {
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  highestScore: number;
  fifties: number;
  hundreds: number;
  doubleHundreds: number;
  tripleHundreds: number;
  fours: number;
  sixes: number;
  notOuts: number;
  
  // Bowling
  oversBowled: number;
  ballsBowled: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  bestBowling: string;
  fiveWickets: number;
  tenWickets: number;
  
  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;

  // Advanced Test & In-depth stats
  dots: number;
  ballsSurvived: number;
  timeAtCrease: number;
  partnershipRuns: number;
  fourthInningsRuns: number;
  sessionsBatted: number;
  newBallWickets: number;
}

export interface ArenaPlayerState {
  id: string; // Unique composite key: `${arenaId}_${playerId}_${format}`
  arenaId: string;
  playerId: string;
  format: ArenaFormat;

  // Ability & Arena progression
  baseRating: number;
  currentRating: number;
  potential: number;

  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;
  wicketkeepingRating: number;

  formRating: number; // Current form (0 - 100)
  confidence: number; // 0 - 100 (baseline 75)
  fitness: number;    // 0 - 100 (baseline 85)
  fatigue: number;    // 0 - 100 (baseline 0)

  recentForm: number; // 0 initially (meaning no matches played yet)
  hasRecentMatches: boolean;
  recentMatchCount: number;
  recentRuns: number;
  recentWickets: number;
  recentCatches: number;
  recentInnings: number;
  recentBallsFaced: number;
  recentBallsBowled: number;
  recentAverage: number;
  recentStrikeRate: number;
  recentEconomy: number;

  developmentPoints: number;
  ratingDelta: number; // last match rating delta
  development: PlayerDevelopmentCategories;

  // Rolling match history (last 5, 10, 20 matches recorded)
  recentMatches: MatchPerformanceRecord[];

  // Statistics separated at all levels
  careerStats: CareerStatsModel;
  seasonStats: CareerStatsModel;
  competitionStats: CareerStatsModel;

  // Test Batter-Bowler memory
  testMemory?: Record<string, TestBowlerMemory>;

  lastMatchAt?: number;
  updatedAt: number;
  createdAt: number;
}

export interface PlayerMatchStats {
  id: string;
  matchId: string;
  arenaId: string;
  playerId: string;
  seasonId: string;
  format: ArenaFormat;

  // Batting
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;

  // Bowling
  wickets: number;
  overs: number;
  runsConceded: number;
  maidens: number;

  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;

  // Test specifics
  ballsSurvived?: number;
  dots?: number;
  settlednessMax?: number;

  // Progression tracking
  performanceScore: number;
  expectedScore: number;
  ratingDelta: number;
  oldRating: number;
  newRating: number;
  oldForm: number;
  newForm: number;
}

export interface SeasonTeamStats {
  arenaId: string;
  seasonId: string;
  teamId: string;
  
  played: number;
  won: number;
  lost: number;
  drawn: number;
  tied: number;
  noResult: number;
  points: number;
  nrr: number;
}
