import { CricketRules } from "../types";

export const odiRules: CricketRules = {
  format: "ODI",
  maxOvers: 50,
  inningsPerTeam: 1,
  maxPlayers: 11,
  maxBowlerOvers: 10,
  fieldingRestrictions: [
    { startOver: 1, endOver: 10, maxOutsideCircle: 2, catchersRequired: 2 },
    { startOver: 11, endOver: 40, maxOutsideCircle: 4 },
    { startOver: 41, endOver: 50, maxOutsideCircle: 5 }
  ],
  newBallRules: {
    initialBalls: 2 // Two new balls at the start of the innings
  },
  reviews: {
    perInnings: 2,
    retainedOnUmpireCall: true
  },
  ballRules: {
    type: "WHITE",
    manufacturer: "KOOKABURRA"
  }
};
