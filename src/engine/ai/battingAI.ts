import { MatchContext, Strategy } from "../core/types";

export type BattingIntent = "DEFENSIVE" | "ROTATE" | "BALANCED" | "AGGRESSIVE" | "ALL_OUT_ATTACK";

export class BattingAI {
  public determineIntent(context: MatchContext, teamStrategy: Strategy): BattingIntent {
    if (teamStrategy === "SURVIVE") {
      return "DEFENSIVE";
    }
    
    if (teamStrategy === "ACCELERATE" || teamStrategy === "DECLARATION_PUSH") {
      // Very aggressive intent
      if (context.striker.battingRating > 80 && context.striker.form > 70) {
        return "ALL_OUT_ATTACK";
      }
      return "AGGRESSIVE";
    }

    if (teamStrategy === "ATTACK") {
      return "AGGRESSIVE";
    }

    if (teamStrategy === "BUILDING" || teamStrategy === "CONSOLIDATION") {
      return "ROTATE";
    }

    return "BALANCED";
  }
}
