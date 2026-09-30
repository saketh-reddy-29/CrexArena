export enum TestSession {
  MORNING = "MORNING",
  AFTERNOON = "AFTERNOON",
  EVENING = "EVENING"
}

export type InningsStatus = "NOT_STARTED" | "IN_PROGRESS" | "DECLARED" | "ALL_OUT" | "COMPLETED";
export type TestResult = "TEAM_1_WIN" | "TEAM_2_WIN" | "DRAW" | "TIE" | "IN_PROGRESS";
export type BattingIntent = "SURVIVAL" | "DEFENSIVE" | "SETTLING" | "NORMAL" | "CONTROLLED_ATTACK" | "ACCELERATE";

export interface WeatherState {
  condition: "SUNNY" | "CLOUDY" | "OVERCAST" | "RAIN";
  lightLevel: number;
}

export interface PitchState {
  pace: number;
  bounce: number;
  seam: number;
  swing: number;
  spin: number;
  deterioration: number;
  roughness: number;
}

export interface BallState {
  inningsBallAge: number;
  oversSinceNewBall: number;
  isNewBall: boolean;
}

export interface BowlingSpell {
  bowlerId: string;
  oversInSpell: number;
  totalOvers: number;
  fatigue: number;
  wickets: number;
}

export interface TestMatchState {
  day: number;
  session: TestSession;
  inningsNumber: 1 | 2 | 3 | 4;
  inningsStatus: InningsStatus;
  score: number;
  wickets: number;
  overs: number;
  balls: number;
  timeRemaining: number;
  oversToday: number;
  weather: WeatherState;
  pitch: PitchState;
  ball: BallState;
  result: TestResult;
  target?: number;
  team1Score: number;
  team2Score: number;
  team1Name: string;
  team2Name: string;
  currentBattingTeam: string;
  currentBowlingTeam: string;
}
