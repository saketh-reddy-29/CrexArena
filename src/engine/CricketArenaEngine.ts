import { RulesEngine, FormatType } from './rules/RulesEngine';
import { getRulesEngineForFormat } from './rules/FormatRules';
import { MatchEngine } from './core/MatchEngine';
import { CompetitionEngine } from './competition/CompetitionEngine';
import { MatchTransactionPipeline } from './core/MatchTransactionPipeline';

export class CricketArenaEngine {
  private format: FormatType;
  private rules: RulesEngine;
  private matchEngine: MatchEngine;
  private competitionEngine: CompetitionEngine;
  private transactionPipeline: MatchTransactionPipeline;

  constructor(format: FormatType) {
    this.format = format;
    this.rules = getRulesEngineForFormat(format);
    
    // Initialize core sub-engines based on format rules
    this.matchEngine = new MatchEngine(this.rules);
    this.competitionEngine = new CompetitionEngine(this.rules);
    this.transactionPipeline = new MatchTransactionPipeline(this.rules);
  }

  getRules() {
    return this.rules;
  }

  getMatchEngine() {
    return this.matchEngine;
  }

  getCompetitionEngine() {
    return this.competitionEngine;
  }

  getTransactionPipeline() {
    return this.transactionPipeline;
  }

  // Lifecycle methods
  startNewCompetition(teams: any[]) {
    return this.competitionEngine.initialize(teams);
  }

  playMatch(teamA: any, teamB: any) {
    return this.matchEngine.simulateMatch(teamA, teamB);
  }
}
