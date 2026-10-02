import * as THREE from 'three';
import { ScoringZoneName, getZoneCoordinates } from '../../engine/scoring/ScoringZones';

export interface BallWaypoint3D {
  x: number;
  y: number;
  z: number;
  timeRatio: number; // 0.0 to 1.0 within trajectory
}

export interface CompleteBallFlightPlan {
  // Phase 1: Bowler Hand to Bat Contact / Wicket / Keeper
  releasePos: THREE.Vector3;
  bouncePos: THREE.Vector3;
  contactPos: THREE.Vector3;

  // Phase 2: After Bat Contact / Dismissal
  targetPos: THREE.Vector3;
  finalDestinationPos: THREE.Vector3;

  // Flight Characteristics
  isAerial: boolean;
  apexHeight: number;
  bounceHeightAfterContact: number;
  isBoundary: boolean;
  isSix: boolean;
  isFour: boolean;
  isWicket: boolean;
  isBowled: boolean;
  isLBW: boolean;
  isCaught: boolean;
  isStumped: boolean;
  isRunOut: boolean;
  ballColor: 'WHITE' | 'RED';
}

export class BallTrajectoryCalculator {
  /**
   * Calculates the full 3D spatial flight plan for a delivery
   */
  public static calculateFlightPlan(
    targetZone: ScoringZoneName = 'COVER',
    runs: number = 0,
    isWicket: boolean = false,
    wicketType?: string | null,
    isTestFormat: boolean = false,
    bowlingTactic: string = 'OUTSWING'
  ): CompleteBallFlightPlan {
    const ballColor = isTestFormat ? 'RED' : 'WHITE';
    
    // 1. Bowler Release Position (Windmill apex at bowling crease z = -10.0m)
    const releasePos = new THREE.Vector3(0.35, 2.15, -10.0);

    // 2. Pitch Bounce Position (Good length / full / short)
    let bounceZ = 2.5; // Good length
    let bounceX = 0.05;

    if (bowlingTactic === 'BOUNCER' || bowlingTactic === 'SHORT_BALL') {
      bounceZ = -2.0; // Shorter
    } else if (bowlingTactic === 'YORKER') {
      bounceZ = 8.5; // Very full
    } else if (bowlingTactic === 'INSWING' || bowlingTactic === 'IN_CUTTER') {
      bounceX = -0.15;
    } else if (bowlingTactic === 'OUTSWING' || bowlingTactic === 'OFF_BREAK') {
      bounceX = 0.20;
    }

    const bouncePos = new THREE.Vector3(bounceX, 0.06, bounceZ);

    // 3. Bat Contact Position (Striking crease z = 10.0m, stump line)
    const contactPos = new THREE.Vector3(0.0, 0.78, 10.0);

    // Dismissal classifications
    const isBowled = isWicket && wicketType === 'BOWLED';
    const isLBW = isWicket && wicketType === 'LBW';
    const isCaught = isWicket && (wicketType === 'CAUGHT' || wicketType === 'CAUGHT_BEHIND');
    const isStumped = isWicket && wicketType === 'STUMPED';
    const isRunOut = isWicket && wicketType === 'RUN_OUT';

    const isSix = runs === 6;
    const isFour = runs === 4;
    const isBoundary = isSix || isFour;

    // 4. Target World Position
    const zoneCoords = getZoneCoordinates(targetZone, 'RIGHT_HAND');
    let targetPos = new THREE.Vector3(zoneCoords.x, 0.08, zoneCoords.z);

    if (isBowled) {
      targetPos = new THREE.Vector3(0, 0.70, 10.1); // Direct to stumps
    } else if (isLBW) {
      targetPos = new THREE.Vector3(-0.05, 0.55, 9.85); // Hit pad in front of stumps
    } else if (isStumped) {
      targetPos = new THREE.Vector3(0, 0.65, 11.2); // Squeeze past to keeper
    } else if (runs === 0 && !isWicket) {
      // Defensive shot or miss to keeper
      if (Math.abs(targetPos.x) < 3.0 && targetPos.z > 8.0) {
        targetPos = new THREE.Vector3(0, 0.65, 11.5); // Keeper collection
      }
    }

    // 5. Final Destination Position (Boundary rope, Fielder stop, or Stumps)
    let finalDestinationPos = targetPos.clone();

    if (isSix) {
      // Clears boundary rope (50m - 62m radius) in the air
      const angle = Math.atan2(targetPos.z, targetPos.x);
      const distance = 58.0;
      finalDestinationPos = new THREE.Vector3(
        Math.cos(angle) * distance,
        0.08,
        Math.sin(angle) * distance
      );
    } else if (isFour) {
      // Rolls past boundary rope
      const angle = Math.atan2(targetPos.z, targetPos.x);
      const distance = 52.0;
      finalDestinationPos = new THREE.Vector3(
        Math.cos(angle) * distance,
        0.06,
        Math.sin(angle) * distance
      );
    } else if (isCaught) {
      // Fielder catch height
      finalDestinationPos.y = 1.35;
    }

    const isAerial = isSix || isCaught || (isFour && targetZone.startsWith('DEEP_'));
    const apexHeight = isSix ? 14.5 : isCaught ? 6.5 : isFour && isAerial ? 4.5 : 0.45;
    const bounceHeightAfterContact = isSix ? 0 : isFour ? 0.85 : 0.25;

    return {
      releasePos,
      bouncePos,
      contactPos,
      targetPos,
      finalDestinationPos,
      isAerial,
      apexHeight,
      bounceHeightAfterContact,
      isBoundary,
      isSix,
      isFour,
      isWicket,
      isBowled,
      isLBW,
      isCaught,
      isStumped,
      isRunOut,
      ballColor,
    };
  }

  /**
   * Evaluates the ball's continuous 3D world coordinate at normalized delivery progress (0.0 to 1.0)
   */
  public static sampleBallPosition(
    p: number,
    plan: CompleteBallFlightPlan,
    outPos: THREE.Vector3
  ): void {
    const pClamped = Math.max(0, Math.min(1, p));

    // Phase A: Bowler in hand / run-up (0.00 -> 0.38)
    if (pClamped < 0.38) {
      const runupFrac = pClamped / 0.38;
      outPos.set(
        plan.releasePos.x * Math.sin(runupFrac * Math.PI),
        1.1 + 1.05 * runupFrac,
        -18.0 + 8.0 * runupFrac
      );
      return;
    }

    // Phase B: Flight from Hand to Pitch Bounce (0.38 -> 0.48)
    if (pClamped < 0.48) {
      const t = (pClamped - 0.38) / 0.10;
      outPos.x = THREE.MathUtils.lerp(plan.releasePos.x, plan.bouncePos.x, t);
      outPos.z = THREE.MathUtils.lerp(plan.releasePos.z, plan.bouncePos.z, t);
      
      // Arc with gravity
      const straightY = THREE.MathUtils.lerp(plan.releasePos.y, plan.bouncePos.y, t);
      const arcLift = Math.sin(t * Math.PI) * 0.4;
      outPos.y = Math.max(0.06, straightY + arcLift);
      return;
    }

    // Phase C: Bounce off Pitch to Bat Contact (0.48 -> 0.58)
    if (pClamped < 0.58) {
      const t = (pClamped - 0.48) / 0.10;
      outPos.x = THREE.MathUtils.lerp(plan.bouncePos.x, plan.contactPos.x, t);
      outPos.z = THREE.MathUtils.lerp(plan.bouncePos.z, plan.contactPos.z, t);

      // Parabolic upward bounce off the pitch
      const bounceRise = Math.sin(t * (Math.PI / 2)) * 0.85;
      outPos.y = plan.bouncePos.y + bounceRise;
      return;
    }

    // Phase D: After Contact Ball Travel to Destination (0.58 -> 0.80)
    if (pClamped < 0.80) {
      const t = (pClamped - 0.58) / 0.22;
      const easeT = t * t * (3 - 2 * t); // Smooth smoothstep

      outPos.x = THREE.MathUtils.lerp(plan.contactPos.x, plan.finalDestinationPos.x, easeT);
      outPos.z = THREE.MathUtils.lerp(plan.contactPos.z, plan.finalDestinationPos.z, easeT);

      if (plan.isAerial) {
        // High parabolic trajectory
        const heightArc = Math.sin(t * Math.PI) * plan.apexHeight;
        outPos.y = THREE.MathUtils.lerp(plan.contactPos.y, plan.finalDestinationPos.y, t) + heightArc;
      } else {
        // Ground shot rolling & bouncing
        const groundBounce = Math.abs(Math.sin(t * Math.PI * 4)) * (1 - t) * plan.bounceHeightAfterContact;
        outPos.y = 0.06 + groundBounce;
      }
      return;
    }

    // Phase E: Ball at destination (0.80 -> 1.00)
    outPos.copy(plan.finalDestinationPos);
  }
}
