import { FormatType } from '../rules/RulesEngine';

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

export interface ArenaPlayerState {
  id: string; // Composite: arenaId_playerId
  arenaId: string;
  playerId: string; // Refers to the Global Player

  baseRating: number;
  currentRating: number;
  formRating: number;

  battingRating: number;
  bowlingRating: number;
  fieldingRating: number;

  // Arena Career Stats
  matches: number;
  runs: number;
  wickets: number;
  catches: number;
  stumpings: number;

  createdAt: number;
  updatedAt: number;
}

export interface PlayerMatchStats {
  id: string;
  matchId: string;
  arenaId: string;
  playerId: string;
  seasonId: string;

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

  // Progression tracking
  performanceScore: number;
  ratingDelta: number;
  oldRating: number;
  newRating: number;
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
