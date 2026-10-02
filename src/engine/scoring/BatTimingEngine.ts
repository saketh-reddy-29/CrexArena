export type BatTimingQuality =
  | 'PERFECT'
  | 'GOOD'
  | 'AVERAGE'
  | 'LATE'
  | 'EARLY'
  | 'MISTIMED';

export interface BatTimingResult {
  quality: BatTimingQuality;
  exitVelocityMps: number;       // 15 m/s (slow grounder) to 45 m/s (rocket boundary)
  powerTransferFactor: number;   // 0.25 to 1.35
  aerialHeightMeters: number;    // 0.0 (ground) to 14.0 (sky high six)
  aerialChance: number;          // 0.0 to 1.0
  catchRiskFactor: number;       // 0.0 to 1.0
}

export class BatTimingEngine {
  /**
   * Evaluates bat stroke timing based on batter timing skill, form, settledness, bowler quality & delivery speed
   */
  public evaluate(
    batterTimingAttr: number = 75,
    batterSettledness: number = 50,
    batterForm: number = 100,
    bowlerSpeedKph: number = 135,
    isLoftedAttempt: boolean = false
  ): BatTimingResult {
    // Timing skill score (0-100)
    const baseSkill = (batterTimingAttr * 0.55) + (batterSettledness * 0.25) + ((batterForm - 50) * 0.4);
    const speedDifficulty = Math.max(0, (bowlerSpeedKph - 120) * 0.3);
    const effectiveTimingScore = Math.max(10, Math.min(98, baseSkill - speedDifficulty));

    const roll = Math.random() * 100;
    let quality: BatTimingQuality = 'AVERAGE';

    if (roll < effectiveTimingScore * 0.35) {
      quality = 'PERFECT';
    } else if (roll < effectiveTimingScore * 0.75) {
      quality = 'GOOD';
    } else if (roll < effectiveTimingScore + 15) {
      quality = 'AVERAGE';
    } else if (roll < effectiveTimingScore + 25) {
      quality = Math.random() > 0.5 ? 'LATE' : 'EARLY';
    } else {
      quality = 'MISTIMED';
    }

    let powerTransferFactor = 1.0;
    let exitVelocityMps = 28;
    let aerialHeightMeters = isLoftedAttempt ? 8.5 : 0.08;
    let aerialChance = isLoftedAttempt ? 0.90 : 0.08;
    let catchRiskFactor = 0.15;

    switch (quality) {
      case 'PERFECT':
        powerTransferFactor = 1.35;
        exitVelocityMps = isLoftedAttempt ? 44.0 : 39.0;
        aerialHeightMeters = isLoftedAttempt ? 12.5 : 0.05;
        catchRiskFactor = isLoftedAttempt ? 0.05 : 0.02; // Clears the boundary easily
        break;
      case 'GOOD':
        powerTransferFactor = 1.15;
        exitVelocityMps = isLoftedAttempt ? 36.0 : 32.0;
        aerialHeightMeters = isLoftedAttempt ? 9.5 : 0.08;
        catchRiskFactor = isLoftedAttempt ? 0.20 : 0.05;
        break;
      case 'AVERAGE':
        powerTransferFactor = 0.90;
        exitVelocityMps = isLoftedAttempt ? 28.0 : 25.0;
        aerialHeightMeters = isLoftedAttempt ? 6.5 : 0.12;
        catchRiskFactor = isLoftedAttempt ? 0.55 : 0.15;
        break;
      case 'LATE':
      case 'EARLY':
        powerTransferFactor = 0.65;
        exitVelocityMps = 20.0;
        aerialHeightMeters = isLoftedAttempt ? 5.0 : 0.25;
        catchRiskFactor = isLoftedAttempt ? 0.75 : 0.35;
        break;
      case 'MISTIMED':
        powerTransferFactor = 0.40;
        exitVelocityMps = 14.0;
        aerialHeightMeters = isLoftedAttempt ? 4.0 : 0.40;
        catchRiskFactor = 0.85; // High chance of looping catch to ring fielders
        break;
    }

    return {
      quality,
      exitVelocityMps,
      powerTransferFactor,
      aerialHeightMeters,
      aerialChance,
      catchRiskFactor,
    };
  }
}

export const batTimingEngine = new BatTimingEngine();
