import { Point } from '../strategy/BowlerFieldStrategyEngine';
import { BallTrajectoryPath } from '../../types/delivery';

// Ground geometry mirror (matches CricketActionVisualizer + DeliveryResultFactory)
export const FIELD_CENTER: Point = { x: 300, y: 300 };
export const BOUNDARY_RADIUS = 268;

const DEFAULT_BALL_SPEED = 150; // field-units / second (ground commute of a struck ball)
const DEFAULT_AERIAL_BALL_SPEED = 85; // field-units / second (slower while airborne/looping)
const DEFAULT_FIELDER_SPEED = 12; // field-units / second outfield sprint
const DEFAULT_REACTION_TIME = 0.22; // seconds before the fielder can move
const CATCH_REACH_BONUS = 6; // extra jump/hands reach on aerial balls
const GROUND_REACH_BONUS = 2.5;

export interface FielderProfile {
  id: string;
  name?: string;
  x: number;
  y: number;
  /** Movement speed in field-units/second. */
  speed?: number;
  /** Overall fielding rating 0-100 (ground fielding + throwing). */
  fieldingRating?: number;
  /** Catching rating 0-100 (aerial). Falls back to fieldingRating. */
  catchingRating?: number;
  isWicketkeeper?: boolean;
}

export type InterceptionOutcome =
  | 'CAUGHT' // aerial catch completed
  | 'STOPPED' // ground ball stopped / fielded cleanly (or dropped catch re-collected)
  | 'MISSED' // misfield / fumble — ball escapes past the fielder
  | 'BOUNDARY' // crossed the rope untouched
  | 'THROUGH'; // passed all fielders but stayed in play

export interface InterceptionInput {
  ballPath: BallTrajectoryPath;
  fielders: FielderProfile[];
  /** Ball travel speed along the ground (field-units/sec). */
  ballSpeed?: number;
  /** Seconds before a fielder reacts. */
  reactionTime?: number;
  /** Override whether an aerial catch can be attempted. Defaults to ballPath.isAerial. */
  catchEligible?: boolean;
  /** Injectable RNG (0..1) for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
}

export interface InterceptionResult {
  outcome: InterceptionOutcome;
  fielderId: string | null;
  fielderName: string | null;
  /** Where the ball was (or could have been) intercepted / stopped / crossed. */
  interceptPoint: Point;
  boundary: boolean;
  isCatch: boolean;
  isDrop: boolean;
  reachable: boolean;
  /** 0..1 measure of how comfortably the chosen fielder reaches the ball. */
  confidence: number;
  /** Distance the chosen fielder must travel. */
  distanceToBall: number;
  /** Seconds the chosen fielder needs to reach the ball. */
  timeToBall: number;
  /** Seconds the ball takes to arrive at the intercept point. */
  ballTravelTime: number;
}

interface Candidate {
  fielder: FielderProfile;
  intercept: Point;
  fraction: number;
  distanceToBall: number;
  ballTravelTime: number;
  timeToBall: number;
  reach: number;
  slack: number;
  reachable: boolean;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Projects point `p` onto the segment origin->dest, returning the closest point
 * and the normalized fraction (0..1) along the segment.
 */
export function projectPointOnSegment(p: Point, origin: Point, dest: Point): { point: Point; fraction: number } {
  const vx = dest.x - origin.x;
  const vy = dest.y - origin.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 1e-9) return { point: { ...origin }, fraction: 0 };
  const t = clamp(((p.x - origin.x) * vx + (p.y - origin.y) * vy) / lenSq, 0, 1);
  return { point: { x: origin.x + vx * t, y: origin.y + vy * t }, fraction: t };
}

/**
 * Authoritative fielding-interception evaluation.
 *
 * Given the strike trajectory and the current fielder positions/attributes,
 * determines whether a fielder can reach the ball, and whether the result is a
 * catch, a clean stop, a misfield, or that the ball escapes.
 *
 * This never decides runs/wickets itself — those come from the authoritative
 * match engine. It only decides the *physical* interception, which the UI uses
 * to animate the chase/collect/return and to attribute the stop.
 */
export function evaluateInterception(input: InterceptionInput): InterceptionResult {
  const { ballPath, fielders } = input;
  const rng = input.rng ?? Math.random;

  const origin: Point = ballPath.contact ?? ballPath.start;
  const dest: Point = ballPath.target;
  const segmentLength = dist(origin, dest);
  const isAerial = input.catchEligible ?? Boolean(ballPath.isAerial);
  const ballSpeed = input.ballSpeed ?? (isAerial ? DEFAULT_AERIAL_BALL_SPEED : DEFAULT_BALL_SPEED);
  const reaction = input.reactionTime ?? DEFAULT_REACTION_TIME;
  const totalBallTime = segmentLength / Math.max(1, ballSpeed);

  const boundary = dist(dest, FIELD_CENTER) >= BOUNDARY_RADIUS - 4;

  // ── Evaluate every fielder's ability to reach its closest point on the path
  let best: Candidate | null = null;
  for (const f of fielders) {
    const proj = projectPointOnSegment({ x: f.x, y: f.y }, origin, dest);
    const distanceToBall = dist({ x: f.x, y: f.y }, proj.point);
    const ballTravelTime = proj.fraction * totalBallTime;
    const speed = f.speed ?? DEFAULT_FIELDER_SPEED;
    const reachBonus = isAerial ? CATCH_REACH_BONUS : GROUND_REACH_BONUS;
    const reach = speed * Math.max(0, ballTravelTime - reaction) + reachBonus + ((f.fieldingRating ?? 70) * 0.03);
    const reachable = distanceToBall <= reach;
    const slack = reach - distanceToBall;
    const timeToBall = distanceToBall / speed + reaction;

    const candidate: Candidate = {
      fielder: f,
      intercept: proj.point,
      fraction: proj.fraction,
      distanceToBall,
      ballTravelTime,
      timeToBall,
      reach,
      slack,
      reachable,
    };

    if (!best) {
      best = candidate;
      continue;
    }
    // Prefer a reachable candidate; among reachable prefer the most comfortable
    // (largest slack), tie-broken by fielding rating.
    if (reachable && !best.reachable) {
      best = candidate;
    } else if (reachable === best.reachable) {
      const better =
        slack > best.slack + 0.5 ||
        (Math.abs(slack - best.slack) <= 0.5 &&
          (candidate.fielder.fieldingRating ?? 0) > (best.fielder.fieldingRating ?? 0));
      if (better) best = candidate;
    }
  }

  if (!best || !best.reachable) {
    return {
      outcome: boundary ? 'BOUNDARY' : 'THROUGH',
      fielderId: null,
      fielderName: null,
      interceptPoint: dest,
      boundary,
      isCatch: false,
      isDrop: false,
      reachable: false,
      confidence: 0,
      distanceToBall: best ? Number(best.distanceToBall.toFixed(2)) : 0,
      timeToBall: best ? Number(best.timeToBall.toFixed(3)) : 0,
      ballTravelTime: Number(totalBallTime.toFixed(3)),
    };
  }

  const fielder = best.fielder;
  const confidence = clamp(0.35 + best.slack * 0.02 + ((fielder.fieldingRating ?? 70) - 50) * 0.006, 0.1, 0.99);

  // ── Aerial ball: attempt a catch
  if (isAerial) {
    const catchRating = fielder.catchingRating ?? fielder.fieldingRating ?? 70;
    const catchProb = clamp(0.45 + catchRating / 220 + best.slack * 0.006, 0.2, 0.97);
    if (rng() < catchProb) {
      return {
        outcome: 'CAUGHT',
        fielderId: fielder.id,
        fielderName: fielder.name ?? null,
        interceptPoint: best.intercept,
        boundary: false,
        isCatch: true,
        isDrop: false,
        reachable: true,
        confidence,
        distanceToBall: Number(best.distanceToBall.toFixed(2)),
        timeToBall: Number(best.timeToBall.toFixed(3)),
        ballTravelTime: Number(best.ballTravelTime.toFixed(3)),
      };
    }
    // Dropped catch — the ball spills, fielder re-collects (ground stop).
    return {
      outcome: 'STOPPED',
      fielderId: fielder.id,
      fielderName: fielder.name ?? null,
      interceptPoint: best.intercept,
      boundary: false,
      isCatch: false,
      isDrop: true,
      reachable: true,
      confidence: Number((confidence * 0.7).toFixed(3)),
      distanceToBall: Number(best.distanceToBall.toFixed(2)),
      timeToBall: Number(best.timeToBall.toFixed(3)),
      ballTravelTime: Number(best.ballTravelTime.toFixed(3)),
    };
  }

  // ── Ground ball: try to stop; occasionally misfield according to ability
  const fieldingRating = fielder.fieldingRating ?? 70;
  const misfieldProb = clamp(0.16 - (fieldingRating - 60) / 400, 0.01, 0.2);
  if (rng() < misfieldProb) {
    return {
      outcome: 'MISSED',
      fielderId: fielder.id,
      fielderName: fielder.name ?? null,
      interceptPoint: best.intercept,
      boundary: false,
      isCatch: false,
      isDrop: false,
      reachable: true,
      confidence: Number((confidence * 0.5).toFixed(3)),
      distanceToBall: Number(best.distanceToBall.toFixed(2)),
      timeToBall: Number(best.timeToBall.toFixed(3)),
      ballTravelTime: Number(best.ballTravelTime.toFixed(3)),
    };
  }

  return {
    outcome: 'STOPPED',
    fielderId: fielder.id,
    fielderName: fielder.name ?? null,
    interceptPoint: best.intercept,
    boundary: false,
    isCatch: false,
    isDrop: false,
    reachable: true,
    confidence,
    distanceToBall: Number(best.distanceToBall.toFixed(2)),
    timeToBall: Number(best.timeToBall.toFixed(3)),
    ballTravelTime: Number(best.ballTravelTime.toFixed(3)),
  };
}

/**
 * Finds the fielder physically nearest to a point — used to pick who chases and
 * returns the ball once a stop/boundary has occurred.
 */
export function nearestFielder(point: Point, fielders: FielderProfile[]): FielderProfile | null {
  let best: FielderProfile | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of fielders) {
    const d = dist(point, { x: f.x, y: f.y });
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  return best;
}
