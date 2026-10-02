import { BallOutcome } from '../types/match';
import { BowlingTactic } from './CricketActionVisualizer';
import { PlayerAnimState } from './CricketPlayer3D';

export interface Action3DSequence {
  // Timing Breakdown (0.00 to 1.00 normalized)
  phases: {
    readyEnd: number;        // 0.00 - 0.15
    runupEnd: number;       // 0.15 - 0.40
    releaseEnd: number;     // 0.40 - 0.50
    bounceEnd: number;      // 0.50 - 0.68
    contactEnd: number;     // 0.68 - 0.78
    fieldingEnd: number;    // 0.78 - 0.94
    resultEnd: number;      // 0.94 - 1.00
  };

  // Trajectory coordinates in 3D ground space
  ballTrajectory: {
    startPos: { x: number; y: number; z: number };
    bouncePos: { x: number; y: number; z: number };
    contactPos: { x: number; y: number; z: number };
    targetPos: { x: number; y: number; z: number };
    isAerial: boolean;
    apexHeight: number;
    swingFactor: number;
    seamDeviation: number;
    shotAngleDeg: number;
  };

  // Animation Clips for each active character
  bowlerAnim: PlayerAnimState;
  batterAnim: PlayerAnimState;
  fielderAnim: PlayerAnimState;
  keeperAnim: PlayerAnimState;

  // Outcome flags
  runs: number;
  isWicket: boolean;
  wicketType?: string;
  isBoundary: boolean;
  isSix: boolean;
  isFour: boolean;
  isDot: boolean;
  isRunOut: boolean;
  isBowled: boolean;
  isCaught: boolean;
  isStumped: boolean;
  isLBW: boolean;
  isLeave: boolean;
  isEdge: boolean;
  resultLabel: string;
}

/**
 * Adapts raw DeliveryResult / lastBall into a rich 3D Action Sequence
 * Never calculates a second simulation — strictly visualizes the exact engine output.
 */
export function adaptDeliveryTo3DSequence(
  lastBall: (BallOutcome & { runs: number; isWicket?: boolean; wicketType?: string; isExtra?: boolean; extraType?: string; bowlingTactic?: BowlingTactic }) | null,
  activeTactic: BowlingTactic = 'OUTSWING'
): Action3DSequence {
  const runs = lastBall?.runs ?? 0;
  const isWicket = Boolean(lastBall?.isWicket);
  const wicketType = lastBall?.wicketType || '';
  const isExtra = Boolean(lastBall?.isExtra);
  const extraType = lastBall?.extraType;
  const tactic = lastBall?.bowlingTactic || activeTactic;

  const isSix = runs === 6;
  const isFour = runs === 4;
  const isBoundary = isSix || isFour;
  const isDot = runs === 0 && !isWicket && !isExtra;

  const isBowled = isWicket && wicketType.toLowerCase().includes('bowled');
  const isCaught = isWicket && (wicketType.toLowerCase().includes('caught') || wicketType.toLowerCase().includes('c & b'));
  const isRunOut = isWicket && wicketType.toLowerCase().includes('run out');
  const isStumped = isWicket && wicketType.toLowerCase().includes('stumped');
  const isLBW = isWicket && wicketType.toLowerCase().includes('lbw');
  const isEdge = isCaught && wicketType.toLowerCase().includes('behind') || wicketType.toLowerCase().includes('slip');
  const isLeave = isDot && !isExtra && Math.random() > 0.65;

  // 1. Calculate 3D Pitch Bounce Coordinate based on Line & Length tactics
  let bounceZ = 4.2; // Good length (default)
  let bounceX = 0;
  let apexBounceY = 0.85;
  let swingFactor = 0;
  let seamDev = 0;

  if (tactic === 'YORKER') {
    bounceZ = 8.8; // Right at popping crease
    apexBounceY = 0.25;
  } else if (tactic === 'BOUNCER') {
    bounceZ = -2.0; // Short pitch
    apexBounceY = 1.65; // High steep climb
  } else if (tactic === 'OUTSWING') {
    bounceX = 0.35;
    swingFactor = -4.5;
  } else if (tactic === 'INSWING') {
    bounceX = -0.35;
    swingFactor = 4.5;
  } else if (tactic === 'REVERSE_SWING') {
    bounceX = -0.2;
    swingFactor = 6.0;
  } else if (tactic === 'OFF_BREAK') {
    bounceX = 0.4;
    seamDev = 0.35; // Turns in
  } else if (tactic === 'LEG_BREAK') {
    bounceX = -0.4;
    seamDev = -0.35; // Turns away
  } else if (tactic === 'GOOGLY') {
    bounceX = -0.3;
    seamDev = 0.4; // Wrong'un turns in
  } else if (tactic === 'DOOSRA') {
    bounceX = 0.3;
    seamDev = -0.35; // Turns away
  }

  // 2. Determine 3D Shot Trajectory Angle & Batting Animation
  let shotAngleDeg = -45;
  let batterAnim: PlayerAnimState = 'FORWARD_DEFENCE';

  if (isSix) {
    const sixShots: { angle: number; clip: PlayerAnimState }[] = [
      { angle: -65, clip: 'LOFTED_SIX' },   // Over Extra Cover
      { angle: -20, clip: 'LOFTED_SIX' },   // Long-Off
      { angle: 15, clip: 'LOFTED_SIX' },    // Long-On
      { angle: 55, clip: 'PULL_SHOT' },     // Deep Mid-Wicket
      { angle: 75, clip: 'PULL_SHOT' },     // Slog Sweep
      { angle: 95, clip: 'HOOK_SHOT' },     // Over Square Leg
    ];
    const sel = sixShots[Math.floor(Math.random() * sixShots.length)];
    shotAngleDeg = sel.angle;
    batterAnim = sel.clip;
  } else if (isFour) {
    const fourShots: { angle: number; clip: PlayerAnimState }[] = [
      { angle: -55, clip: 'COVER_DRIVE' },    // Cover Drive
      { angle: -5, clip: 'STRAIGHT_DRIVE' },  // Straight Drive
      { angle: 25, clip: 'STRAIGHT_DRIVE' },  // On Drive
      { angle: -95, clip: 'SQUARE_CUT' },     // Square Cut
      { angle: 65, clip: 'PULL_SHOT' },      // Pull shot
      { angle: 100, clip: 'FLICK' },         // Square Leg Flick
      { angle: 140, clip: 'FLICK' },         // Fine Leg Glance
    ];
    const sel = fourShots[Math.floor(Math.random() * fourShots.length)];
    shotAngleDeg = sel.angle;
    batterAnim = sel.clip;
  } else if (runs > 0) {
    const runShots: { angle: number; clip: PlayerAnimState }[] = [
      { angle: -75, clip: 'COVER_DRIVE' },
      { angle: -25, clip: 'STRAIGHT_DRIVE' },
      { angle: 20, clip: 'STRAIGHT_DRIVE' },
      { angle: 55, clip: 'PULL_SHOT' },
      { angle: 90, clip: 'FLICK' },
      { angle: 130, clip: 'FLICK' },
    ];
    const sel = runShots[Math.floor(Math.random() * runShots.length)];
    shotAngleDeg = sel.angle;
    batterAnim = sel.clip;
  } else if (isEdge) {
    shotAngleDeg = -120; // Deflects toward slips / keeper
    batterAnim = 'EDGE';
  } else if (isLeave) {
    shotAngleDeg = -90;
    batterAnim = 'LEAVE';
  } else if (isLBW) {
    shotAngleDeg = 0;
    batterAnim = 'FORWARD_DEFENCE';
  } else if (isBowled) {
    shotAngleDeg = 0;
    batterAnim = 'FORWARD_DEFENCE';
  } else {
    batterAnim = 'FORWARD_DEFENCE';
  }

  // 3. Compute Ground Target Point
  const rad = (shotAngleDeg - 90) * (Math.PI / 180);
  const targetDist = isSix ? 41.5 : isFour ? 37.5 : runs > 0 ? (runs * 4.5 + 5) : isEdge ? 13.5 : isLeave ? 14.5 : 2.0;
  const targetX = Math.cos(rad) * targetDist;
  const targetZ = 9.5 + Math.sin(rad) * targetDist;

  // 4. Result Label
  let resultLabel = 'DOT BALL';
  if (isWicket) {
    resultLabel = wicketType.toUpperCase() || 'WICKET!';
  } else if (isSix) {
    resultLabel = 'SIX!';
  } else if (isFour) {
    resultLabel = 'FOUR!';
  } else if (runs > 0) {
    resultLabel = `${runs} RUN${runs > 1 ? 'S' : ''}`;
  } else if (isExtra) {
    resultLabel = (extraType || 'EXTRA').toUpperCase();
  }

  return {
    phases: {
      readyEnd: 0.05,
      runupEnd: 0.18,       // 0.00 - 0.35s: Bowler compressed run-up
      releaseEnd: 0.26,     // 0.35 - 0.55s: Bowler delivery stride + arm windmill, ball release
      bounceEnd: 0.38,      // 0.55 - 0.85s: Ball flight with swing & pitch bounce
      contactEnd: 0.48,     // 0.85 - 1.05s: Batter performs shot/defence/miss
      fieldingEnd: 0.80,    // 1.05 - 1.80s: Ball travels, fielding/catch/running action
      resultEnd: 0.92,      // 1.80 - 2.05s: Result completed & banner shown
    },
    ballTrajectory: {
      startPos: { x: -0.8, y: 1.8, z: -18 },
      bouncePos: { x: bounceX, y: 0.04, z: bounceZ },
      contactPos: { x: 0, y: 0.55, z: 9.5 },
      targetPos: { x: targetX, y: 0.08, z: targetZ },
      isAerial: isSix || (isCaught && !isEdge),
      apexHeight: isSix ? 12.0 : apexBounceY,
      swingFactor,
      seamDeviation: seamDev,
      shotAngleDeg,
    },
    bowlerAnim: 'RUN_UP',
    batterAnim,
    fielderAnim: isCaught ? 'DIVING_CATCH' : runs > 0 || isFour ? 'RUN_TO_BALL' : 'FIELD_READY',
    keeperAnim: isCaught && isEdge ? 'KEEPER_CATCH' : isStumped ? 'STUMPING' : 'KEEPER_CROUCH',
    runs,
    isWicket,
    wicketType,
    isBoundary,
    isSix,
    isFour,
    isDot,
    isRunOut,
    isBowled,
    isCaught,
    isStumped,
    isLBW,
    isLeave,
    isEdge,
    resultLabel,
  };
}
