export interface FormatAttributes {
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
  form: number;
  
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
}

export interface FormHistoryEntry {
  matchId: string;
  format: "TEST" | "ODI" | "T20" | "IPL";
  performanceScore: number;
  formBefore: number;
  formAfter: number;
  date: Date;
}

export interface ArenaPlayerState {
  playerId: string;
  arenaId: string; // The specific user's save game / arena
  ratings: PlayerFormatRating;
  formHistory: FormHistoryEntry[]; // Last N games recorded
  // Add reference to stats here if managed separately
}
