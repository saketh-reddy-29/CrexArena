import { Point } from '../strategy/BowlerFieldStrategyEngine';

/**
 * Explicit ball lifecycle states. The next delivery may only become available
 * once the controller returns to READY (after the retrieval chain completes).
 */
export type BallLifecycleState =
  | 'READY'
  | 'DELIVERY_IN_PROGRESS'
  | 'BALL_IN_PLAY'
  | 'FIELDER_INTERCEPTING'
  | 'BALL_COLLECTED'
  | 'RETURNING_BALL'
  | 'BOWLER_RETRIEVING'
  | 'BALL_READY'
  | 'DELIVERY_COMPLETE';

export const BALL_LIFECYCLE_STATES: BallLifecycleState[] = [
  'READY',
  'DELIVERY_IN_PROGRESS',
  'BALL_IN_PLAY',
  'FIELDER_INTERCEPTING',
  'BALL_COLLECTED',
  'RETURNING_BALL',
  'BOWLER_RETRIEVING',
  'BALL_READY',
  'DELIVERY_COMPLETE',
];

/**
 * Legal transition map. Anything not listed here is rejected, which prevents
 * duplicate / out-of-order transitions (e.g. releasing while retrieving).
 */
const TRANSITIONS: Record<BallLifecycleState, BallLifecycleState[]> = {
  READY: ['DELIVERY_IN_PROGRESS'],
  DELIVERY_IN_PROGRESS: ['BALL_IN_PLAY'],
  BALL_IN_PLAY: ['FIELDER_INTERCEPTING', 'BALL_COLLECTED'],
  FIELDER_INTERCEPTING: ['BALL_COLLECTED', 'BALL_IN_PLAY'],
  BALL_COLLECTED: ['RETURNING_BALL'],
  RETURNING_BALL: ['BALL_READY', 'BOWLER_RETRIEVING'],
  BOWLER_RETRIEVING: ['BALL_READY'],
  BALL_READY: ['DELIVERY_COMPLETE'],
  DELIVERY_COMPLETE: ['READY'],
};

/** States in which the ball is unavailable / being retrieved. */
const RETRIEVAL_STATES: BallLifecycleState[] = [
  'BALL_IN_PLAY',
  'FIELDER_INTERCEPTING',
  'BALL_COLLECTED',
  'RETURNING_BALL',
  'BOWLER_RETRIEVING',
];

export function isValidTransition(from: BallLifecycleState, to: BallLifecycleState): boolean {
  return (TRANSITIONS[from] || []).includes(to);
}

export interface BallLifecyclePositions {
  ball: Point;
  bowler: Point;
}

export interface BallLifecycleSnapshot {
  state: BallLifecycleState;
  ballPosition: Point;
  bowlerPosition: Point;
  collectingFielderId: string | null;
  /** True only when a new delivery may legally be bowled. */
  canReleaseDelivery: boolean;
  /** True once the ball has been returned and the bowler is ready. */
  retrievalComplete: boolean;
  message: string;
  history: BallLifecycleState[];
}

const STATE_MESSAGES: Record<BallLifecycleState, string> = {
  READY: 'Ready for next delivery',
  DELIVERY_IN_PROGRESS: 'Bowler running in…',
  BALL_IN_PLAY: 'Ball in play…',
  FIELDER_INTERCEPTING: 'Fielder moving to intercept…',
  BALL_COLLECTED: 'Ball collected',
  RETURNING_BALL: 'Ball being returned…',
  BOWLER_RETRIEVING: 'Bowler retrieving the ball…',
  BALL_READY: 'Ball returned — bowler ready',
  DELIVERY_COMPLETE: 'Delivery complete',
};

export interface RetrievalPlanInput {
  /** Was the ball intercepted by a fielder (caught or stopped)? */
  interceptedByFielder: boolean;
  /** Did the ball reach the boundary (no fielder could stop it)? */
  boundary: boolean;
  /** Does the bowler need to walk to collect the ball (return could not reach)? */
  bowlerNeedsToCollect: boolean;
}

/**
 * Deterministically computes the ordered state chain for the retrieval phase.
 * Used by fast-simulation so it uses the exact same states as visual mode.
 */
export function planRetrievalStates(input: RetrievalPlanInput): BallLifecycleState[] {
  const plan: BallLifecycleState[] = ['BALL_IN_PLAY'];
  if (input.interceptedByFielder) plan.push('FIELDER_INTERCEPTING');
  plan.push('BALL_COLLECTED', 'RETURNING_BALL');
  if (input.bowlerNeedsToCollect) plan.push('BOWLER_RETRIEVING');
  plan.push('BALL_READY', 'DELIVERY_COMPLETE', 'READY');
  return plan;
}

/**
 * Controls delivery, ball-in-play, collection and return transitions.
 *
 * Every mutating method returns `false` (and makes no change) when the
 * transition is illegal, so duplicate calls are naturally idempotent.
 */
export class BallLifecycleController {
  private state: BallLifecycleState;
  private history: BallLifecycleState[];
  private ballPosition: Point;
  private bowlerPosition: Point;
  private collectingFielderId: string | null = null;
  private releasePoint: Point;
  private bowlerHome: Point;

  constructor(opts?: { initialBall?: Point; bowlerHome?: Point }) {
    this.state = 'READY';
    this.history = ['READY'];
    this.releasePoint = opts?.initialBall ?? { x: 300, y: 410 };
    this.bowlerHome = opts?.bowlerHome ?? { x: 300, y: 410 };
    this.ballPosition = { ...this.releasePoint };
    this.bowlerPosition = { ...this.bowlerHome };
  }

  // ── Accessors ──────────────────────────────────────────────────────────────
  getState(): BallLifecycleState {
    return this.state;
  }
  getHistory(): BallLifecycleState[] {
    return [...this.history];
  }
  getBallPosition(): Point {
    return { ...this.ballPosition };
  }
  getBowlerPosition(): Point {
    return { ...this.bowlerPosition };
  }
  getCollectingFielderId(): string | null {
    return this.collectingFielderId;
  }
  getMessage(): string {
    return STATE_MESSAGES[this.state];
  }
  /** True only when a new delivery may be bowled (retrieval fully finished). */
  canReleaseDelivery(): boolean {
    return this.state === 'READY';
  }
  canReleaseNextDelivery(): boolean {
    return this.canReleaseDelivery();
  }
  /** True once the ball is back with the bowler (retrieval chain complete). */
  isRetrievalComplete(): boolean {
    return this.state === 'BALL_READY' || this.state === 'DELIVERY_COMPLETE' || this.state === 'READY';
  }
  isRetrieving(): boolean {
    return RETRIEVAL_STATES.includes(this.state);
  }

  // ── Generic transition ─────────────────────────────────────────────────────
  transition(to: BallLifecycleState): boolean {
    if (!isValidTransition(this.state, to)) return false;
    this.state = to;
    this.history.push(to);
    return true;
  }

  // ── Explicit lifecycle steps ────────────────────────────────────────────────
  /** Attempt to begin a new delivery. Blocked unless the ball is READY. */
  beginDelivery(): boolean {
    return this.transition('DELIVERY_IN_PROGRESS');
  }

  /** Ball has left the bowler's hand. */
  ballEnteredPlay(): boolean {
    if (this.state === 'DELIVERY_IN_PROGRESS') return this.transition('BALL_IN_PLAY');
    return false;
  }

  /** A fielder is now moving to intercept. */
  fielderIntercepts(fielderId: string): boolean {
    if (this.state !== 'BALL_IN_PLAY') return false;
    if (!this.transition('FIELDER_INTERCEPTING')) return false;
    this.collectingFielderId = fielderId;
    return true;
  }

  /** The fielder missed; ball continues in play. */
  fielderMissed(): boolean {
    if (this.state !== 'FIELDER_INTERCEPTING') return false;
    this.collectingFielderId = null;
    return this.transition('BALL_IN_PLAY');
  }

  /** Ball has been collected/stopped. */
  ballCollected(at?: Point, fielderId?: string | null): boolean {
    const allowedFrom: BallLifecycleState[] = ['BALL_IN_PLAY', 'FIELDER_INTERCEPTING'];
    if (!allowedFrom.includes(this.state)) return false;
    if (!this.transition('BALL_COLLECTED')) return false;
    if (at) this.ballPosition = { ...at };
    if (fielderId !== undefined) this.collectingFielderId = fielderId;
    return true;
  }

  /** The collected ball is now being returned toward the bowler. */
  startReturn(): boolean {
    if (this.state !== 'BALL_COLLECTED') return false;
    return this.transition('RETURNING_BALL');
  }

  /** The return fell short / overshot; the bowler must walk to collect it. */
  bowlerNeedsToCollect(): boolean {
    if (this.state !== 'RETURNING_BALL') return false;
    return this.transition('BOWLER_RETRIEVING');
  }

  /** The ball has arrived at the bowler (or was collected by the bowler). */
  ballArrivedAtBowler(): boolean {
    if (this.state === 'RETURNING_BALL' || this.state === 'BOWLER_RETRIEVING') {
      if (!this.transition('BALL_READY')) return false;
      this.ballPosition = { ...this.bowlerPosition };
      this.collectingFielderId = null;
      return true;
    }
    return false;
  }

  /** Ball has left the bowler's hand (alias: releaseBall). */
  releaseBall(): boolean {
    return this.ballEnteredPlay();
  }

  /** Ball has been collected/stopped (alias: collectBall). */
  collectBall(at?: Point, fielderId?: string | null): boolean {
    return this.ballCollected(at, fielderId);
  }

  /** The collected ball is now being returned toward the bowler (alias: returnBall). */
  returnBall(): boolean {
    return this.startReturn();
  }

  /** The ball has arrived at the bowler (alias: bowlerReceives). */
  bowlerReceives(): boolean {
    return this.ballArrivedAtBowler();
  }

  /** Reset back to READY for next delivery if complete. */
  resetForNextDelivery(): boolean {
    if (this.state === 'READY') return true;
    if (this.state === 'DELIVERY_COMPLETE') return this.transition('READY');
    if (this.state === 'BALL_READY') {
      return this.completeDelivery() && this.completeDelivery();
    }
    return false;
  }

  /** Explicit BALL_READY -> DELIVERY_COMPLETE -> READY unwind. */
  completeDelivery(): boolean {
    if (this.state === 'BALL_READY') {
      if (!this.transition('DELIVERY_COMPLETE')) return false;
    }
    if (this.state === 'DELIVERY_COMPLETE') {
      return this.transition('READY');
    }
    return false;
  }

  /**
   * Fast-simulation: drive the controller deterministically through the entire
   * retrieval chain from BALL_IN_PLAY to READY. Never skips retrieval logic;
   * only the rendering is omitted.
   */
  simulateRetrieval(input: RetrievalPlanInput): BallLifecycleState {
    const plan = planRetrievalStates(input);
    for (const next of plan) {
      // Apply the transition using the appropriate semantic method where one
      // exists so side-effects (positions, fielder id) stay consistent.
      switch (next) {
        case 'BALL_IN_PLAY':
          if (this.state === 'READY') this.beginDelivery();
          if (this.state === 'DELIVERY_IN_PROGRESS') this.ballEnteredPlay();
          break;
        case 'FIELDER_INTERCEPTING':
          this.fielderIntercepts('fielder');
          break;
        case 'BALL_COLLECTED':
          this.ballCollected();
          break;
        case 'RETURNING_BALL':
          this.startReturn();
          break;
        case 'BOWLER_RETRIEVING':
          this.bowlerNeedsToCollect();
          break;
        case 'BALL_READY':
          this.ballArrivedAtBowler();
          break;
        case 'DELIVERY_COMPLETE':
          this.completeDelivery();
          break;
        case 'READY':
          this.completeDelivery();
          break;
        default:
          this.transition(next);
      }
    }
    return this.state;
  }

  getSnapshot(): BallLifecycleSnapshot {
    return {
      state: this.state,
      ballPosition: { ...this.ballPosition },
      bowlerPosition: { ...this.bowlerPosition },
      collectingFielderId: this.collectingFielderId,
      canReleaseDelivery: this.canReleaseDelivery(),
      retrievalComplete: this.isRetrievalComplete(),
      message: STATE_MESSAGES[this.state],
      history: [...this.history],
    };
  }

  /** Full reset to READY with the ball back at the bowler's release point. */
  reset(): void {
    this.state = 'READY';
    this.history = ['READY'];
    this.collectingFielderId = null;
    this.ballPosition = { ...this.bowlerHome };
    this.bowlerPosition = { ...this.bowlerHome };
  }

  setBowlerPosition(p: Point): void {
    this.bowlerPosition = { ...p };
    if (this.state === 'BALL_READY' || this.state === 'READY') {
      this.ballPosition = { ...p };
    }
  }
}

/**
 * One-shot deterministic helper: runs a full legal delivery + retrieval cycle
 * and returns the resulting controller (ending in READY). Handy for tests and
 * for fast-simulation loops.
 */
export function runFullDeliveryCycle(input: RetrievalPlanInput): BallLifecycleController {
  const controller = new BallLifecycleController();
  controller.beginDelivery();
  controller.ballEnteredPlay();
  controller.simulateRetrieval(input);
  return controller;
}
