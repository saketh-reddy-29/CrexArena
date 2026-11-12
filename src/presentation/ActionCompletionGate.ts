export type DeliveryStage =
  | 'PRE_DELIVERY'
  | 'BOWLER_RUNUP'
  | 'BALL_RELEASE'
  | 'BALL_APPROACH'
  | 'BAT_CONTACT'
  | 'BALL_TRAVELLING'
  | 'OUTCOME_SEQUENCE'
  | 'RECOVERY'
  | 'READY_FOR_NEXT';

export interface ActionGateListener {
  onStageChange?: (stage: DeliveryStage) => void;
  onActionComplete?: () => void;
}

export class ActionCompletionGate {
  private stage: DeliveryStage = 'PRE_DELIVERY';
  private locked: boolean = false;
  private listeners: Set<ActionGateListener> = new Set();
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private safetyTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.stage = 'READY_FOR_NEXT';
    this.locked = false;
  }

  public getStage(): DeliveryStage {
    return this.stage;
  }

  public isBusy(): boolean {
    return this.locked || this.stage !== 'READY_FOR_NEXT';
  }

  public startDelivery(): boolean {
    if (this.isBusy()) return false;

    this.locked = true;
    this.setStage('BOWLER_RUNUP');

    // Safety timeout: Never leave the game permanently locked under any circumstance
    if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
    this.safetyTimeout = setTimeout(() => {
      if (this.locked) {
        console.warn('ActionCompletionGate safety timeout triggered; unlocking gate.');
        this.completeAction();
      }
    }, 12000);

    return true;
  }

  public setStage(stage: DeliveryStage) {
    if (this.stage === stage) return;
    this.stage = stage;
    this.listeners.forEach((l) => l.onStageChange?.(stage));
  }

  public triggerBallRelease() {
    this.setStage('BALL_RELEASE');
  }

  public triggerBallApproach() {
    this.setStage('BALL_APPROACH');
  }

  public triggerBatContact() {
    this.setStage('BAT_CONTACT');
  }

  public triggerBallTravelling() {
    this.setStage('BALL_TRAVELLING');
  }

  public triggerOutcome(outcomeDurationMs = 2400) {
    this.setStage('OUTCOME_SEQUENCE');

    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.triggerRecovery();
    }, outcomeDurationMs);
  }

  public triggerRecovery(recoveryDurationMs = 1200) {
    this.setStage('RECOVERY');

    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = setTimeout(() => {
      this.completeAction();
    }, recoveryDurationMs);
  }

  public completeAction() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    if (this.safetyTimeout) clearTimeout(this.safetyTimeout);
    this.recoveryTimer = null;
    this.safetyTimeout = null;

    this.locked = false;
    this.setStage('READY_FOR_NEXT');
    this.listeners.forEach((l) => l.onActionComplete?.());
  }

  public subscribe(listener: ActionGateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export default ActionCompletionGate;
