import { ArenaPlayerState, FormatAttributes, MatchPerformanceSummary, FormHistoryEntry } from "./types";
import { Format } from "../rules/types";

export class ProgressionEngine {
  /**
   * Evaluates match performance, updates form (fast-moving), and attributes (slow-moving)
   */
  public processMatchPerformance(
    playerState: ArenaPlayerState,
    matchId: string,
    format: "TEST" | "ODI" | "T20" | "IPL",
    performance: MatchPerformanceSummary
  ): ArenaPlayerState {
    const currentAttributes = this.getFormatAttributes(playerState, format);
    
    // 1. Calculate a raw performance score (0 to 100 scale ideally)
    const performanceScore = this.calculatePerformanceScore(performance, format);
    
    // 2. Update Form (Fast moving)
    // newForm = oldForm * 0.80 + performanceScore * 0.20;
    const oldForm = currentAttributes.form;
    const newForm = Math.min(100, Math.max(0, (oldForm * 0.80) + (performanceScore * 0.20)));
    
    // 3. Update Rating (Slow moving)
    // ratingDelta = clamp( (performanceScore - expectedScore) * 0.03, -0.30, +0.30 )
    // Let's assume expected score revolves around their current overall rating
    const expectedScore = currentAttributes.overall;
    const rawDelta = (performanceScore - expectedScore) * 0.03;
    const ratingDelta = this.clamp(rawDelta, -0.30, 0.30);
    
    const newOverall = Math.min(100, Math.max(1, currentAttributes.overall + ratingDelta));
    
    // 4. Create History Entry
    const historyEntry: FormHistoryEntry = {
      matchId,
      format,
      performanceScore: Math.round(performanceScore),
      formBefore: Math.round(oldForm),
      formAfter: Math.round(newForm),
      date: new Date()
    };
    
    // Maintain only the last 5 games as requested
    const updatedHistory = [historyEntry, ...playerState.formHistory].slice(0, 5);
    
    // 5. Apply Updates
    const updatedAttributes = {
      ...currentAttributes,
      form: newForm,
      overall: newOverall,
      // You could also specifically target batting/bowling attributes based on performance
      batting: performance.runsScored > 0 ? Math.min(100, currentAttributes.batting + ratingDelta) : currentAttributes.batting
    };
    
    return this.updateFormatAttributes(playerState, format, updatedAttributes, updatedHistory);
  }

  private calculatePerformanceScore(perf: MatchPerformanceSummary, format: string): number {
    let score = 50; // Base baseline
    
    // Very simplified scoring mechanism:
    // Batting
    score += (perf.runsScored * 0.5);
    if (perf.ballsFaced > 0) {
      const sr = (perf.runsScored / perf.ballsFaced) * 100;
      if (sr > 150 && format !== "TEST") score += 10;
      if (sr < 100 && format !== "TEST") score -= 5;
    }
    
    // Bowling
    score += (perf.wicketsTaken * 10);
    if (perf.oversBowled > 0) {
      const econ = perf.runsConceded / perf.oversBowled;
      if (econ < 6.0) score += 5;
      if (econ > 10.0) score -= 5;
    }
    
    // Fielding
    score += (perf.catches * 3);
    
    return this.clamp(score, 0, 100);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
  
  private getFormatAttributes(state: ArenaPlayerState, format: "TEST" | "ODI" | "T20" | "IPL"): FormatAttributes {
    return state.ratings[format.toLowerCase() as keyof PlayerFormatRating];
  }
  
  private updateFormatAttributes(state: ArenaPlayerState, format: "TEST" | "ODI" | "T20" | "IPL", attrs: FormatAttributes, history: FormHistoryEntry[]): ArenaPlayerState {
    return {
      ...state,
      formHistory: history,
      ratings: {
        ...state.ratings,
        [format.toLowerCase()]: attrs
      }
    };
  }
}
