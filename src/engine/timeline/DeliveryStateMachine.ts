import { DeliveryResult } from '../models/DeliveryResult';

export type DeliveryState =
  | 'PRE_DELIVERY'
  | 'FIELD_SETUP'
  | 'BOWLER_READY'
  | 'BOWLER_RUNUP'
  | 'BALL_RELEASE'
  | 'BALL_IN_FLIGHT'
  | 'BOUNCE'
  | 'BATTER_ACTION'
  | 'CONTACT'
  | 'BALL_TRAVEL'
  | 'FIELDER_REACTION'
  | 'FIELDER_ACTION'
  | 'RUNNING'
  | 'WICKET_ACTION'
  | 'BOUNDARY_ACTION'
  | 'RESULT_CONFIRMATION'
  | 'SCORECARD_UPDATE'
  | 'CELEBRATION'
  | 'FIELD_CHANGE'
  | 'DELIVERY_COMPLETE';

export interface TimelinePhaseDurations {
  fieldSetupEnd: number;       // 0.00 -> 0.10
  bowlerReadyEnd: number;      // 0.10 -> 0.16
  runupEnd: number;            // 0.16 -> 0.32: Bowler runup sprint
  releaseEnd: number;          // 0.32 -> 0.38: Windmill & overarm release
  flightEnd: number;           // 0.38 -> 0.48: Flight to pitch bounce
  contactEnd: number;          // 0.48 -> 0.58: Bat stroke & contact
  travelEnd: number;           // 0.58 -> 0.74: Ball travel to field/boundary/stumps
  resultConfirmEnd: number;    // 0.74 -> 0.80: Physical outcome confirmed
  scorecardUpdateEnd: number;  // 0.80 -> 0.84: Atomic scorecard update fires
  celebrationEnd: number;      // 0.84 -> 0.94: Celebration, appeal, bat raise
  fieldChangeEnd: number;      // 0.94 -> 1.00: Fielders walk to next positions
}

export interface DeliveryPacingConfig {
  totalDurationMs: number;
  phases: TimelinePhaseDurations;
}

export class DeliveryStateMachine {
  private currentState: DeliveryState = 'PRE_DELIVERY';
  private deliveryLocked: boolean = false;
  private currentDelivery: DeliveryResult | null = null;
  private scorecardUpdated: boolean = false;

  /**
   * Computes format and outcome adaptive timeline duration
   */
  public getPacingConfig(format: string, result: DeliveryResult): DeliveryPacingConfig {
    const fmt = format.toUpperCase();
    const isWicket = result.wicket;
    const isSix = result.batterRuns === 6;
    const isFour = result.batterRuns === 4;
    const isBoundary = isSix || isFour;

    let baseMs = 5000; // T20 normal ~5.0s

    if (fmt === 'TEST') {
      if (isWicket) baseMs = 9000;
      else if (isBoundary) baseMs = 7500;
      else baseMs = 6500;
    } else if (fmt === 'ODI') {
      if (isWicket) baseMs = 7500;
      else if (isBoundary) baseMs = 6500;
      else baseMs = 5500;
    } else {
      // T20
      if (isWicket) baseMs = 7000;
      else if (isSix) baseMs = 6500;
      else if (isFour) baseMs = 6000;
      else baseMs = 5000;
    }

    return {
      totalDurationMs: baseMs,
      phases: {
        fieldSetupEnd: 0.10,
        bowlerReadyEnd: 0.16,
        runupEnd: 0.32,
        releaseEnd: 0.38,
        flightEnd: 0.48,
        contactEnd: 0.58,
        travelEnd: 0.74,
        resultConfirmEnd: 0.80,
        scorecardUpdateEnd: 0.84,
        celebrationEnd: 0.94,
        fieldChangeEnd: 1.00,
      },
    };
  }

  public startDelivery(delivery: DeliveryResult): void {
    this.currentDelivery = delivery;
    this.deliveryLocked = true;
    this.scorecardUpdated = false;
    this.currentState = 'PRE_DELIVERY';
  }

  /**
   * Advances the 19-state delivery state machine based on normalized progress (0.0 to 1.0)
   */
  public updateProgress(progress: number, pacing: DeliveryPacingConfig): {
    state: DeliveryState;
    shouldApplyScorecard: boolean;
    isDeliveryComplete: boolean;
  } {
    const p = Math.max(0, Math.min(1, progress));
    const { phases } = pacing;
    let shouldApplyScorecard = false;

    if (p < phases.fieldSetupEnd) {
      this.currentState = 'FIELD_SETUP';
    } else if (p < phases.bowlerReadyEnd) {
      this.currentState = 'BOWLER_READY';
    } else if (p < phases.runupEnd) {
      this.currentState = 'BOWLER_RUNUP';
    } else if (p < phases.releaseEnd) {
      this.currentState = 'BALL_RELEASE';
    } else if (p < phases.flightEnd) {
      this.currentState = 'BALL_IN_FLIGHT';
    } else if (p < phases.contactEnd) {
      this.currentState = 'BATTER_ACTION';
    } else if (p < phases.travelEnd) {
      this.currentState = this.currentDelivery?.wicket ? 'WICKET_ACTION' : this.currentDelivery?.batterRuns === 4 || this.currentDelivery?.batterRuns === 6 ? 'BOUNDARY_ACTION' : 'BALL_TRAVEL';
    } else if (p < phases.resultConfirmEnd) {
      this.currentState = 'RESULT_CONFIRMATION';
    } else if (p < phases.scorecardUpdateEnd) {
      this.currentState = 'SCORECARD_UPDATE';
      if (!this.scorecardUpdated) {
        this.scorecardUpdated = true;
        shouldApplyScorecard = true;
      }
    } else if (p < phases.celebrationEnd) {
      this.currentState = 'CELEBRATION';
    } else if (p < phases.fieldChangeEnd) {
      this.currentState = 'FIELD_CHANGE';
    } else {
      this.currentState = 'DELIVERY_COMPLETE';
      this.deliveryLocked = false;
    }

    return {
      state: this.currentState,
      shouldApplyScorecard,
      isDeliveryComplete: this.currentState === 'DELIVERY_COMPLETE',
    };
  }

  public isLocked(): boolean {
    return this.deliveryLocked;
  }

  public getState(): DeliveryState {
    return this.currentState;
  }
}

export const deliveryStateMachine = new DeliveryStateMachine();
