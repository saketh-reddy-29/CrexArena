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
   * Single authoritative simulation step with bounded probabilities.
   */
  public simulateDelivery(
    context: MatchContext, 
    intent: BattingIntent, 
    plan: DeliveryPlan, 
    matchupModifier: number
  ): DeliveryOutcome {
    const isTest = context.format === "TEST";
    const isODI = context.format === "ODI";

    // Base probabilities based on intent and format
    let probabilities = this.getBaseProbabilities(intent, isTest, isODI);

    // Safe fallbacks for attributes
    const strikerRating = typeof context.striker?.battingRating === 'number' && Number.isFinite(context.striker.battingRating) ? context.striker.battingRating : 60;
    const strikerForm = typeof context.striker?.form === 'number' && Number.isFinite(context.striker.form) ? context.striker.form : 75;
    const bowlerRating = typeof context.bowler?.bowlingRating === 'number' && Number.isFinite(context.bowler.bowlingRating) ? context.bowler.bowlingRating : 60;
    const bowlerForm = typeof context.bowler?.form === 'number' && Number.isFinite(context.bowler.form) ? context.bowler.form : 75;
    const safeModifier = typeof matchupModifier === 'number' && Number.isFinite(matchupModifier) && matchupModifier > 0 ? matchupModifier : 1.0;

    const battingPower = strikerRating * safeModifier * (strikerForm / 100);
    const bowlingPower = bowlerRating * (1 / safeModifier) * (bowlerForm / 100);

    // Bounded advantage scale: -0.35 to +0.35
    const advantage = Math.min(0.35, Math.max(-0.35, (battingPower - bowlingPower) / 100));

    // Adjust boundaries and wickets smoothly based on bounded advantage
    if (advantage > 0) {
      probabilities["4"] += (advantage * 12);
      probabilities["6"] += (advantage * 8);
      probabilities["WICKET"] = Math.max(0.6, probabilities["WICKET"] - (advantage * 3));
      probabilities["0"] = Math.max(10, probabilities["0"] - (advantage * 10));
    } else {
      const absAdv = Math.abs(advantage);
      probabilities["WICKET"] = Math.min(10, probabilities["WICKET"] + (absAdv * 4));
      probabilities["0"] += (absAdv * 15);
      probabilities["4"] = Math.max(1, probabilities["4"] - (absAdv * 6));
      probabilities["6"] = Math.max(0.2, probabilities["6"] - (absAdv * 4));
    }

    // Normalize probabilities safely
    const total = Object.values(probabilities).reduce((sum, val) => sum + (Number.isFinite(val) ? Math.max(0, val) : 0), 0);
    if (total <= 0) return "0";

    // Roll the dice
    let roll = Math.random() * total;
    for (const [outcome, prob] of Object.entries(probabilities)) {
      const p = Math.max(0, prob);
      roll -= p;
      if (roll <= 0) {
        return outcome as DeliveryOutcome;
      }
    }
    
    return "0"; // Safe fallback
  }

  private getBaseProbabilities(intent: BattingIntent, isTest: boolean, isODI: boolean): Record<string, number> {
    const wicketFactor = isTest ? 0.6 : isODI ? 0.85 : 1.0;

    switch (intent) {
      case "DEFENSIVE":
        return { "0": 74, "1": 16, "2": 4, "3": 1, "4": 3, "6": 0, "WICKET": 1.4 * wicketFactor, "WIDE": 1.5, "NO_BALL": 0.8 };
      case "ROTATE":
        return { "0": 42, "1": 44, "2": 8, "3": 2, "4": 3, "6": 0.5, "WICKET": 2.0 * wicketFactor, "WIDE": 1.8, "NO_BALL": 0.8 };
      case "BALANCED":
        return { "0": 34, "1": 38, "2": 11, "3": 2, "4": 11, "6": 2.5, "WICKET": 2.8 * wicketFactor, "WIDE": 2.0, "NO_BALL": 1.0 };
      case "AGGRESSIVE":
        return { "0": 24, "1": 26, "2": 9, "3": 2, "4": 22, "6": 12, "WICKET": 4.8 * wicketFactor, "WIDE": 2.5, "NO_BALL": 1.0 };
      case "ALL_OUT_ATTACK":
        return { "0": 18, "1": 18, "2": 7, "3": 1, "4": 28, "6": 19, "WICKET": 7.5 * wicketFactor, "WIDE": 3.0, "NO_BALL": 1.2 };
    }
  }
}
