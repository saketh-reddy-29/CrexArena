import { RulesEngine } from '../rules/RulesEngine';

export class MatchSituationEngine {
  private rules: RulesEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
  }

  calculatePressure(context: any) {
    const { inningsState, target, matchState } = context;
    const format = this.rules.getConfig().type;
    
    let pressure = 50; // Base pressure out of 100

    if (format !== 'TEST') {
      const maxBalls = this.rules.getMaxOvers()! * 6;
      const ballsRemaining = maxBalls - inningsState.balls;
      const wicketsRemaining = 10 - inningsState.wickets;

      if (target) {
        const requiredRuns = target - inningsState.runs;
        const requiredRunRate = (requiredRuns / ballsRemaining) * 6;
        
        // Pressure increases if RRR is high
        if (requiredRunRate > 10) pressure += 20;
        else if (requiredRunRate > 8) pressure += 10;
        
        // Pressure increases if wickets are low
        if (wicketsRemaining < 4) pressure += 20;
      } else {
        // Setting a target
        if (wicketsRemaining < 4) pressure += 15;
        if (ballsRemaining < 30) pressure -= 10; // Free hit mode at death if wickets in hand
      }
    } else {
      // Test match pressure logic (draw probability, lead/deficit, time remaining)
      if (inningsState.wickets > 7) pressure += 15;
    }

    return Math.max(0, Math.min(100, pressure));
  }
}
