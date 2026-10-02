import { ScoringZoneName, BatterHand, getZoneCoordinates } from './ScoringZones';
import { shotSelectionEngine, DeliveryLineLength, ShotCandidate, BatterScoringPreferences } from './ShotSelectionEngine';
import { batTimingEngine, BatTimingResult } from './BatTimingEngine';
import { batContactEngine, BatContactResult } from './BatContactEngine';
import { scoringGapEngine, ScoringGapAnalysis } from './ScoringGapEngine';
import { Fielder3DCoord } from '../strategy/FieldStrategyEngine';
import { PlayerAnimState } from '../../components/CricketPlayer3D';

export interface FullGroundDeliveryResult {
  shotName: string;
  batterAnim: PlayerAnimState;
  targetZone: ScoringZoneName;
  targetPos: { x: number; y: number; z: number };
  shotAngleDeg: number;
  isAerial: boolean;
  timing: BatTimingResult;
  contact: BatContactResult;
  gapAnalysis: ScoringGapAnalysis;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  dismissalFielderName: string | null;
}

export class FullGroundScoringEngine {
  /**
   * Executes the full pipeline: Delivery -> Shot Selection -> Timing & Contact -> Gap Physics -> Result
   */
  public simulate(
    deliveryType: DeliveryLineLength,
    fielders: Fielder3DCoord[],
    batterHand: BatterHand = 'RIGHT_HAND',
    preferences: BatterScoringPreferences = {},
    batterStats: {
      technique?: number;
      timing?: number;
      power?: number;
      aggression?: number;
      settledness?: number;
      form?: number;
    } = {},
    bowlerStats: {
      bowlingRating?: number;
      speedKph?: number;
      movementScore?: number;
    } = {},
    intent: string = 'BALANCED'
  ): FullGroundDeliveryResult {
    const technique = batterStats.technique ?? 75;
    const timingAttr = batterStats.timing ?? 75;
    const settledness = batterStats.settledness ?? 50;
    const form = batterStats.form ?? 100;
    const aggression = batterStats.aggression ?? 50;

    const speedKph = bowlerStats.speedKph ?? 135;
    const movementScore = bowlerStats.movementScore ?? 60;

    // 1. Batter reads delivery and selects shot & target zone
    const shotCandidate: ShotCandidate = shotSelectionEngine.selectShot(
      deliveryType,
      batterHand,
      preferences,
      intent,
      aggression,
      technique
    );

    // 2. Bat Contact Evaluation
    const contact: BatContactResult = batContactEngine.evaluate(
      technique,
      movementScore,
      shotCandidate.clip === 'FORWARD_DEFENCE'
    );

    // 3. Bat Stroke Timing Evaluation
    const timing: BatTimingResult = batTimingEngine.evaluate(
      timingAttr,
      settledness,
      form,
      speedKph,
      shotCandidate.isLofted
    );

    // 4. Compute 3D Ground Coordinates for Target Zone
    let zoneDistanceFraction = 0.85;
    if (timing.quality === 'PERFECT') zoneDistanceFraction = 1.0;
    else if (timing.quality === 'GOOD') zoneDistanceFraction = 0.85;
    else if (timing.quality === 'AVERAGE') zoneDistanceFraction = 0.55;
    else zoneDistanceFraction = 0.35;

    // If edged or deflecting, redirect towards slips or third man
    let targetZone = shotCandidate.targetZone;
    if (contact.isEdge) {
      targetZone = Math.random() > 0.4 ? 'SLIPS' : 'THIRD_MAN';
    }

    const zoneCoords = getZoneCoordinates(targetZone, zoneDistanceFraction, batterHand);

    // Apply deflection if bat edge
    const finalAngle = zoneCoords.angleDeg + contact.deflectionAngleOffsetDeg;
    const targetPos = {
      x: zoneCoords.x,
      y: timing.aerialHeightMeters,
      z: zoneCoords.z,
    };

    // 5. Scoring Gap & Fielder Interception Analysis
    const gapAnalysis = scoringGapEngine.evaluateGap(
      { x: targetPos.x, z: targetPos.z },
      fielders,
      shotCandidate.isLofted,
      timing.exitVelocityMps * contact.speedMultiplier
    );

    // 6. Final Outcome Synthesis
    let runs = 0;
    let isWicket = false;
    let wicketType: string | null = null;
    let dismissalFielderName: string | null = null;

    if (contact.isMissed) {
      if (deliveryType === 'YORKER' || deliveryType === 'FULL_MIDDLE') {
        isWicket = true;
        wicketType = 'Bowled';
      } else {
        runs = 0; // Dot ball
      }
    } else if (contact.isPad) {
      if (deliveryType === 'FULL_MIDDLE' || deliveryType === 'FULL_LEG') {
        isWicket = Math.random() < 0.65;
        wicketType = isWicket ? 'LBW' : null;
      }
      runs = 0;
    } else if (contact.isEdge) {
      const catchRoll = Math.random();
      if (catchRoll < 0.60) {
        isWicket = true;
        wicketType = Math.random() > 0.5 ? 'Caught Behind (Keeper)' : `Caught by ${gapAnalysis.nearestFielderName}`;
        dismissalFielderName = gapAnalysis.nearestFielderName;
      } else {
        runs = 1; // Thick edge races down to third man for a single
      }
    } else if (gapAnalysis.quality === 'CATCHING_CHANCE') {
      const catchRoll = Math.random();
      if (catchRoll < gapAnalysis.interceptionProbability) {
        isWicket = true;
        wicketType = `Caught by ${gapAnalysis.nearestFielderName}`;
        dismissalFielderName = gapAnalysis.nearestFielderName;
      } else {
        runs = 1; // Dropped catch
      }
    } else {
      // Clean shot outcome based on gap and timing
      if (shotCandidate.isLofted && timing.quality === 'PERFECT' && gapAnalysis.maxSafeRuns === 6) {
        runs = 6;
      } else if (gapAnalysis.quality === 'WIDE_OPEN_BOUNDARY' && timing.quality !== 'MISTIMED') {
        runs = 4;
      } else if (gapAnalysis.quality === 'CLEAN_GAP_2_RUNS') {
        runs = 2;
      } else if (gapAnalysis.quality === 'TIGHT_GAP_1_RUN') {
        runs = 1;
      } else {
        runs = 0; // Straight to fielder
      }
    }

    return {
      shotName: shotCandidate.shotName,
      batterAnim: shotCandidate.clip,
      targetZone,
      targetPos,
      shotAngleDeg: finalAngle,
      isAerial: shotCandidate.isLofted,
      timing,
      contact,
      gapAnalysis,
      runs,
      isWicket,
      wicketType,
      dismissalFielderName,
    };
  }
}

export const fullGroundScoringEngine = new FullGroundScoringEngine();
