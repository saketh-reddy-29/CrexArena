import { AccelerationState } from './ScoreAccelerationEngine';

export interface BattingRiskMetrics {
  riskLevel: number;             // 0.00 to 1.00
  dismissalRiskFactor: number;   // multiplier
  boundaryRewardFactor: number;  // multiplier
  recommendedPatience: 'EXTREME' | 'HIGH' | 'BALANCED' | 'LOW' | 'MINIMAL';
}

export class BattingRiskEngine {
  /**
   * Calculates continuous batting risk level (0.0 to 1.0)
   */
  public calculateRisk(
    format: string,
    overs: number,
    wickets: number,
    acceleration: AccelerationState,
    batterSettledness: number = 50,
    batterForm: number = 100,
    bowlerThreat: number = 50,
    requiredRate: number | null = null
  ): BattingRiskMetrics {
    const fmt = format.toUpperCase();
    let baseRisk = 0.40;

    // 1. Format Foundation
    if (fmt === 'TEST') baseRisk = 0.12;
    else if (fmt === 'ODI') baseRisk = 0.35;
    else baseRisk = 0.65; // T20

    // 2. Acceleration State Adjustment
    switch (acceleration) {
      case 'DEFEND':
      case 'SURVIVE':
        baseRisk *= 0.35;
        break;
      case 'ROTATE':
      case 'BUILD':
        baseRisk *= 0.70;
        break;
      case 'CONTROL':
        baseRisk *= 0.85;
        break;
      case 'ACCELERATE':
        baseRisk *= 1.25;
        break;
      case 'ATTACK':
        baseRisk *= 1.55;
        break;
      case 'MAXIMUM_ATTACK':
        baseRisk *= 1.95;
        break;
    }

    // 3. Wickets Remaining Modifier (e.g. 180/8 takes less risk than 180/2)
    const wicketsInHand = Math.max(0, 10 - wickets);
    if (wicketsInHand <= 2) baseRisk *= 0.50;
    else if (wicketsInHand <= 4) baseRisk *= 0.75;
    else if (wicketsInHand >= 7) baseRisk *= 1.15;

    // 4. Settledness & Form Modifier
    const settledFactor = 1.0 - (Math.max(0, Math.min(100, batterSettledness)) * 0.003); // settled batter makes fewer unforced errors
    const formFactor = 1.0 + ((100 - batterForm) * 0.003);
    const bowlerFactor = 1.0 + ((bowlerThreat - 50) * 0.003);

    // 5. Chase Pressure
    if (requiredRate !== null && requiredRate > 9.0) {
      baseRisk = Math.min(0.95, baseRisk + (requiredRate - 9.0) * 0.04);
    }

    const finalRisk = Math.max(0.04, Math.min(0.98, baseRisk * settledFactor * formFactor * bowlerFactor));

    // Multipliers
    const dismissalRiskFactor = Number((0.5 + finalRisk * 1.5).toFixed(2));
    const boundaryRewardFactor = Number((0.4 + finalRisk * 1.8).toFixed(2));

    let recommendedPatience: 'EXTREME' | 'HIGH' | 'BALANCED' | 'LOW' | 'MINIMAL' = 'BALANCED';
    if (finalRisk < 0.15) recommendedPatience = 'EXTREME';
    else if (finalRisk < 0.30) recommendedPatience = 'HIGH';
    else if (finalRisk < 0.60) recommendedPatience = 'BALANCED';
    else if (finalRisk < 0.80) recommendedPatience = 'LOW';
    else recommendedPatience = 'MINIMAL';

    return {
      riskLevel: Number(finalRisk.toFixed(2)),
      dismissalRiskFactor,
      boundaryRewardFactor,
      recommendedPatience,
    };
  }
}

export const battingRiskEngine = new BattingRiskEngine();
