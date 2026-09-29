import { MatchContext, Player, MatchPhase } from "./types";
import { CaptainAI } from "../ai/captainAI";
import { BattingAI, BattingIntent } from "../ai/battingAI";
import { BowlingSelectionAI, BowlerProfile } from "../ai/bowlingSelectionAI";
import { MatchupEngine, DeliveryPlan } from "../simulation/matchupEngine";
import { ProbabilityEngine, DeliveryOutcome } from "../simulation/probabilityEngine";
import { CricketRules } from "../rules/types";
import { getRules } from "../rules/rulesEngine";

export class CricketEngine {
  private captainAI = new CaptainAI();
  private battingAI = new BattingAI();
  private bowlingSelectionAI = new BowlingSelectionAI();
  private matchupEngine = new MatchupEngine();
  private probabilityEngine = new ProbabilityEngine();

  public rules: CricketRules;

  constructor(format: "TEST" | "ODI" | "T20" | "IPL", season: number = new Date().getFullYear()) {
    this.rules = getRules(format, season);
  }

  /**
   * Initializes a fresh match context
   */
  public initContext(
    battingTeam: any, 
    bowlingTeam: any, 
    striker: Player, 
    nonStriker: Player, 
    bowler: Player
  ): MatchContext {
    return {
      format: this.rules.format,
      innings: 1,
      over: 0,
      ball: 0,
      score: 0,
      wickets: 0,
      currentRunRate: 0,
      wicketsRemaining: 10,
      battingTeam,
      bowlingTeam,
      striker,
      nonStriker,
      bowler,
      pitch: { deterioration: 0, moisture: 20, hardness: 80, footmarks: false },
      weather: { cloudCover: 10, humidity: 40, temperature: 28 },
      ballState: { ageOvers: 0, condition: 100, type: this.rules.ballRules.type },
      pressure: 20,
      phase: this.rules.powerplay ? "POWERPLAY" : "BUILDING"
    };
  }

  /**
   * Generates a basic bowling plan based on context and bowler profile.
   * In a fuller implementation, this could be its own AI class (BowlingPlanAI).
   */
  private generateBowlingPlan(context: MatchContext, bowler: BowlerProfile): DeliveryPlan {
    if (context.phase === "DEATH") {
      return { length: "YORKER", line: "STUMPS", variation: "NORMAL" };
    } else if (context.phase === "POWERPLAY") {
      return { length: "GOOD", line: "OUTSIDE_OFF", variation: "SWING" };
    }
    return { length: "GOOD", line: "OUTSIDE_OFF", variation: "NORMAL" };
  }

  /**
   * Simulates a single delivery and updates the match context
   */
  public simulateDelivery(context: MatchContext, availableBowlers: BowlerProfile[]): DeliveryOutcome {
    // 1. Captain evaluates strategy
    const strategy = this.captainAI.evaluateStrategy(context);

    // 2. Select Bowler (if new over)
    if (context.ball === 0) {
      const selectedBowler = this.bowlingSelectionAI.selectBowler(context, availableBowlers);
      // In a real app, you'd map BowlerProfile back to Player here
      // For now, we assume context.bowler is updated correctly by the caller.
    }

    // 3. Batting AI determines intent
    const intent = this.battingAI.determineIntent(context, strategy);

    // 4. Generate Bowling Plan
    // We map context.bowler to a dummy BowlerProfile for this simulation step
    const currentBowlerProfile: BowlerProfile = {
      playerId: context.bowler.id,
      bowlingRating: context.bowler.bowlingRating,
      pace: 80, swing: 70, seam: 60, spin: 0, accuracy: 85,
      powerplay: 80, middleOvers: 70, death: 85,
      againstLeftHander: 75, againstRightHander: 80,
      wicketTaking: 80, economy: 75, fatigue: context.bowler.fatigue,
      oversBowled: 0, oversRemaining: 4
    };

    const plan = this.generateBowlingPlan(context, currentBowlerProfile);

    // 5. Evaluate Matchup
    const matchupModifier = this.matchupEngine.evaluateMatchup(context, currentBowlerProfile, plan, intent);

    // 6. Probability Engine rolls for outcome
    const outcome = this.probabilityEngine.simulateDelivery(context, intent, plan, matchupModifier);

    // 7. Update match context based on outcome
    this.updateContext(context, outcome);

    return outcome;
  }

  private updateContext(context: MatchContext, outcome: DeliveryOutcome) {
    // Basic scorecard updates
    if (outcome === "WICKET") {
      context.wickets += 1;
      context.wicketsRemaining -= 1;
      context.ball += 1;
    } else if (outcome === "WIDE" || outcome === "NO_BALL") {
      context.score += 1; // Extras
      // Ball doesn't count
    } else {
      const runs = parseInt(outcome, 10);
      if (!isNaN(runs)) {
        context.score += runs;
      }
      context.ball += 1;
    }

    // Over completion
    if (context.ball === 6) {
      context.over += 1;
      context.ball = 0;
      context.ballState.ageOvers += 1;
      context.ballState.condition = Math.max(0, 100 - (context.ballState.ageOvers * 1.5));
    }

    // Run Rate calculation
    const totalBalls = (context.over * 6) + context.ball;
    if (totalBalls > 0) {
      context.currentRunRate = (context.score / totalBalls) * 6;
    }

    if (context.target) {
      const ballsRemaining = ((this.rules.maxOvers || 20) * 6) - totalBalls;
      const runsRequired = context.target - context.score;
      if (ballsRemaining > 0) {
        context.requiredRunRate = (runsRequired / ballsRemaining) * 6;
      }
    }

    // Phase Update (Simplified)
    if (this.rules.powerplay && context.over >= this.rules.powerplay.end) {
      context.phase = context.over >= ((this.rules.maxOvers || 20) - 5) ? "DEATH" : "MIDDLE_OVERS";
    }

    // Pitch Deterioration
    context.pitch.deterioration = Math.min(100, context.pitch.deterioration + 0.1);
  }
}
