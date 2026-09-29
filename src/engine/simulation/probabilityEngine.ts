import { MatchContext } from "../core/types";
import { BattingIntent } from "../ai/battingAI";
import { DeliveryPlan } from "./matchupEngine";

export type DeliveryOutcome = 
  | "0" | "1" | "2" | "3" | "4" | "6" 
  | "WICKET" 
  | "WIDE" | "NO_BALL" | "LEG_BYE" | "BYE";

export class ProbabilityEngine {
  /**
   * Simulates a delivery based on context, intent, and matchup modifier.
   * This is where randomness decides the final outcome.
   */
  public simulateDelivery(
    context: MatchContext, 
    intent: BattingIntent, 
    plan: DeliveryPlan, 
    matchupModifier: number
  ): DeliveryOutcome {
    // Base probabilities based on intent
    let probabilities = this.getBaseProbabilities(intent);

    // Adjust probabilities using matchupModifier and player ratings
    // (A rating of 90 * modifier 1.2 makes positive outcomes much more likely)
    const formFactor = (context.striker.form / 100);
    const battingPower = context.striker.battingRating * matchupModifier * formFactor;
    const bowlingPower = context.bowler.bowlingRating * (1 / matchupModifier) * (context.bowler.form / 100);

    const advantage = battingPower - bowlingPower; // Can be negative

    // Adjust boundaries and wickets based on advantage
    if (advantage > 0) {
      probabilities["4"] += (advantage * 0.1);
      probabilities["6"] += (advantage * 0.05);
      probabilities["WICKET"] = Math.max(1, probabilities["WICKET"] - (advantage * 0.05));
    } else {
      probabilities["WICKET"] += (Math.abs(advantage) * 0.1);
      probabilities["0"] += (Math.abs(advantage) * 0.1);
      probabilities["4"] = Math.max(1, probabilities["4"] - (Math.abs(advantage) * 0.05));
      probabilities["6"] = Math.max(0.1, probabilities["6"] - (Math.abs(advantage) * 0.05));
    }

    // Normalize probabilities
    const total = Object.values(probabilities).reduce((sum, val) => sum + val, 0);
    
    // Roll the dice
    let roll = Math.random() * total;
    for (const [outcome, prob] of Object.entries(probabilities)) {
      roll -= prob;
      if (roll <= 0) {
        return outcome as DeliveryOutcome;
      }
    }
    
    return "0"; // Fallback
  }

  private getBaseProbabilities(intent: BattingIntent): Record<string, number> {
    switch (intent) {
      case "DEFENSIVE":
        return { "0": 70, "1": 15, "2": 5, "3": 1, "4": 4, "6": 0, "WICKET": 5, "WIDE": 2, "NO_BALL": 1 };
      case "ROTATE":
        return { "0": 40, "1": 45, "2": 10, "3": 2, "4": 5, "6": 1, "WICKET": 4, "WIDE": 2, "NO_BALL": 1 };
      case "BALANCED":
        return { "0": 30, "1": 40, "2": 10, "3": 2, "4": 12, "6": 3, "WICKET": 5, "WIDE": 2, "NO_BALL": 1 };
      case "AGGRESSIVE":
        return { "0": 20, "1": 30, "2": 10, "3": 2, "4": 20, "6": 10, "WICKET": 10, "WIDE": 3, "NO_BALL": 1 };
      case "ALL_OUT_ATTACK":
        return { "0": 15, "1": 15, "2": 5, "3": 1, "4": 25, "6": 20, "WICKET": 20, "WIDE": 4, "NO_BALL": 1 };
    }
  }
}
