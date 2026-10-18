import { CricketRules, Format } from "./types";
import { testRules } from "./test/testRules";
import { odiRules } from "./odi/odiRules";
import { t20Rules } from "./t20/t20Rules";
import { getIplRulesForSeason } from "./ipl/iplRules";

// ═══════════════════════════════════════════════════════════════════════════════
//  FORMAT ENGINE — the coarse-grained, season-stable format rules.
//
//  Two complementary rules models live here:
//   • getRules(format)  — the low-level ball/fielding rules (CricketRules) used by
//                         the fielding-restriction engine.
//   • RulesEngine       — the higher-level competition rules (FormatConfiguration)
//                         used by the competition / scheduling / match core.
// ═══════════════════════════════════════════════════════════════════════════════

export function getRules(format: Format, season: number = new Date().getFullYear()): CricketRules {
  switch (format) {
    case "TEST":
      return testRules;
    case "ODI":
      return odiRules;
    case "T20":
      return t20Rules;
    case "IPL":
      // IPL honours the configured competition season — franchise conditions
      // are not assumed identical every year.
      return getIplRulesForSeason(season);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export type FormatType = 'IPL' | 'T20' | 'ODI' | 'TEST';

export interface SquadRules {
  minSize: number;
  maxSize: number;
  maxOverseasInXI: number;
  auction: boolean;
  impactPlayer: boolean;
  league: boolean;
}

export interface InningsRules {
  maxInnings: number;
  oversPerInnings: number | null; // null for Test
  powerplayEnabled: boolean;
  followOn: boolean;
  declaration: boolean;
}

export interface MatchRules {
  playingXI: number;
  ballPolicy: {
    ballsAtStart: number;
    ballsForFinal16Overs?: number; // E.g. modern ODI rules
  };
  draw: boolean;
  tieBreaker: 'NRR' | 'SUPER_OVER' | 'NONE';
}

export interface PointsRules {
  win: number;
  loss: number;
  draw: number;
  tie: number;
  noResult: number;
}

export interface FormatConfiguration {
  type: FormatType;
  squad: SquadRules;
  innings: InningsRules;
  match: MatchRules;
  points: PointsRules;
}

export class RulesEngine {
  private config: FormatConfiguration;

  constructor(config: FormatConfiguration) {
    this.config = config;
  }

  // Squad Rules
  getMinSquadSize() { return this.config.squad.minSize; }
  getMaxSquadSize() { return this.config.squad.maxSize; }
  getMaxOverseasPlayersInXI() { return this.config.squad.maxOverseasInXI; }
  hasAuction() { return this.config.squad.auction; }
  hasImpactPlayer() { return this.config.squad.impactPlayer; }
  isLeague() { return this.config.squad.league; }

  // Innings Rules
  getMaxInnings() { return this.config.innings.maxInnings; }
  getMaxOvers() { return this.config.innings.oversPerInnings; }
  isPowerplayEnabled() { return this.config.innings.powerplayEnabled; }
  canFollowOn() { return this.config.innings.followOn; }
  canDeclare() { return this.config.innings.declaration; }

  // Match Rules
  getPlayingXISize() { return this.config.match.playingXI; }
  getBallPolicy() { return this.config.match.ballPolicy; }
  canDraw() { return this.config.match.draw; }
  getTieBreaker() { return this.config.match.tieBreaker; }

  // Points Rules
  getPointsForWin() { return this.config.points.win; }
  getPointsForLoss() { return this.config.points.loss; }
  getPointsForDraw() { return this.config.points.draw; }
  getPointsForTie() { return this.config.points.tie; }
  getPointsForNoResult() { return this.config.points.noResult; }

  // Expose full config if needed
  getConfig() { return this.config; }
}
