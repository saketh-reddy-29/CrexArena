import { isEligibleBowler } from './bowlerEligibility';
import { Player } from '../../types/common';

export interface AssertDeliveryParams {
  bowler: Player | null | undefined;
  striker: Player | null | undefined;
  totalRuns: number;
  batterRuns: number;
  extraRuns: number;
  trajectory?: {
    startPos?: { x: number; y: number; z: number };
    bouncePos?: { x: number; y: number; z: number };
    contactPos?: { x: number; y: number; z: number };
    targetPos?: { x: number; y: number; z: number };
  } | null;
}

export class DeliveryAssertionError extends Error {
  constructor(message: string) {
    super(`[DeliveryAssertionError] ${message}`);
    this.name = 'DeliveryAssertionError';
  }
}

let is3DPlaybackSimulating = false;

export function set3DPlaybackActive(active: boolean): void {
  is3DPlaybackSimulating = active;
}

export function is3DPlaybackActive(): boolean {
  return is3DPlaybackSimulating;
}

/**
 * Validates critical delivery constraints before execution
 */
export function assertPreDelivery(params: AssertDeliveryParams): void {
  const { bowler, striker, totalRuns, batterRuns, extraRuns, trajectory } = params;

  if (is3DPlaybackSimulating) {
    throw new DeliveryAssertionError('simulateDelivery() must never be called from within 3D playback! Match engine owns simulation.');
  }

  if (!bowler) {
    throw new DeliveryAssertionError('Bowler must be defined for delivery execution');
  }

  if (!isEligibleBowler(bowler)) {
    throw new DeliveryAssertionError(`Ineligible player assigned as bowler: ${bowler.name} (Role: ${bowler.role})`);
  }

  if (striker && bowler.id === striker.id) {
    throw new DeliveryAssertionError(`Bowler and Striker cannot be the same player: ${bowler.name}`);
  }

  if (!Number.isFinite(totalRuns) || totalRuns < 0) {
    throw new DeliveryAssertionError(`totalRuns must be a non-negative finite number, received: ${totalRuns}`);
  }

  if (!Number.isFinite(batterRuns) || batterRuns < 0) {
    throw new DeliveryAssertionError(`batterRuns must be a non-negative finite number, received: ${batterRuns}`);
  }

  if (!Number.isFinite(extraRuns) || extraRuns < 0) {
    throw new DeliveryAssertionError(`extraRuns must be a non-negative finite number, received: ${extraRuns}`);
  }

  if (trajectory) {
    if (!trajectory.startPos || !trajectory.contactPos || !trajectory.targetPos) {
      throw new DeliveryAssertionError('INVALID BALL TRAJECTORY: Missing key waypoint coordinates (startPos, contactPos, targetPos)');
    }
    if (
      !Number.isFinite(trajectory.startPos.z) ||
      !Number.isFinite(trajectory.contactPos.z) ||
      !Number.isFinite(trajectory.targetPos.z)
    ) {
      throw new DeliveryAssertionError('INVALID BALL TRAJECTORY: Non-finite coordinate values in trajectory');
    }
  }
}

/**
 * Tracks delivery completion lifecycle invariants
 */
export class DeliveryCompletionTracker {
  private scoreUpdatedCount = 0;
  private deliverySavedCount = 0;
  private deliveryCompletedCount = 0;

  public markScoreUpdated(): void {
    this.scoreUpdatedCount++;
  }

  public markDeliverySaved(): void {
    this.deliverySavedCount++;
  }

  public markDeliveryComplete(): void {
    this.deliveryCompletedCount++;
  }

  public assertCompletion(): void {
    if (this.scoreUpdatedCount !== 1) {
      throw new DeliveryAssertionError(`scoreUpdated should be called exactly once per delivery, was called: ${this.scoreUpdatedCount} times`);
    }
    if (this.deliverySavedCount !== 1) {
      throw new DeliveryAssertionError(`deliverySaved should be called exactly once per delivery, was called: ${this.deliverySavedCount} times`);
    }
    if (this.deliveryCompletedCount !== 1) {
      throw new DeliveryAssertionError(`deliveryComplete should be called exactly once per delivery, was called: ${this.deliveryCompletedCount} times`);
    }
  }
}
