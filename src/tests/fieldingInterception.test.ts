import { describe, it, expect } from 'vitest';
import {
  evaluateInterception,
  nearestFielder,
  projectPointOnSegment,
  FielderProfile,
  BOUNDARY_RADIUS,
} from '../engine/fielding/FieldingInterceptionEngine';
import { BallTrajectoryPath } from '../types/delivery';

const CONTACT = { x: 300, y: 190 };

function groundPath(target: { x: number; y: number }): BallTrajectoryPath {
  return {
    start: { x: 300, y: 410 },
    bounce: { x: 300, y: 270 },
    contact: CONTACT,
    target,
    isAerial: false,
    apexHeight: 0,
  };
}

function aerialPath(target: { x: number; y: number }): BallTrajectoryPath {
  return {
    start: { x: 300, y: 410 },
    bounce: { x: 300, y: 270 },
    contact: CONTACT,
    target,
    isAerial: true,
    apexHeight: 12,
  };
}

const f = (id: string, x: number, y: number, opts: Partial<FielderProfile> = {}): FielderProfile => ({
  id,
  name: `Fielder ${id}`,
  x,
  y,
  speed: 40,
  fieldingRating: 90,
  catchingRating: 90,
  ...opts,
});

describe('FieldingInterceptionEngine — geometry helpers', () => {
  it('projects a point onto a segment and reports the fraction', () => {
    const r = projectPointOnSegment({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(r.point.x).toBeCloseTo(5);
    expect(r.point.y).toBeCloseTo(0);
    expect(r.fraction).toBeCloseTo(0.5);
  });

  it('clamps projection beyond the segment ends', () => {
    const r = projectPointOnSegment({ x: 50, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(r.fraction).toBe(1);
  });

  it('finds the nearest fielder', () => {
    const fielders = [f('a', 100, 100), f('b', 290, 300), f('c', 500, 500)];
    expect(nearestFielder({ x: 300, y: 300 }, fielders)?.id).toBe('b');
  });
});

describe('FieldingInterceptionEngine — physical outcomes', () => {
  it('STOPS a ground ball when a fielder can reach the path', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 200, y: 300 }),
      fielders: [f('cover', 200, 300)],
      rng: () => 0.99, // avoid the misfield branch
    });
    expect(res.outcome).toBe('STOPPED');
    expect(res.fielderId).toBe('cover');
    expect(res.isCatch).toBe(false);
    expect(res.reachable).toBe(true);
  });

  it('lets a ground ball THROUGH when no fielder can reach it', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 250, y: 300 }),
      fielders: [f('far', 50, 50, { speed: 5, fieldingRating: 10 })],
      rng: () => 0.99,
    });
    expect(res.outcome).toBe('THROUGH');
    expect(res.reachable).toBe(false);
    expect(res.fielderId).toBeNull();
  });

  it('reaches BOUNDARY when the ball crosses the rope untouched', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 300 + BOUNDARY_RADIUS, y: 300 }),
      fielders: [f('far', 50, 50, { speed: 5 })],
      rng: () => 0.99,
    });
    expect(res.outcome).toBe('BOUNDARY');
    expect(res.boundary).toBe(true);
  });

  it('completes a CAUGHT dismissal on a comfortable aerial ball', () => {
    const res = evaluateInterception({
      ballPath: aerialPath({ x: 200, y: 200 }),
      fielders: [f('mid', 200, 200, { catchingRating: 95 })],
      rng: () => 0, // force the catch
    });
    expect(res.outcome).toBe('CAUGHT');
    expect(res.isCatch).toBe(true);
    expect(res.isDrop).toBe(false);
  });

  it('turns a failed aerial attempt into a DROPPED catch (STOPPED + isDrop)', () => {
    const res = evaluateInterception({
      ballPath: aerialPath({ x: 200, y: 200 }),
      fielders: [f('mid', 200, 200, { catchingRating: 40 })],
      rng: () => 0.999, // fail the catch roll
    });
    expect(res.outcome).toBe('STOPPED');
    expect(res.isDrop).toBe(true);
    expect(res.isCatch).toBe(false);
  });

  it('MISFIELDS a ground ball on a low fielding roll', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 200, y: 300 }),
      fielders: [f('cover', 200, 300, { fieldingRating: 40 })],
      rng: () => 0, // force the misfield branch
    });
    expect(res.outcome).toBe('MISSED');
  });

  it('does not award a stop simply because a fielder is nearest', () => {
    // Nearest fielder is slow; ball is fast toward the rope.
    const res = evaluateInterception({
      ballPath: groundPath({ x: 300 + BOUNDARY_RADIUS, y: 300 }),
      fielders: [f('nearest', 60, 300, { speed: 3, fieldingRating: 20 })],
      rng: () => 0.99,
    });
    expect(res.outcome).toBe('BOUNDARY');
    expect(res.reachable).toBe(false);
  });

  it('prefers the comfortably-reaching fielder among several', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 200, y: 300 }),
      fielders: [
        f('slow_far', 200, 300, { speed: 2 }),
        f('fast_near', 220, 300, { speed: 40, fieldingRating: 95 }),
      ],
      rng: () => 0.99,
    });
    expect(res.outcome).toBe('STOPPED');
    expect(res.reachable).toBe(true);
  });

  it('exposes time/distance metadata used by the retrieval animation', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 200, y: 300 }),
      fielders: [f('cover', 210, 300)],
      rng: () => 0.99,
    });
    expect(res.distanceToBall).toBeGreaterThan(0);
    expect(res.timeToBall).toBeGreaterThan(0);
    expect(res.ballTravelTime).toBeGreaterThanOrEqual(0);
    expect(res.confidence).toBeGreaterThan(0);
  });

  it('keeps a keeper standing up able to stop a thin edge (no boundary awarded)', () => {
    const res = evaluateInterception({
      ballPath: groundPath({ x: 300, y: 430 }),
      fielders: [f('wk', 300, 430, { fieldingRating: 92 })],
      rng: () => 0.99,
    });
    expect(['STOPPED', 'MISSED']).toContain(res.outcome);
    expect(res.boundary).toBe(false);
  });
});
