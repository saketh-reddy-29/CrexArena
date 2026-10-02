import { Fielder3DCoord } from '../strategy/FieldStrategyEngine';

export type GapQuality =
  | 'WIDE_OPEN_BOUNDARY'
  | 'CLEAN_GAP_2_RUNS'
  | 'TIGHT_GAP_1_RUN'
  | 'DIRECT_TO_FIELDER_DOT'
  | 'CATCHING_CHANCE';

export interface ScoringGapAnalysis {
  quality: GapQuality;
  nearestFielderName: string;
  nearestFielderDistanceMeters: number;
  interceptionProbability: number; // 0.0 to 1.0
  maxSafeRuns: number;             // 0, 1, 2, 3, 4, 6
}

export class ScoringGapEngine {
  /**
   * Analyzes the active field positions relative to the ball trajectory target
   */
  public evaluateGap(
    targetPos: { x: number; z: number },
    fielders: Fielder3DCoord[],
    isAerial: boolean = false,
    exitVelocityMps: number = 30
  ): ScoringGapAnalysis {
    if (!fielders || fielders.length === 0) {
      return {
        quality: 'WIDE_OPEN_BOUNDARY',
        nearestFielderName: 'None',
        nearestFielderDistanceMeters: 99,
        interceptionProbability: 0,
        maxSafeRuns: isAerial ? 6 : 4,
      };
    }

    let nearestFielder = fielders[0];
    let minDistance = Infinity;

    for (const f of fielders) {
      const dist = Math.hypot(f.x - targetPos.x, f.z - targetPos.z);
      if (dist < minDistance) {
        minDistance = dist;
        nearestFielder = f;
      }
    }

    // Distance to nearest fielder
    let quality: GapQuality = 'TIGHT_GAP_1_RUN';
    let interceptionProbability = 0.5;
    let maxSafeRuns = 1;

    if (isAerial) {
      const boundaryDist = Math.hypot(targetPos.x, targetPos.z - 9.5);
      if (boundaryDist >= 37.0) {
        // Clears the boundary for six
        quality = 'WIDE_OPEN_BOUNDARY';
        interceptionProbability = 0.05;
        maxSafeRuns = 6;
      } else if (minDistance < 5.0) {
        // Aerial ball in catching range
        quality = 'CATCHING_CHANCE';
        interceptionProbability = 0.85;
        maxSafeRuns = 0;
      } else if (minDistance < 12.0) {
        quality = 'CLEAN_GAP_2_RUNS';
        interceptionProbability = 0.35;
        maxSafeRuns = 2;
      } else {
        quality = 'WIDE_OPEN_BOUNDARY';
        interceptionProbability = 0.10;
        maxSafeRuns = 4;
      }
    } else {
      // Ground trajectory
      if (minDistance < 3.5) {
        // Straight to the fielder
        quality = 'DIRECT_TO_FIELDER_DOT';
        interceptionProbability = 0.95;
        maxSafeRuns = 0;
      } else if (minDistance < 8.0) {
        // Fielder cuts it off after a short sprint
        quality = 'TIGHT_GAP_1_RUN';
        interceptionProbability = 0.70;
        maxSafeRuns = 1;
      } else if (minDistance < 14.5) {
        // Clean piercing of inner ring
        quality = exitVelocityMps > 32 ? 'WIDE_OPEN_BOUNDARY' : 'CLEAN_GAP_2_RUNS';
        interceptionProbability = 0.30;
        maxSafeRuns = exitVelocityMps > 32 ? 4 : 2;
      } else {
        // Wide open gap through the field
        quality = 'WIDE_OPEN_BOUNDARY';
        interceptionProbability = 0.08;
        maxSafeRuns = 4;
      }
    }

    return {
      quality,
      nearestFielderName: nearestFielder.name,
      nearestFielderDistanceMeters: Number(minDistance.toFixed(2)),
      interceptionProbability: Number(interceptionProbability.toFixed(2)),
      maxSafeRuns,
    };
  }
}

export const scoringGapEngine = new ScoringGapEngine();
