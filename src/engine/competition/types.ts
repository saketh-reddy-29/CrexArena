export type CompetitionFormat = "TEST" | "ODI" | "T20" | "IPL";
export type StageType = "GROUP" | "SUPER_STAGE" | "SEMI_FINAL" | "FINAL" | "LEAGUE" | "PLAYOFF";

export interface CompetitionStage {
  type: StageType;
  teamsCount: number;
}

export interface PointsSystem {
  win: number;
  loss: number;
  tie: number;
  noResult: number;
  bonus?: number; // e.g. for NRR margin
}

export interface Competition {
  id: string;
  name: string;
  format: CompetitionFormat;
  type: "LEAGUE" | "KNOCKOUT" | "SERIES" | "CHAMPIONSHIP" | "WORLD_CUP";
  teams: string[]; // Team IDs
  stages: CompetitionStage[];
  pointsSystem: PointsSystem;
}

export interface Fixture {
  id: string;
  competitionId: string;
  stageType: StageType;
  homeTeamId: string;
  awayTeamId: string;
  matchDate?: Date;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
  winnerId?: string;
}

export interface StandingsEntry {
  competitionId: string;
  teamId: string;
  played: number;
  won: number;
  lost: number;
  draw: number;
  tie: number;
  noResult: number;
  points: number;
  runsFor: number;
  oversFor: number;
  runsAgainst: number;
  oversAgainst: number;
  nrr: number;
}
