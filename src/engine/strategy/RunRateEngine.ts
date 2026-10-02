export interface RunRateMetrics {
  currentRunRate: number;
  requiredRunRate: number | null;
  projectedScore: number;
  parScore: number;
  runsRequired: number | null;
  ballsRemaining: number;
  wicketsRemaining: number;
  accelerationRequired: 'NONE' | 'STEADY' | 'MODERATE' | 'HIGH' | 'EXTREME';
}

export class RunRateEngine {
  /**
   * Calculates real-time run rate metrics, dynamic projections, and required acceleration
   */
  public calculate(
    format: string,
    overs: number,
    balls: number,
    score: number,
    wickets: number,
    maxOvers: number = 20,
    target: number | null = null,
    innings: number = 1
  ): RunRateMetrics {
    const totalBallsBowled = Math.max(1, overs * 6 + (balls % 6));
    const totalMatchBalls = maxOvers * 6;
    const ballsRemaining = Math.max(0, totalMatchBalls - totalBallsBowled);
    const wicketsRemaining = Math.max(0, 10 - wickets);

    // Current Run Rate (CRR)
    const currentRunRate = (score / totalBallsBowled) * 6;

    // Projected Score based on CRR & wickets in hand
    const wicketFactor = Math.min(1.2, Math.max(0.6, wicketsRemaining / 7.0));
    const projectedScore = Math.round(score + (currentRunRate * (ballsRemaining / 6) * wicketFactor));

    // Dynamic Par Score
    const baseParRR = format.toUpperCase() === 'TEST' ? 3.2 : format.toUpperCase() === 'ODI' ? 5.6 : 8.4;
    const parScore = Math.round(baseParRR * (totalBallsBowled / 6));

    // Required Run Rate (RRR)
    let requiredRunRate: number | null = null;
    let runsRequired: number | null = null;
    let accelerationRequired: 'NONE' | 'STEADY' | 'MODERATE' | 'HIGH' | 'EXTREME' = 'NONE';

    if (target !== null && target > 0 && innings > 1) {
      runsRequired = Math.max(0, target - score);
      if (ballsRemaining > 0) {
        requiredRunRate = (runsRequired / ballsRemaining) * 6;

        const rateDiff = requiredRunRate - currentRunRate;
        if (rateDiff >= 3.5 || requiredRunRate >= 12.0) accelerationRequired = 'EXTREME';
        else if (rateDiff >= 2.0 || requiredRunRate >= 9.5) accelerationRequired = 'HIGH';
        else if (rateDiff >= 1.0 || requiredRunRate >= 7.5) accelerationRequired = 'MODERATE';
        else if (rateDiff > 0.0) accelerationRequired = 'STEADY';
        else accelerationRequired = 'NONE';
      } else {
        requiredRunRate = runsRequired > 0 ? 99.9 : 0;
        accelerationRequired = runsRequired > 0 ? 'EXTREME' : 'NONE';
      }
    }

    return {
      currentRunRate: Number(currentRunRate.toFixed(2)),
      requiredRunRate: requiredRunRate !== null ? Number(requiredRunRate.toFixed(2)) : null,
      projectedScore,
      parScore,
      runsRequired,
      ballsRemaining,
      wicketsRemaining,
      accelerationRequired,
    };
  }
}

export const runRateEngine = new RunRateEngine();
