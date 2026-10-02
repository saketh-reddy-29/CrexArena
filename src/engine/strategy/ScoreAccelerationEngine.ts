import { RunRateMetrics } from './RunRateEngine';

export type AccelerationState =
  | 'DEFEND'
  | 'SURVIVE'
  | 'ROTATE'
  | 'BUILD'
  | 'CONTROL'
  | 'ACCELERATE'
  | 'ATTACK'
  | 'MAXIMUM_ATTACK';

export interface AccelerationDecision {
  state: AccelerationState;
  reason: string;
  recommendedStrokeType: 'DEFENSIVE' | 'ROTATE_SINGLES' | 'GAP_PUNCH' | 'BOUNDARY_HUNT' | 'AERIAL_SLOG';
  boundaryAggressionScore: number; // 0 to 100
  wicketPreservationScore: number; // 0 to 100
}

export class ScoreAccelerationEngine {
  /**
   * Continuously determines the exact score acceleration mindset
   */
  public evaluate(
    format: string,
    overs: number,
    wickets: number,
    metrics: RunRateMetrics,
    batterSettledness: number = 50,
    isDeclarationPush: boolean = false
  ): AccelerationDecision {
    const fmt = format.toUpperCase();
    const wicketsInHand = metrics.wicketsRemaining;

    // ──────────────────────────────────────────────────────────
    // 1. TEST MATCH ACCELERATION LOGIC
    // ──────────────────────────────────────────────────────────
    if (fmt === 'TEST') {
      if (isDeclarationPush) {
        return {
          state: 'ATTACK',
          reason: 'Declaration push before innings close',
          recommendedStrokeType: 'BOUNDARY_HUNT',
          boundaryAggressionScore: 80,
          wicketPreservationScore: 40,
        };
      }

      if (wicketsInHand <= 2) {
        return {
          state: 'SURVIVE',
          reason: 'Tailenders at crease; protect last wickets',
          recommendedStrokeType: 'DEFENSIVE',
          boundaryAggressionScore: 10,
          wicketPreservationScore: 95,
        };
      }

      if (batterSettledness < 25) {
        return {
          state: 'DEFEND',
          reason: 'Unsettled batter building concentration',
          recommendedStrokeType: 'DEFENSIVE',
          boundaryAggressionScore: 15,
          wicketPreservationScore: 90,
        };
      }

      if (batterSettledness > 65 && wicketsInHand >= 6) {
        return {
          state: 'CONTROL',
          reason: 'Settled batter playing standard Test shots',
          recommendedStrokeType: 'GAP_PUNCH',
          boundaryAggressionScore: 45,
          wicketPreservationScore: 80,
        };
      }

      return {
        state: 'BUILD',
        reason: 'Constructing Test partnership',
        recommendedStrokeType: 'ROTATE_SINGLES',
        boundaryAggressionScore: 30,
        wicketPreservationScore: 85,
      };
    }

    // ──────────────────────────────────────────────────────────
    // 2. ODI 50-OVER ACCELERATION LOGIC
    // ──────────────────────────────────────────────────────────
    if (fmt === 'ODI') {
      // Severe collapse recovery (e.g. 50/5)
      if (wicketsInHand <= 4 && overs < 35) {
        return {
          state: 'SURVIVE',
          reason: 'Top order collapse; rebuilding innings',
          recommendedStrokeType: 'DEFENSIVE',
          boundaryAggressionScore: 20,
          wicketPreservationScore: 95,
        };
      }

      // Chase scenario
      if (metrics.requiredRunRate !== null) {
        if (metrics.accelerationRequired === 'EXTREME') {
          return {
            state: wicketsInHand > 3 ? 'MAXIMUM_ATTACK' : 'ATTACK',
            reason: 'High required run rate in chase',
            recommendedStrokeType: 'AERIAL_SLOG',
            boundaryAggressionScore: 95,
            wicketPreservationScore: 40,
          };
        } else if (metrics.accelerationRequired === 'HIGH') {
          return {
            state: 'ATTACK',
            reason: 'Elevated required run rate',
            recommendedStrokeType: 'BOUNDARY_HUNT',
            boundaryAggressionScore: 80,
            wicketPreservationScore: 60,
          };
        } else if (metrics.accelerationRequired === 'NONE') {
          return {
            state: 'CONTROL',
            reason: 'Chase is comfortably under control',
            recommendedStrokeType: 'ROTATE_SINGLES',
            boundaryAggressionScore: 40,
            wicketPreservationScore: 85,
          };
        }
      }

      // 1st innings progression
      if (overs >= 40) {
        // Death overs 41-50
        return {
          state: wicketsInHand >= 5 ? 'MAXIMUM_ATTACK' : 'ACCELERATE',
          reason: 'ODI death overs finish',
          recommendedStrokeType: wicketsInHand >= 5 ? 'AERIAL_SLOG' : 'BOUNDARY_HUNT',
          boundaryAggressionScore: wicketsInHand >= 5 ? 90 : 75,
          wicketPreservationScore: 50,
        };
      } else if (overs >= 35) {
        // Overs 36-40
        return {
          state: 'ACCELERATE',
          reason: 'Preparing for final 10 overs assault',
          recommendedStrokeType: 'GAP_PUNCH',
          boundaryAggressionScore: 70,
          wicketPreservationScore: 70,
        };
      } else if (overs < 10) {
        // Powerplay 1-10
        return {
          state: 'BUILD',
          reason: 'Exploiting powerplay field gaps with controlled risk',
          recommendedStrokeType: 'GAP_PUNCH',
          boundaryAggressionScore: 55,
          wicketPreservationScore: 80,
        };
      } else {
        // Middle overs 11-35
        return {
          state: 'ROTATE',
          reason: 'Middle overs strike rotation & partnership building',
          recommendedStrokeType: 'ROTATE_SINGLES',
          boundaryAggressionScore: 40,
          wicketPreservationScore: 85,
        };
      }
    }

    // ──────────────────────────────────────────────────────────
    // 3. T20 / IPL ACCELERATION LOGIC
    // ──────────────────────────────────────────────────────────
    if (wicketsInHand <= 3 && overs < 14) {
      return {
        state: 'BUILD',
        reason: 'Early wickets lost in T20; consolidating',
        recommendedStrokeType: 'ROTATE_SINGLES',
        boundaryAggressionScore: 45,
        wicketPreservationScore: 80,
      };
    }

    if (overs >= 16) {
      return {
        state: 'MAXIMUM_ATTACK',
        reason: 'T20 death overs assault',
        recommendedStrokeType: 'AERIAL_SLOG',
        boundaryAggressionScore: 98,
        wicketPreservationScore: 30,
      };
    }

    if (overs < 6) {
      return {
        state: 'ATTACK',
        reason: 'T20 powerplay boundary exploitation',
        recommendedStrokeType: 'BOUNDARY_HUNT',
        boundaryAggressionScore: 85,
        wicketPreservationScore: 65,
      };
    }

    if (metrics.accelerationRequired === 'EXTREME' || metrics.accelerationRequired === 'HIGH') {
      return {
        state: 'MAXIMUM_ATTACK',
        reason: 'Chasing steep target in T20',
        recommendedStrokeType: 'AERIAL_SLOG',
        boundaryAggressionScore: 95,
        wicketPreservationScore: 35,
      };
    }

    return {
      state: 'ACCELERATE',
      reason: 'T20 middle overs continuous scoring pressure',
      recommendedStrokeType: 'GAP_PUNCH',
      boundaryAggressionScore: 75,
      wicketPreservationScore: 60,
    };
  }
}

export const scoreAccelerationEngine = new ScoreAccelerationEngine();
