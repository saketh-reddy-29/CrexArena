import { TestMatchContext } from './testTypes';
import { testBattingAI } from './testBattingAI';
import { safeNumber, safeRating, safeProbability } from '../../utils/safeMath';

export class TestDeliveryEngine {
  public simulateDelivery(context: TestMatchContext, batter: any, bowler: any): { runs: number; isWicket: boolean; extras: number } {
    const ballsFaced = safeNumber(context?.batterBallsFaced ?? batter?.ballsFaced, 0);
    const settledness = testBattingAI.calculateSettledness(ballsFaced);

    // 1. Calculate base threat and risks
    const deliveryThreat = safeRating(bowler.bowlingRating || bowler.rating || 50);
    const batterTechniqueRisk = 100 - safeRating(batter.technique || batter.rating || 50);
    const batterConcentrationRisk = 100 - safeNumber(context.batterConcentration, 75);
    
    // Pitch & ball condition
    const pitchMovement = safeNumber(context.pitchCondition, 20) + safeNumber(context.pitchDeterioration, 10);
    const ballCondition = context.ballAge < 15 ? 80 : 30; // High threat for new ball
    
    // Intent calculation
    const intentNumeric = testBattingAI.decideIntent(context, batter, bowler); 
    const batterIntentRisk = intentNumeric;
    const fatigueRisk = safeNumber(context.batterFatigue, 0);

    // Bowler memory adaptation reduction
    let memoryAdaptationBonus = 0;
    if (batter?.testMemory && bowler?.id && batter.testMemory[bowler.id]) {
      memoryAdaptationBonus = safeNumber(batter.testMemory[bowler.id].adaptationLevel, 0) * 0.15;
    }

    // 2. Wicket Probability Calculation
    const baseWicketRisk = (
      deliveryThreat * 0.25 +
      batterTechniqueRisk * 0.20 +
      batterConcentrationRisk * 0.15 +
      pitchMovement * 0.15 +
      ballCondition * 0.10 +
      batterIntentRisk * 0.10 +
      fatigueRisk * 0.05
    );

    // Settledness significantly stabilizes the batter without making them invincible
    const settlednessMultiplier = Math.max(0.40, 1 - (settledness * 0.0055)); // Up to ~55% reduction at 100 settledness
    
    let wicketRisk = baseWicketRisk * settlednessMultiplier - memoryAdaptationBonus;
    wicketRisk = Math.max(5, wicketRisk);

    // Calibrate wicket probability (typically 1.5% to 4% per delivery in Tests)
    let wicketProbability = (wicketRisk / 100) * 0.045; 
    wicketProbability = safeProbability(wicketProbability, 0.005, 0.10);

    // 3. Wicket Roll
    const roll = Math.random();
    if (roll < wicketProbability) {
      return { runs: 0, isWicket: true, extras: 0 };
    }

    // 4. Generate Runs from Intent Shot Selection
    const outcomes = testBattingAI.getShotSelection(intentNumeric);
    const runOutcome = this.selectWeightedOutcome(outcomes);
    
    return {
      runs: runOutcome.runs,
      isWicket: false,
      extras: 0
    };
  }

  private selectWeightedOutcome(outcomes: { runs: number; weight: number }[]): { runs: number; weight: number } {
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
