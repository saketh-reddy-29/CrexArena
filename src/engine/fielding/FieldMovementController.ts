import { Fielder3DCoord } from '../strategy/FieldStrategyEngine';

export type FielderMovementState =
  | 'STATIONARY'
  | 'WALKING'
  | 'RUNNING'
  | 'POSITIONING'
  | 'READY';

export interface FielderTransition {
  name: string;
  startPos: { x: number; y: number; z: number };
  targetPos: { x: number; y: number; z: number };
  currentPos: { x: number; y: number; z: number };
  state: FielderMovementState;
  progress: number; // 0.0 to 1.0
  distance: number;
}

export class FieldMovementController {
  private transitions: FielderTransition[] = [];
  private isRepositioning: boolean = false;

  /**
   * Begins a smooth field reorganization transition from old coordinates to new coordinates
   */
  public planFieldTransition(
    currentFielders: { name: string; pos: { x: number; y: number; z: number } }[],
    newPositions: Fielder3DCoord[]
  ): FielderTransition[] {
    this.transitions = newPositions.map((target, idx) => {
      const current = currentFielders[idx] || { name: target.name, pos: { x: target.x, y: 0.04, z: target.z } };
      const startPos = { ...current.pos };
      const targetPos = { x: target.x, y: 0.04, z: target.z };
      const distance = Math.hypot(targetPos.x - startPos.x, targetPos.z - startPos.z);

      const state: FielderMovementState = distance > 8.0 ? 'RUNNING' : distance > 0.5 ? 'WALKING' : 'READY';

      return {
        name: target.name,
        startPos,
        targetPos,
        currentPos: { ...startPos },
        state,
        progress: distance < 0.5 ? 1.0 : 0.0,
        distance,
      };
    });

    this.isRepositioning = this.transitions.some((t) => t.distance > 0.5);
    return this.transitions;
  }

  /**
   * Advances the field transition progress (0.0 to 1.0)
   */
  public updateProgress(p: number): FielderTransition[] {
    const clampedP = Math.max(0, Math.min(1, p));

    this.transitions.forEach((t) => {
      t.progress = clampedP;
      t.currentPos.x = t.startPos.x + (t.targetPos.x - t.startPos.x) * clampedP;
      t.currentPos.z = t.startPos.z + (t.targetPos.z - t.startPos.z) * clampedP;

      if (clampedP >= 1.0) {
        t.state = 'READY';
      } else if (t.distance > 8.0) {
        t.state = 'RUNNING';
      } else if (t.distance > 0.5) {
        t.state = 'WALKING';
      } else {
        t.state = 'READY';
      }
    });

    if (clampedP >= 1.0) {
      this.isRepositioning = false;
    }

    return this.transitions;
  }

  public isFieldReady(): boolean {
    return !this.isRepositioning || this.transitions.every((t) => t.progress >= 1.0);
  }

  public getTransitions(): FielderTransition[] {
    return this.transitions;
  }
}

export const fieldMovementController = new FieldMovementController();
