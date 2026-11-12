import { PitchType, WeatherCondition, TossDecision } from './match';

export type MatchSaveStatus = 
  | 'SAVING...' 
  | 'ALL PROGRESS SAVED' 
  | 'OFFLINE — LOCAL BACKUP ACTIVE' 
  | 'SAVE FAILED — RETRYING' 
  | 'IDLE';

export interface DeliveryLogRecord {
  ball: string;
  batterId: string;
  bowlerId: string;
  isLegal: boolean;
  isWicket: boolean;
  outcome: string;
  over: number;
  runs: number;
  deliveryId?: string;
}

export interface MatchCheckpoint {
  version: number;
  matchId: string;
  fixtureId: string;
  arenaId: string;
  seasonId?: number | string;
  format: string; // 'T20' | 'ODI' | 'TEST'
  timestamp: string; // ISO 8601
  savedAt: number; // Unix ms
  
  // Teams and Squad details
  team1Id: string;
  team2Id: string;
  team1Name: string;
  team2Name: string;
  team1ShortName?: string;
  team2ShortName?: string;
  playingXIIds: string[];
  selectedSquadIds: string[];
  
  // Toss & Conditions
  toss: { winnerId: string; decision: TossDecision } | null;
  pitch: PitchType;
  weather: WeatherCondition;
  conditions?: any;
  
  // Match & Innings Progression
  inningNo: number;
  innings: any[];
  isMatchOver: boolean;
  resultSubmitted: boolean;
  matchTarget?: number;
  
  // Active On-Field State
  strikerId: string | null;
  nonStrikerId: string | null;
  bowlerId: string | null;
  lastOverBowlerId: string | null;
  battingCursor: number;
  pending: 'openers' | 'batter' | 'bowler' | null;
  pendingBatterEnd: 'striker' | 'non-striker';
  queueBowlerAfterBatter?: boolean;
  
  // Scoreboard Snapshot
  currentRuns: number;
  currentWickets: number;
  currentBalls: number;
  oversFormatted: string; // e.g. "14.2"
  strikerName?: string;
  strikerRuns?: number;
  strikerBalls?: number;
  nonStrikerName?: string;
  nonStrikerRuns?: number;
  nonStrikerBalls?: number;
  bowlerName?: string;
  bowlerOvers?: string;
  bowlerRuns?: number;
  bowlerWickets?: number;
  
  // Field Formation
  fieldPresetKey: string | null;
  liveFieldConfiguration?: any;
  
  // Authoritative Delivery & Idempotency Tracking
  lastCompletedDeliveryId: string | null;
  lastCommittedDeliveryId: string | null;
  committedDeliveryIds: string[]; // Set of all delivery IDs processed in this match
  
  // Engine and Lifecycle State
  ballLifecycleState?: string;
  recentBalls?: string[];
  last6Deliveries?: string[];
}
