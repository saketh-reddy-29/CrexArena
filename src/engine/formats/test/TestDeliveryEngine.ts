import { TestMatchContext } from './testTypes';
import { testBattingAI } from './testBattingAI';

export class TestDeliveryEngine {
  public simulateDelivery(context: TestMatchContext, batter: any, bowler: any): { runs: number, isWicket: boolean, extras: number } {
    // 1. Calculate base threat and risks
    const deliveryThreat = bowler.bowlingRating || 50;
    const batterTechniqueRisk = 100 - (batter.technique || 50);
    const batterConcentrationRisk = 100 - context.batterConcentration;
    
    // Pitch & ball condition
    const pitchMovement = context.pitchCondition + context.pitchDeterioration;
    const ballCondition = context.ballAge < 15 ? 80 : 30; // 80 threat for new ball, drops later
    
    // Intent risk (Aggressive intent increases risk)
    const intentNumeric = testBattingAI.decideIntent(context, batter, bowler); 
    const batterIntentRisk = intentNumeric; // 0 to 100 directly correlates to intent risk
    
    const fatigueRisk = context.batterFatigue;

    // 2. Wicket Probability Calculation
    let wicketRisk = (
      deliveryThreat * 0.25 +
      batterTechniqueRisk * 0.20 +
      batterConcentrationRisk * 0.15 +
      pitchMovement * 0.15 +
      ballCondition * 0.10 +
      batterIntentRisk * 0.10 +
      fatigueRisk * 0.05
    );

    // Calibrate wicket risk to cricket realities (around 1.5% - 4% per ball typically)
    // A base risk of 50/100 would map to ~2.5% chance.
    let wicketProbability = (wicketRisk / 100) * 0.05; 
    
    // Cap probabilities
    wicketProbability = Math.max(0.005, Math.min(0.12, wicketProbability));

    // 3. One Wicket Roll
    const roll = Math.random();
    
    if (roll < wicketProbability) {
      return { runs: 0, isWicket: true, extras: 0 };
    }

    // Generate Runs
    // Get shot selection based on batting intent
    const outcomes = testBattingAI.getShotSelection(intentNumeric);
    
    // Calculate run probability
    const runOutcome = this.selectWeightedOutcome(outcomes);
    
    // console.log(`Intent: ${intentNumeric} | Outcome: ${runOutcome.runs} | Total Weight: ${outcomes.reduce((s,o)=>s+o.weight,0)} | Fours Weight: ${outcomes.find(o=>o.runs===4)?.weight}`);
    
    return {
      runs: runOutcome.runs,
      isWicket: false,
      extras: 0 // Simplification for now
    };
  }

  private selectWeightedOutcome(outcomes: {runs: number, weight: number}[]): {runs: number, weight: number} {
    const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const outcome of outcomes) {
        roll -= outcome.weight;
        if (roll <= 0) return outcome;
    }
    return outcomes[0];
  }
}

export const testDeliveryEngine = new TestDeliveryEngine();
