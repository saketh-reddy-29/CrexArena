import { Format } from "../rules/types";

export type MatchPhase = 
  | "POWERPLAY"
  | "MIDDLE_OVERS"
  | "DEATH"
  | "BUILDING"
  | "CONSOLIDATION"
  | "NEW_BALL"
  | "OLD_BALL"
  | "DECLARATION_PUSH";

export type Strategy = 
  | "ATTACK"
  | "BALANCED"
  | "DEFEND"
  | "CONTAIN"
  | "WICKET_HUNT"
  | "ACCELERATE"
  | "SURVIVE";

export interface PitchState {
  deterioration: number; // 0-100
  moisture: number; // 0-100
  hardness: number; // 0-100
  footmarks: boolean;
}

export interface WeatherState {
  cloudCover: number; // 0-100
  humidity: number; // 0-100
  temperature: number;
}

export interface BallState {
  ageOvers: number;
  condition: number; // 100 is new, 0 is heavily degraded
  type: "RED" | "WHITE" | "PINK";
}

// Basic stubs for Team and Player for the context
export interface Team {
  id: string;
  name: string;
  abbreviation: string;
}

export interface Player {
  id: string;
  name: string;
  battingRating: number;
  bowlingRating: number;
  fatigue: number; // 0-100
  form: number; // 0-100
  isLeftHandedBat: boolean;
  bowlingStyle: string;
}

export interface MatchContext {
  format: Format;
  innings: number;
  over: number;
  ball: number;
  score: number;
  wickets: number;
  target?: number;
  currentRunRate: number;
  requiredRunRate?: number;
  wicketsRemaining: number;
  battingTeam: Team;
  bowlingTeam: Team;
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  pitch: PitchState;
  weather: WeatherState;
  ballState: BallState;
  pressure: number; // 0-100
  phase: MatchPhase;
}
