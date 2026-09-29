export type Format = "TEST" | "ODI" | "T20" | "IPL";

export interface FieldingRestriction {
  startOver: number;
  endOver: number;
  maxOutsideCircle: number;
  catchersRequired?: number;
}

export interface NewBallRules {
  availableAfterOvers?: number;
  mandatoryAfterOvers?: number;
  initialBalls?: number;
}

export interface ReviewRules {
  perInnings: number;
  retainedOnUmpireCall: boolean;
}

export interface BallRules {
  type: "RED" | "WHITE" | "PINK";
  manufacturer?: "SG" | "KOOKABURRA" | "DUKES";
}

export interface CricketRules {
  format: Format;
  maxOvers?: number;
  inningsPerTeam: number;
  maxPlayers: number;
  maxBowlerOvers?: number;
  powerplay?: {
    start: number;
    end: number;
  };
  fieldingRestrictions?: FieldingRestriction[];
  newBallRules?: NewBallRules;
  followOn?: boolean;
  followOnMargin?: number;
  declaration?: boolean;
  superOver?: boolean;
  impactPlayer?: boolean;
  reviews?: ReviewRules;
  ballRules: BallRules;
}
