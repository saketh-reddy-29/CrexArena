export type BatContactPoint =
  | 'CENTRE'
  | 'EDGE'
  | 'THIN_EDGE'
  | 'BOTTOM_EDGE'
  | 'TOP_EDGE'
  | 'MISSED'
  | 'PAD';

export interface BatContactResult {
  contactPoint: BatContactPoint;
  isMiddleOfBat: boolean;
  isEdge: boolean;
  isPad: boolean;
  isMissed: boolean;
  deflectionAngleOffsetDeg: number;
  speedMultiplier: number;
}

export class BatContactEngine {
  /**
   * Determines the physical point of contact on the bat
   */
  public evaluate(
    batterTechnique: number = 75,
    bowlerMovementScore: number = 60,
    isDefensive: boolean = false
  ): BatContactResult {
    // Relative advantage between batter technique & bowler movement
    const margin = batterTechnique - bowlerMovementScore; // e.g. 75 - 60 = +15

    const roll = Math.random() * 100;

    let contactPoint: BatContactPoint = 'CENTRE';
    let deflectionAngleOffsetDeg = 0;
    let speedMultiplier = 1.0;

    const centerThreshold = Math.max(40, Math.min(88, 70 + margin * 0.4));
    const edgeThreshold = centerThreshold + Math.max(5, 16 - margin * 0.2);

    if (roll < centerThreshold) {
      contactPoint = 'CENTRE';
      deflectionAngleOffsetDeg = 0;
      speedMultiplier = 1.0;
    } else if (roll < edgeThreshold) {
      contactPoint = Math.random() > 0.6 ? 'THIN_EDGE' : 'EDGE';
      deflectionAngleOffsetDeg = Math.random() > 0.5 ? -65 : -45; // Deflects back towards slips / keeper
      speedMultiplier = 0.55;
    } else if (roll < edgeThreshold + 5) {
      contactPoint = 'BOTTOM_EDGE';
      deflectionAngleOffsetDeg = 20;
      speedMultiplier = 0.40;
    } else if (roll < edgeThreshold + 9) {
      contactPoint = 'PAD';
      deflectionAngleOffsetDeg = 0;
      speedMultiplier = 0.15;
    } else {
      contactPoint = 'MISSED';
      deflectionAngleOffsetDeg = 0;
      speedMultiplier = 0.0;
    }

    return {
      contactPoint,
      isMiddleOfBat: contactPoint === 'CENTRE',
      isEdge: contactPoint === 'EDGE' || contactPoint === 'THIN_EDGE' || contactPoint === 'BOTTOM_EDGE',
      isPad: contactPoint === 'PAD',
      isMissed: contactPoint === 'MISSED',
      deflectionAngleOffsetDeg,
      speedMultiplier,
    };
  }
}

export const batContactEngine = new BatContactEngine();
