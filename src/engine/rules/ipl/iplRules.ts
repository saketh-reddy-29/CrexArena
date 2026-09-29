import { CricketRules } from "../types";
import { t20Rules } from "../t20/t20Rules";

export const iplRules: CricketRules = {
  ...t20Rules,
  format: "IPL",
  impactPlayer: true,
  reviews: {
    perInnings: 2,
    retainedOnUmpireCall: true
  }
  // Any specific IPL deviations from generic T20 can go here
};
