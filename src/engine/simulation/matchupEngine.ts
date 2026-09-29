import { MatchContext } from "../core/types";
import { BattingIntent } from "../ai/battingAI";
import { BowlerProfile } from "../ai/bowlingSelectionAI";

export interface DeliveryPlan {
  length: "YORKER" | "FULL" | "GOOD" | "SHORT" | "BOUNCER";
  line: "OUTSIDE_OFF" | "STUMPS" | "DOWN_LEG" | "WIDE_OUTSIDE_OFF";
  variation: "NORMAL" | "SLOWER_BALL" | "GOOGLY" | "SWING" | "REVERSE_SWING";
}

export class MatchupEngine {
  /**
   * Calculates a matchup score between the bowler's plan and the batter's intent.
   * Returns a modifier (e.g. 0.8 to 1.2) that affects the final probability.
   */
  public evaluateMatchup(
    context: MatchContext, 
    bowlerProfile: BowlerProfile,
    plan: DeliveryPlan, 
    intent: BattingIntent
  ): number {
    let modifier = 1.0;

    // Example logic:
    if (intent === "ALL_OUT_ATTACK" && plan.length === "YORKER") {
      // Yorker is effective against all out attack
      modifier *= 0.8;
    }

    if (intent === "ALL_OUT_ATTACK" && plan.length === "FULL") {
      // Full toss / slot ball gets punished
      modifier *= 1.3;
    }

    if (context.pitch.deterioration > 60 && bowlerProfile.spin > 80 && plan.variation === "NORMAL") {
      // Spinner on a deteriorating pitch is harder to hit
      modifier *= 0.85;
    }

    return modifier;
  }
}
