import { RulesEngine } from '../rules/RulesEngine';
import { MatchSituationEngine } from './MatchSituationEngine';

export class DeliveryEngine {
  private rules: RulesEngine;
  private situationEngine: MatchSituationEngine;

  constructor(rules: RulesEngine, situationEngine: MatchSituationEngine) {
    this.rules = rules;
    this.situationEngine = situationEngine;
  }

  simulateDelivery(context: any) {
    const { batter, bowler, inningsState, target, matchState } = context;
    
    // 1. Calculate Situation & Pressure
    const pressure = this.situationEngine.calculatePressure(context);

    // 2. Base Abilities
    // Weights are slightly affected by format via the rating itself, but here is a base formula
    const battingPower = (batter.power * 0.25) + (batter.timing * 0.25) + (batter.strikeRate * 0.20) + (batter.form * 0.15) + (batter.formatRating * 0.15);
    const bowlingPressure = (bowler.accuracy * 0.25) + (bowler.variation * 0.20) + (bowler.paceOrSpin * 0.20) + (bowler.form * 0.15) + (bowler.formatRating * 0.20);
    
    // 3. Advantage calculation (-100 to +100 roughly)
    const advantage = battingPower - bowlingPressure;
    
    // 4. Adjust risk profile based on pressure and format
    const format = this.rules.getConfig().type;
    let riskTaking = 50; // Base 50
    
    if (format === 'T20' || format === 'IPL') {
      const maxBalls = this.rules.getMaxOvers()! * 6;
      if (inningsState.balls > maxBalls * 0.75) {
        // Death overs
        riskTaking += 30;
      }
      if (target && target - inningsState.runs > (maxBalls - inningsState.balls) * 1.5) {
        // High RRR
        riskTaking += 25;
      }
    } else if (format === 'TEST') {
      // Much lower base risk taking in Tests
      riskTaking = 20; 
      if (pressure > 60) riskTaking -= 10; // Protect wicket
    }

    // 5. Generate Outcome Probabilities
    // Controlled Randomness
    const randomFactor = Math.random() * 100;
    
    let isWicket = false;
    let runs = 0;
    let extras = 0;

    // High bowling pressure + batter taking high risk = Higher wicket probability
    const wicketThreshold = Math.max(5, (bowlingPressure / 10) + (riskTaking / 10) - (battingPower / 10));

    if (randomFactor < wicketThreshold) {
      isWicket = true;
    } else {
      // Calculate runs based on batting advantage and risk taking
      const scoringValue = randomFactor + advantage + (riskTaking / 2);
      
      if (scoringValue > 140) runs = 6;
      else if (scoringValue > 110) runs = 4;
      else if (scoringValue > 90) runs = 3;
      else if (scoringValue > 70) runs = 2;
      else if (scoringValue > 40) runs = 1;
      else runs = 0;
    }

    return {
      runs,
      extras,
      isWicket,
      wicketType: isWicket ? this.determineWicketType(bowler) : null,
      batterId: batter.id,
      bowlerId: bowler.id
    };
  }

  private determineWicketType(bowler: any) {
    const rand = Math.random();
    if (rand < 0.20) return 'BOWLED';
    if (rand < 0.35) return 'LBW';
    if (rand < 0.85) return 'CAUGHT';
    if (rand < 0.90) return 'RUN_OUT';
    return 'STUMPED';
  }
}
