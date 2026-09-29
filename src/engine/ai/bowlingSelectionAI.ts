import { MatchContext, Player } from "../core/types";

export interface BowlerProfile {
  playerId: string;
  bowlingRating: number;
  pace: number;
  swing: number;
  seam: number;
  spin: number;
  accuracy: number;
  powerplay: number;
  middleOvers: number;
  death: number;
  againstLeftHander: number;
  againstRightHander: number;
  wicketTaking: number;
  economy: number;
  fatigue: number;
  oversBowled: number;
  oversRemaining: number;
}

export class BowlingSelectionAI {
  /**
   * Evaluates available bowlers and returns the best selection based on match context.
   */
  public selectBowler(context: MatchContext, availableBowlers: BowlerProfile[]): BowlerProfile {
    // Exclude bowlers who have bowled their maximum allowed overs
    const eligibleBowlers = availableBowlers.filter(b => b.oversRemaining > 0);
    
    if (eligibleBowlers.length === 0) {
      throw new Error("No eligible bowlers available.");
    }

    const scoredBowlers = eligibleBowlers.map(bowler => {
      const score = this.scoreBowler(context, bowler);
      return { bowler, score };
    });

    // Sort by highest score
    scoredBowlers.sort((a, b) => b.score - a.score);

    // Apply weighted choice to top candidates so it doesn't feel robotic (as user suggested)
    return this.weightedSelection(scoredBowlers);
  }

  private scoreBowler(context: MatchContext, bowler: BowlerProfile): number {
    let score = bowler.bowlingRating; // Base rating

    // Phase suitability
    if (context.phase === "POWERPLAY") {
      score += bowler.powerplay - 50; 
    } else if (context.phase === "DEATH") {
      score += bowler.death - 50;
    } else {
      score += bowler.middleOvers - 50;
    }

    // Batter Matchup
    if (context.striker.isLeftHandedBat) {
      score += bowler.againstLeftHander - 50;
    } else {
      score += bowler.againstRightHander - 50;
    }

    // Pitch Suitability (Basic Example)
    if (context.pitch.deterioration > 60 && bowler.spin > 80) {
      score += 20; // Spinners get a boost on deteriorating pitch
    }

    // Fatigue penalty
    score -= (bowler.fatigue * 0.5);

    // Pressure & Wicket Value
    if (context.pressure > 70) {
      score += (bowler.wicketTaking - 50); // In high pressure, favor wicket-takers
    }

    return score;
  }

  private weightedSelection(scoredBowlers: { bowler: BowlerProfile, score: number }[]): BowlerProfile {
    // If we only have 1, return it
    if (scoredBowlers.length === 1) return scoredBowlers[0].bowler;

    // Give probability based on how close they are to top score
    // Let's implement a simple drop-off probability for the top 3-4.
    const topCandidates = scoredBowlers.slice(0, 4);
    
    // For simplicity: Top choice 55%, 2nd 25%, 3rd 15%, 4th 5%
    const rand = Math.random() * 100;
    
    if (rand < 55) return topCandidates[0].bowler;
    if (rand < 80 && topCandidates.length > 1) return topCandidates[1].bowler;
    if (rand < 95 && topCandidates.length > 2) return topCandidates[2].bowler;
    if (topCandidates.length > 3) return topCandidates[3].bowler;
    
    return topCandidates[0].bowler;
  }
}
