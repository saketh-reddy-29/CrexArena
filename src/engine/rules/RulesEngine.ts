import { CricketRules, Format } from "./types";
import { testRules } from "./test/testRules";
import { odiRules } from "./odi/odiRules";
import { t20Rules } from "./t20/t20Rules";
import { iplRules } from "./ipl/iplRules";

export function getRules(format: Format, season: number = new Date().getFullYear()): CricketRules {
  // In a real application, you might fetch different rules based on the season.
  // For now, we return the current defined rules.
  switch (format) {
    case "TEST":
      return testRules;
    case "ODI":
      return odiRules;
    case "T20":
      return t20Rules;
    case "IPL":
      return iplRules;
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}
