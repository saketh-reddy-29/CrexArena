import { ArenaFormat, ArenaPlayerState, MatchPerformanceRecord, CareerStatsModel } from '../models/ArenaState';

export type { ArenaFormat, ArenaPlayerState, MatchPerformanceRecord, CareerStatsModel };

export interface FormatAttributes {
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
  form: number;
  confidence: number;
  fitness: number;
  fatigue: number;
  
  // Batting specifics
  technique?: number;
  power?: number;
  aggression?: number;
  consistency?: number;
  strikeRotation?: number;
  
  // Bowling specifics
  accuracy?: number;
  deathBowling?: number;
  economy?: number;
  wicketTaking?: number;
  
  // Mental
  temperament?: number;
  concentration?: number;
  pressureHandling?: number;
}

export interface PlayerFormatRating {
  test: FormatAttributes;
  odi: FormatAttributes;
  t20: FormatAttributes;
  ipl: FormatAttributes;
}

export interface MatchPerformanceSummary {
  runsScored: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  
  wicketsTaken: number;
  runsConceded: number;
  oversBowled: number;
  maidens: number;
  
  catches: number;
  stumpings: number;
  runOuts: number;

  dots?: number;
  ballsSurvived?: number;
  fourthInnings?: boolean;
}

export interface PlayerFormStatus {
  value: number | null;
  label: string;
  trend: 'IMPROVING' | 'DECLINING' | 'NEUTRAL';
  delta: number;
  recentMatches: number;
  lastMatchAt?: Date;
}
