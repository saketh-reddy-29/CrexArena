import { ODIBattingStrategy, ODIPhase } from './ODIDeliveryModel';
import { safeNumber } from '../../utils/safeMath';

export interface WicketPreservationContext {
  wicketsLost: number;
  wicketsRemaining: number;
  oversRemaining: number;
  ballsRemaining: number;
  target?: number | null;
  runsRequired?: number | null;
  requiredRate?: number | null;
  currentRunRate: number;
  phase: ODIPhase;
  batterBallsFaced: number;
  batterSettledness: number;
  partnershipRuns: number;
  partnershipBalls: number;
}

export interface WicketPreservationDecision {
  riskTolerance: number; // 0.00 (extreme preservation) to 1.00 (all-out attack)
  intent: ODIBattingStrategy;
  strategyDescription: string;
  dotWeight: number;
  singleWeight: number;
  twoWeight: number;
  fourWeight: number;
  sixWeight: number;
  wicketRiskMultiplier: number;
}

export class WicketPreservationEngine {
  /**
   * Dynamically determines batting risk tolerance and run distribution for 50-over ODI cricket
   */
  public evaluate(context: WicketPreservationContext): WicketPreservationDecision {
    const {
      wicketsLost,
      wicketsRemaining,
      oversRemaining,
      target,
      requiredRate,
      phase,
      batterBallsFaced,
      batterSettledness,
      partnershipRuns,
    } = context;

    let baseRisk = 0.35; // Standard ODI accumulation baseline
    let intent: ODIBattingStrategy = 'ROTATE';
    let strategyDescription = 'Strike Rotation & Wicket Preservation';

    // 1. Phase-based foundation
    if (phase === 'POWERPLAY') {
      // Overs 1-10: Exploit field restrictions with controlled aggression
      if (batterBallsFaced < 8) {
        baseRisk = 0.25;
        intent = 'BUILDING';
        strategyDescription = 'Powerplay: Sight the ball & protect early wickets';
      } else {
        baseRisk = 0.42;
        intent = 'CONTROLLED_ATTACK';
        strategyDescription = 'Powerplay: Exploit 2-man ring with controlled strokes';
      }
    } else if (phase === 'MIDDLE_OVERS') {
      // Overs 11-40: Wicket preservation & strike rotation
      if (wicketsRemaining <= 4) {
        baseRisk = 0.22;
        intent = 'DEFENSIVE';
        strategyDescription = 'Middle Overs: Rebuild innings after wicket loss';
      } else if (partnershipRuns > 50 && batterSettledness > 50) {
        baseRisk = 0.45;
        intent = 'CONTROLLED_ATTACK';
        strategyDescription = 'Middle Overs: Established stand, punishing loose balls';
      } else {
        baseRisk = 0.32;
        intent = 'ROTATE';
        strategyDescription = 'Middle Overs: Gaps & strike rotation';
      }
    } else {
      // DEATH_OVERS (Overs 41-50): Controlled acceleration based on wickets in hand
      if (wicketsRemaining >= 6) {
        baseRisk = 0.78;
        intent = 'ALL_OUT_ATTACK';
        strategyDescription = 'Death Overs: Maximum acceleration with wickets in hand';
      } else if (wicketsRemaining >= 4) {
        baseRisk = 0.62;
        intent = 'AGGRESSIVE';
        strategyDescription = 'Death Overs: Aggressive boundary hunting';
      } else if (wicketsRemaining >= 2) {
        baseRisk = 0.45;
        intent = 'ACCELERATE';
        strategyDescription = 'Death Overs: Calculated acceleration';
      } else {
        baseRisk = 0.30;
        intent = 'BUILDING';
        strategyDescription = 'Death Overs: Bat out full 50 overs';
      }
    }

    // 2. Chase Required Rate Pressure (2nd Innings)
    if (target && requiredRate !== null && requiredRate !== undefined) {
      if (requiredRate > 10.0) {
        baseRisk = Math.min(0.92, baseRisk + 0.35);
        intent = wicketsRemaining > 3 ? 'ALL_OUT_ATTACK' : 'AGGRESSIVE';
        strategyDescription = `Chase Pressure: RRR ${requiredRate.toFixed(2)} demands boundaries`;
      } else if (requiredRate > 8.0) {
        baseRisk = Math.min(0.80, baseRisk + 0.22);
        intent = 'AGGRESSIVE';
        strategyDescription = `Chase: Elevating scoring rate for RRR ${requiredRate.toFixed(2)}`;
      } else if (requiredRate > 6.0) {
        baseRisk = Math.min(0.65, baseRisk + 0.12);
        intent = 'CONTROLLED_ATTACK';
      } else if (requiredRate < 4.0) {
        // Very low required rate: zero reason to take high risks
        baseRisk = Math.max(0.18, baseRisk - 0.15);
        intent = 'ROTATE';
        strategyDescription = `Comfortable Chase: Cruise with singles & twos`;
      }
    }

    // 3. Wickets In Hand Dynamic Damping (Never commit suicide if 8-9 down)
    if (wicketsRemaining <= 2 && (!target || (requiredRate && requiredRate < 7.0))) {
      baseRisk = Math.min(baseRisk, 0.28);
      intent = 'DEFENSIVE';
      strategyDescription = 'Tail Collapse: Protecting last wickets';
    }

    const riskTolerance = Number(Math.max(0.08, Math.min(0.95, baseRisk)).toFixed(2));

    // 4. Compute Outcome Weights from Intent & Risk
    let dotWeight = 45;
    let singleWeight = 34;
    let twoWeight = 11;
    let fourWeight = 8;
    let sixWeight = 2;

    switch (intent) {
      case 'DEFENSIVE':
        dotWeight = 65;
        singleWeight = 27;
        twoWeight = 5;
        fourWeight = 2.8;
        sixWeight = 0.2;
        break;
      case 'BUILDING':
        dotWeight = 52;
        singleWeight = 34;
        twoWeight = 8;
        fourWeight = 5.5;
        sixWeight = 0.5;
        break;
      case 'ROTATE':
        dotWeight = 38;
        singleWeight = 42;
        twoWeight = 12;
        fourWeight = 7;
        sixWeight = 1;
        break;
      case 'CONTROLLED_ATTACK':
        dotWeight = 30;
        singleWeight = 36;
        twoWeight = 15;
        fourWeight = 15;
        sixWeight = 4;
        break;
      case 'ACCELERATE':
        dotWeight = 24;
        singleWeight = 32;
        twoWeight = 16;
        fourWeight = 20;
        sixWeight = 8;
        break;
      case 'AGGRESSIVE':
        dotWeight = 20;
        singleWeight = 28;
        twoWeight = 14;
        fourWeight = 25;
        sixWeight = 13;
        break;
      case 'ALL_OUT_ATTACK':
        dotWeight = 18;
        singleWeight = 22;
        twoWeight = 12;
        fourWeight = 30;
        sixWeight = 18;
        break;
    }

    const wicketRiskMultiplier = Number((0.6 + riskTolerance * 1.6).toFixed(2));

    return {
      riskTolerance,
      intent,
      strategyDescription,
      dotWeight,
      singleWeight,
      twoWeight,
      fourWeight,
      sixWeight,
      wicketRiskMultiplier,
    };
  }
}

export const wicketPreservationEngine = new WicketPreservationEngine();
