import { MatchContext, Strategy } from "../core/types";

export class CaptainAI {
  /**
   * The CaptainAI runs periodically (e.g., end of over, fall of wicket)
   * to determine the overall team strategy based on MatchContext.
   */
  public evaluateStrategy(context: MatchContext): Strategy {
    if (context.format === "TEST") {
      return this.evaluateTestStrategy(context);
    } else if (context.format === "T20" || context.format === "IPL") {
      return this.evaluateT20Strategy(context);
    } else {
      return this.evaluateODIStrategy(context);
    }
  }

  private evaluateT20Strategy(context: MatchContext): Strategy {
    // T20 specific logic
    if (context.wicketsRemaining <= 3 && context.over < 15) {
      return "SURVIVE";
    }

    if (context.requiredRunRate && context.requiredRunRate > 10) {
      return "ACCELERATE";
    }

    if (context.phase === "DEATH") {
      return context.innings === 1 ? "ACCELERATE" : (context.requiredRunRate && context.requiredRunRate > 8 ? "ACCELERATE" : "ATTACK");
    }

    if (context.phase === "POWERPLAY") {
      return "ATTACK";
    }

    return "BALANCED";
  }

  private evaluateODIStrategy(context: MatchContext): Strategy {
    if (context.wicketsRemaining <= 4 && context.over < 40) {
      return "SURVIVE";
    }
    
    if (context.phase === "POWERPLAY") {
      return "BALANCED";
    }

    if (context.phase === "DEATH" || context.over > 40) {
      return "ACCELERATE";
    }

    return "BUILDING";
  }

  private evaluateTestStrategy(context: MatchContext): Strategy {
    // Test matches are highly dependent on the day, session, lead/deficit.
    // Simplified representation:
    if (context.wicketsRemaining <= 2) {
      return "SURVIVE";
    }
    
    if (context.ballState.ageOvers < 10) {
      return "SURVIVE"; // Respect the new ball
    }

    if (context.innings === 3 && context.score > 300) {
      return "DECLARATION_PUSH";
    }

    if (context.innings === 4 && context.target && context.score < context.target) {
      const runsNeeded = context.target - context.score;
      if (runsNeeded < 50) return "ATTACK";
      if (context.wicketsRemaining < 4) return "SURVIVE";
    }

    return "BUILDING";
  }
}
