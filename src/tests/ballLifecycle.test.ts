import { describe, it, expect } from 'vitest';
import {
  BallLifecycleController,
  BallLifecycleState,
  isValidTransition,
  planRetrievalStates,
  runFullDeliveryCycle,
} from '../engine/fielding/BallLifecycleController';

describe('BallLifecycleController — transition graph', () => {
  it('accepts only legal transitions', () => {
    expect(isValidTransition('READY', 'DELIVERY_IN_PROGRESS')).toBe(true);
    expect(isValidTransition('DELIVERY_IN_PROGRESS', 'BALL_IN_PLAY')).toBe(true);
    expect(isValidTransition('BALL_COLLECTED', 'RETURNING_BALL')).toBe(true);
    expect(isValidTransition('RETURNING_BALL', 'BALL_READY')).toBe(true);
    expect(isValidTransition('BALL_READY', 'DELIVERY_COMPLETE')).toBe(true);
    expect(isValidTransition('DELIVERY_COMPLETE', 'READY')).toBe(true);
  });

  it('rejects illegal transitions (no releasing mid-retrieval)', () => {
    expect(isValidTransition('READY', 'BALL_IN_PLAY')).toBe(false);
    expect(isValidTransition('RETURNING_BALL', 'DELIVERY_IN_PROGRESS')).toBe(false);
    expect(isValidTransition('BALL_IN_PLAY', 'READY')).toBe(false);
    expect(isValidTransition('FIELDER_INTERCEPTING', 'RETURNING_BALL')).toBe(false);
  });
});

describe('BallLifecycleController — gating', () => {
  it('starts READY and allows a delivery', () => {
    const c = new BallLifecycleController();
    expect(c.getState()).toBe('READY');
    expect(c.canReleaseDelivery()).toBe(true);
  });

  it('blocks a new delivery until retrieval fully completes', () => {
    const c = new BallLifecycleController();
    expect(c.beginDelivery()).toBe(true);
    expect(c.canReleaseDelivery()).toBe(false);
    c.ballEnteredPlay();
    expect(c.canReleaseDelivery()).toBe(false);
    c.fielderIntercepts('f1');
    expect(c.canReleaseDelivery()).toBe(false);
    c.ballCollected({ x: 200, y: 300 }, 'f1');
    expect(c.canReleaseDelivery()).toBe(false);
    c.startReturn();
    expect(c.canReleaseDelivery()).toBe(false);
    c.ballArrivedAtBowler();
    expect(c.canReleaseDelivery()).toBe(false); // still BALL_READY, not READY
    expect(c.isRetrievalComplete()).toBe(true);
    c.completeDelivery(); // -> DELIVERY_COMPLETE
    c.completeDelivery(); // -> READY
    expect(c.getState()).toBe('READY');
    expect(c.canReleaseDelivery()).toBe(true);
  });

  it('rejects repeated clicks while a delivery is in flight', () => {
    const c = new BallLifecycleController();
    expect(c.beginDelivery()).toBe(true);
    expect(c.beginDelivery()).toBe(false); // duplicate rejected
    expect(c.getState()).toBe('DELIVERY_IN_PROGRESS');
    expect(c.ballEnteredPlay()).toBe(true);
    expect(c.ballEnteredPlay()).toBe(false); // duplicate rejected
    expect(c.getState()).toBe('BALL_IN_PLAY');
  });

  it('handles a fielder missing the ball and continuing play', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    expect(c.fielderIntercepts('f1')).toBe(true);
    expect(c.fielderMissed()).toBe(true);
    expect(c.getState()).toBe('BALL_IN_PLAY');
    expect(c.getCollectingFielderId()).toBeNull();
    expect(c.ballCollected()).toBe(true); // boundary chase still collects
    expect(c.startReturn()).toBe(true);
  });

  it('routes a short return to the bowler (BOWLER_RETRIEVING) before ready', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    c.ballCollected({ x: 200, y: 200 }, 'f3');
    c.startReturn();
    expect(c.bowlerNeedsToCollect()).toBe(true);
    expect(c.getState()).toBe('BOWLER_RETRIEVING');
    expect(c.canReleaseDelivery()).toBe(false);
    expect(c.ballArrivedAtBowler()).toBe(true);
    expect(c.getState()).toBe('BALL_READY');
  });
});

describe('BallLifecycleController — retrieval simulation (fast mode)', () => {
  it('produces a deterministic state plan for an intercepted ball', () => {
    const plan = planRetrievalStates({ interceptedByFielder: true, boundary: false, bowlerNeedsToCollect: false });
    expect(plan).toEqual([
      'BALL_IN_PLAY',
      'FIELDER_INTERCEPTING',
      'BALL_COLLECTED',
      'RETURNING_BALL',
      'BALL_READY',
      'DELIVERY_COMPLETE',
      'READY',
    ]);
  });

  it('skips the interception stage for a boundary', () => {
    const plan = planRetrievalStates({ interceptedByFielder: false, boundary: true, bowlerNeedsToCollect: true });
    expect(plan).not.toContain('FIELDER_INTERCEPTING');
    expect(plan).toContain('BOWLER_RETRIEVING');
  });

  it('drives a full intercepted cycle back to READY', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    const end = c.simulateRetrieval({ interceptedByFielder: true, boundary: false, bowlerNeedsToCollect: false });
    expect(end).toBe('READY');
    expect(c.canReleaseDelivery()).toBe(true);
  });

  it('drives a boundary + bowler-collect cycle back to READY', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    const end = c.simulateRetrieval({ interceptedByFielder: false, boundary: true, bowlerNeedsToCollect: true });
    expect(end).toBe('READY');
    expect(c.canReleaseDelivery()).toBe(true);
  });

  it('runFullDeliveryCycle ends READY and can repeat for a whole over', () => {
    let c = runFullDeliveryCycle({ interceptedByFielder: true, boundary: false, bowlerNeedsToCollect: false });
    expect(c.canReleaseDelivery()).toBe(true);
    for (let i = 0; i < 6; i++) {
      expect(c.beginDelivery()).toBe(true);
      expect(c.ballEnteredPlay()).toBe(true);
      c.simulateRetrieval({ interceptedByFielder: i % 2 === 0, boundary: i === 3, bowlerNeedsToCollect: i === 5 });
      expect(c.getState()).toBe('READY');
      expect(c.canReleaseDelivery()).toBe(true);
    }
  });

  it('uses the same state vocabulary for fast and visual modes', () => {
    const visual = new BallLifecycleController();
    visual.beginDelivery();
    visual.ballEnteredPlay();
    visual.fielderIntercepts('f1');
    visual.ballCollected({ x: 210, y: 300 }, 'f1');
    visual.startReturn();
    visual.ballArrivedAtBowler();
    visual.completeDelivery();
    visual.completeDelivery();

    const fast = new BallLifecycleController();
    fast.beginDelivery();
    fast.ballEnteredPlay();
    fast.simulateRetrieval({ interceptedByFielder: true, boundary: false, bowlerNeedsToCollect: false });

    expect(fast.getHistory().slice(1)).toEqual(visual.getHistory().slice(1));
  });
});

describe('BallLifecycleController — no teleport', () => {
  it('ball ends at the bowler position once returned', () => {
    const c = new BallLifecycleController({ bowlerHome: { x: 300, y: 410 } });
    c.beginDelivery();
    c.ballEnteredPlay();
    c.ballCollected({ x: 120, y: 120 }, 'deep');
    c.startReturn();
    c.ballArrivedAtBowler();
    expect(c.getBallPosition()).toEqual({ x: 300, y: 410 });
  });

  it('reports human-readable status messages per state', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    c.fielderIntercepts('f1');
    c.ballCollected();
    c.startReturn();
    expect(c.getMessage()).toBe('Ball being returned…');
    c.ballArrivedAtBowler();
    expect(c.getMessage()).toBe('Ball returned — bowler ready');
  });

  it('reset() returns everything to a clean READY state', () => {
    const c = new BallLifecycleController();
    c.beginDelivery();
    c.ballEnteredPlay();
    c.fielderIntercepts('f1');
    c.reset();
    expect(c.getState()).toBe('READY');
    expect(c.getHistory()).toEqual(['READY' as BallLifecycleState]);
    expect(c.getBallPosition()).toEqual({ x: 300, y: 410 });
  });
});
