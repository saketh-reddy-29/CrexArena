import { CricketRules } from "../types";

export const testRules: CricketRules = {
  format: "TEST",
  inningsPerTeam: 2,
  maxPlayers: 11,
  followOn: true,
  followOnMargin: 200,
  declaration: true,
  reviews: {
    perInnings: 3,
    retainedOnUmpireCall: true
  },
  newBallRules: {
    availableAfterOvers: 80,
    initialBalls: 1
  },
  ballRules: {
    type: "RED",
    manufacturer: "SG" // Or DUKE / KOOKABURRA depending on country, can be overridden by Match configuration
  }
};
