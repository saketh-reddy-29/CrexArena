import { CricketRules } from "../types";

export const t20Rules: CricketRules = {
  format: "T20",
  maxOvers: 20,
  inningsPerTeam: 1,
  maxPlayers: 11,
  maxBowlerOvers: 4,
  powerplay: {
    start: 1,
    end: 6
  },
  fieldingRestrictions: [
    { startOver: 1, endOver: 6, maxOutsideCircle: 2 },
    { startOver: 7, endOver: 20, maxOutsideCircle: 5 }
  ],
  maxLegSideFielders: 5,
  superOver: true,
  reviews: {
    perInnings: 2,
    retainedOnUmpireCall: true
  },
  ballRules: {
    type: "WHITE",
    manufacturer: "KOOKABURRA"
  }
};
