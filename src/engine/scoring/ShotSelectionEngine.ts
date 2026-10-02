import { ScoringZoneName, BatterHand } from './ScoringZones';
import { PlayerAnimState } from '../../components/CricketPlayer3D';

export type DeliveryLineLength =
  | 'FULL_OUTSIDE_OFF'
  | 'GOOD_LENGTH_OUTSIDE_OFF'
  | 'SHORT_OUTSIDE_OFF'
  | 'SHORT_BODY_LEG'
  | 'FULL_MIDDLE'
  | 'FULL_LEG'
  | 'YORKER';

export interface ShotCandidate {
  shotName: string;
  clip: PlayerAnimState;
  targetZone: ScoringZoneName;
  isLofted: boolean;
  baseRisk: number;         // 0.0 to 1.0
  expectedRuns: number;     // 0, 1, 2, 4, 6
  suitabilityScore: number; // 0 to 100
}

export interface BatterScoringPreferences {
  cover?: number;
  point?: number;
  thirdMan?: number;
  straight?: number;
  midOff?: number;
  midOn?: number;
  midWicket?: number;
  squareLeg?: number;
  fineLeg?: number;
  longOn?: number;
  longOff?: number;
}

export const DEFAULT_BATTER_PREFERENCES: Required<BatterScoringPreferences> = {
  cover: 75,
  point: 70,
  thirdMan: 65,
  straight: 80,
  midOff: 72,
  midOn: 72,
  midWicket: 80,
  squareLeg: 75,
  fineLeg: 68,
  longOn: 78,
  longOff: 78,
};

export class ShotSelectionEngine {
  /**
   * Intelligently selects the realistic shot and target scoring zone based on delivery physics
   */
  public selectShot(
    delivery: DeliveryLineLength,
    batterHand: BatterHand = 'RIGHT_HAND',
    preferences: BatterScoringPreferences = {},
    intent: string = 'BALANCED',
    batterAggression: number = 50,
    batterTechnique: number = 75
  ): ShotCandidate {
    const prefs = { ...DEFAULT_BATTER_PREFERENCES, ...preferences };
    const candidates = this.getCandidatesForDelivery(delivery, prefs, intent, batterAggression);

    // Filter and score candidates based on batter technique & intent
    let bestCandidate = candidates[0];
    let highestScore = -Infinity;

    for (const c of candidates) {
      // Add randomness scaled by decision quality
      const roll = Math.random() * 25;
      const totalScore = c.suitabilityScore + roll;
      if (totalScore > highestScore) {
        highestScore = totalScore;
        bestCandidate = c;
      }
    }

    return bestCandidate;
  }

  private getCandidatesForDelivery(
    delivery: DeliveryLineLength,
    prefs: Required<BatterScoringPreferences>,
    intent: string,
    aggression: number
  ): ShotCandidate[] {
    const isAttacking = intent === 'AGGRESSIVE' || intent === 'ALL_OUT_ATTACK' || intent === 'ATTACK';
    const isDefensive = intent === 'DEFENSIVE' || intent === 'SURVIVAL';

    switch (delivery) {
      case 'FULL_OUTSIDE_OFF':
        return [
          {
            shotName: 'Cover Drive',
            clip: 'COVER_DRIVE',
            targetZone: isAttacking ? 'DEEP_COVER' : 'COVER',
            isLofted: isAttacking && aggression > 65,
            baseRisk: 0.22,
            expectedRuns: isAttacking ? 4 : 2,
            suitabilityScore: prefs.cover + 15,
          },
          {
            shotName: 'Square Drive',
            clip: 'COVER_DRIVE',
            targetZone: 'EXTRA_COVER',
            isLofted: false,
            baseRisk: 0.20,
            expectedRuns: 2,
            suitabilityScore: prefs.cover + 5,
          },
          {
            shotName: 'Late Cut',
            clip: 'SQUARE_CUT',
            targetZone: 'THIRD_MAN',
            isLofted: false,
            baseRisk: 0.18,
            expectedRuns: 1,
            suitabilityScore: prefs.thirdMan + 10,
          },
        ];

      case 'GOOD_LENGTH_OUTSIDE_OFF':
        return [
          {
            shotName: isDefensive ? 'Forward Defence' : 'Cover Punch',
            clip: isDefensive ? 'FORWARD_DEFENCE' : 'COVER_DRIVE',
            targetZone: isDefensive ? 'COVER' : 'DEEP_COVER',
            isLofted: false,
            baseRisk: isDefensive ? 0.06 : 0.28,
            expectedRuns: isDefensive ? 0 : 2,
            suitabilityScore: isDefensive ? 90 : prefs.cover,
          },
          {
            shotName: 'Square Cut',
            clip: 'SQUARE_CUT',
            targetZone: 'POINT',
            isLofted: false,
            baseRisk: 0.24,
            expectedRuns: 2,
            suitabilityScore: prefs.point,
          },
          {
            shotName: 'Steer to Third Man',
            clip: 'EDGE',
            targetZone: 'THIRD_MAN',
            isLofted: false,
            baseRisk: 0.12,
            expectedRuns: 1,
            suitabilityScore: prefs.thirdMan + 5,
          },
        ];

      case 'SHORT_OUTSIDE_OFF':
        return [
          {
            shotName: 'Square Cut',
            clip: 'SQUARE_CUT',
            targetZone: isAttacking ? 'DEEP_POINT' : 'POINT',
            isLofted: isAttacking && aggression > 70,
            baseRisk: 0.26,
            expectedRuns: isAttacking ? 4 : 2,
            suitabilityScore: prefs.point + 20,
          },
          {
            shotName: 'Upper Cut',
            clip: 'SQUARE_CUT',
            targetZone: 'DEEP_THIRD_MAN',
            isLofted: true,
            baseRisk: 0.35,
            expectedRuns: 4,
            suitabilityScore: prefs.thirdMan + 15,
          },
        ];

      case 'SHORT_BODY_LEG':
        return [
          {
            shotName: 'Pull Shot',
            clip: 'PULL_SHOT',
            targetZone: isAttacking ? 'DEEP_MIDWICKET' : 'MIDWICKET',
            isLofted: isAttacking && aggression > 60,
            baseRisk: 0.32,
            expectedRuns: isAttacking ? 4 : 2,
            suitabilityScore: prefs.midWicket + 20,
          },
          {
            shotName: 'Hook Shot',
            clip: 'HOOK_SHOT',
            targetZone: 'DEEP_SQUARE_LEG',
            isLofted: true,
            baseRisk: 0.40,
            expectedRuns: isAttacking ? 6 : 4,
            suitabilityScore: prefs.squareLeg + 15,
          },
          {
            shotName: 'Backfoot Defence',
            clip: 'FORWARD_DEFENCE',
            targetZone: 'SQUARE_LEG',
            isLofted: false,
            baseRisk: 0.08,
            expectedRuns: 0,
            suitabilityScore: isDefensive ? 85 : 30,
          },
        ];

      case 'FULL_MIDDLE':
        return [
          {
            shotName: 'Straight Drive',
            clip: 'STRAIGHT_DRIVE',
            targetZone: isAttacking ? 'LONG_ON' : 'STRAIGHT',
            isLofted: isAttacking && aggression > 75,
            baseRisk: 0.18,
            expectedRuns: isAttacking ? 4 : 2,
            suitabilityScore: prefs.straight + 20,
          },
          {
            shotName: 'On Drive',
            clip: 'STRAIGHT_DRIVE',
            targetZone: 'MID_ON',
            isLofted: false,
            baseRisk: 0.15,
            expectedRuns: 1,
            suitabilityScore: prefs.midOn + 10,
          },
          {
            shotName: 'Lofted Straight Six',
            clip: 'LOFTED_SIX',
            targetZone: 'STRAIGHT',
            isLofted: true,
            baseRisk: 0.45,
            expectedRuns: 6,
            suitabilityScore: isAttacking ? prefs.straight + 30 : 10,
          },
        ];

      case 'FULL_LEG':
        return [
          {
            shotName: 'Flick off Pads',
            clip: 'FLICK',
            targetZone: isAttacking ? 'DEEP_MIDWICKET' : 'MIDWICKET',
            isLofted: isAttacking && aggression > 70,
            baseRisk: 0.20,
            expectedRuns: isAttacking ? 4 : 2,
            suitabilityScore: prefs.midWicket + 15,
          },
          {
            shotName: 'Fine Leg Glance',
            clip: 'FLICK',
            targetZone: 'FINE_LEG',
            isLofted: false,
            baseRisk: 0.14,
            expectedRuns: 1,
            suitabilityScore: prefs.fineLeg + 20,
          },
          {
            shotName: 'Square Leg Clip',
            clip: 'FLICK',
            targetZone: 'SQUARE_LEG',
            isLofted: false,
            baseRisk: 0.16,
            expectedRuns: 2,
            suitabilityScore: prefs.squareLeg + 10,
          },
        ];

      case 'YORKER':
      default:
        return [
          {
            shotName: 'Dig Out Yorker',
            clip: 'FORWARD_DEFENCE',
            targetZone: 'MID_ON',
            isLofted: false,
            baseRisk: 0.15,
            expectedRuns: 1,
            suitabilityScore: 80,
          },
          {
            shotName: 'Squeeze to Point',
            clip: 'FORWARD_DEFENCE',
            targetZone: 'POINT',
            isLofted: false,
            baseRisk: 0.20,
            expectedRuns: 1,
            suitabilityScore: 70,
          },
          {
            shotName: 'Late Guide to Third Man',
            clip: 'EDGE',
            targetZone: 'THIRD_MAN',
            isLofted: false,
            baseRisk: 0.22,
            expectedRuns: 1,
            suitabilityScore: 65,
          },
        ];
    }
  }
}

export const shotSelectionEngine = new ShotSelectionEngine();
