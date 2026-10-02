import { BallOutcome } from '../types/match';
import { BowlingTactic } from './CricketActionVisualizer';
import { PlayerAnimState } from './CricketPlayer3D';

export type CricketEventType =
  | 'DOT_BALL'
  | 'SINGLE'
  | 'TWO_RUNS'
  | 'THREE_RUNS'
  | 'FOUR'
  | 'SIX'
  | 'WICKET_BOWLED'
  | 'WICKET_LBW'
  | 'WICKET_CAUGHT'
  | 'WICKET_STUMPED'
  | 'WICKET_RUN_OUT'
  | 'WICKET_HIT_WICKET'
  | 'DROPPED_CATCH'
  | 'BATTER_DUCK'
  | 'BATTER_OUT'
  | 'BATTER_FIFTY'
  | 'BATTER_CENTURY'
  | 'BATTER_150'
  | 'BATTER_200'
  | 'BOWLER_5_WICKET_HAUL'
  | 'PARTNERSHIP_50'
  | 'PARTNERSHIP_100'
  | 'MATCH_WINNING_SIX'
  | 'MATCH_WINNING_FOUR'
  | 'MATCH_WINNING_WICKET'
  | 'TEAM_WIN'
  | 'LAST_OVER'
  | 'LAST_BALL';

export type PlayerEmotionState =
  | 'NEUTRAL'
  | 'FOCUSED'
  | 'CONFIDENT'
  | 'EXCITED'
  | 'HAPPY'
  | 'CELEBRATING'
  | 'DISAPPOINTED'
  | 'FRUSTRATED'
  | 'SHOCKED'
  | 'RELIEVED'
  | 'AGGRESSIVE'
  | 'TIRED';

export type EventPriority = 'NORMAL' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface MilestoneEventData {
  type: CricketEventType;
  title: string;
  subtitle: string;
  badge?: string;
  playerName?: string;
  statValue?: string | number;
  bannerDurationMs: number;
}

export interface Action3DSequence {
  // Timing Breakdown (0.00 to 1.00 normalized)
  phases: {
    readyEnd: number;        // 0.00 - 0.12
    runupEnd: number;       // 0.12 - 0.30: Bowler runup sprint
    releaseEnd: number;     // 0.30 - 0.40: Delivery stride & overarm windmill
    bounceEnd: number;      // 0.40 - 0.55: Ball flight with swing & pitch bounce
    contactEnd: number;     // 0.55 - 0.65: Batter reads ball & executes stroke
    fieldingEnd: number;    // 0.65 - 0.82: Ball travels, fielder sprint / interception / catch / stumps smash
    emotionEnd: number;     // 0.82 - 0.94: Celebration, Appeal, Bat Raise, Disappointment walk
    resultEnd: number;      // 0.94 - 1.00: TV Graphics & final score sync
  };

  // Base Duration in Milliseconds (Adaptive based on Event Priority)
  baseDurationMs: number;

  // Event & Emotion metadata
  eventType: CricketEventType;
  priority: EventPriority;
  milestone?: MilestoneEventData | null;

  // Emotional states for active participants
  strikerEmotion: PlayerEmotionState;
  bowlerEmotion: PlayerEmotionState;
  keeperEmotion: PlayerEmotionState;
  teamEmotion: PlayerEmotionState;

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

  // Active in-play animations
  bowlerAnim: PlayerAnimState;
  batterAnim: PlayerAnimState;
  fielderAnim: PlayerAnimState;
  keeperAnim: PlayerAnimState;

  // Post-contact Celebration & Emotional Reactions
  strikerReactionAnim: PlayerAnimState;
  nonStrikerReactionAnim: PlayerAnimState;
  bowlerReactionAnim: PlayerAnimState;
  keeperReactionAnim: PlayerAnimState;
  fielderReactionAnim: PlayerAnimState;

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
  isMatchWinning: boolean;
  resultLabel: string;
}

import { ScoringZoneName, BatterHand } from '../engine/scoring/ScoringZones';

export interface AdaptDeliveryOptions {
  strikerScore?: number;
  strikerName?: string;
  bowlerWickets?: number;
  bowlerName?: string;
  partnershipRuns?: number;
  partnershipBalls?: number;
  target?: number | null;
  currentScore?: number;
  ballsRemaining?: number;
  isLastOver?: boolean;
  isLastBall?: boolean;
  isTestFormat?: boolean;
  targetZone?: ScoringZoneName;
  targetPos?: { x: number; y: number; z: number };
  batterHand?: BatterHand;
  shotName?: string;
}

/**
 * Adapts raw DeliveryResult / lastBall into a rich 3D Action + Emotion Sequence
 * Never calculates a second simulation — strictly visualizes the exact engine output.
 */
export function adaptDeliveryTo3DSequence(
  lastBall: (BallOutcome & { runs: number; isWicket?: boolean; wicketType?: string; isExtra?: boolean; extraType?: string; bowlingTactic?: BowlingTactic }) | null,
  activeTactic: BowlingTactic = 'OUTSWING',
  options: AdaptDeliveryOptions = {}
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
  const isEdge = isCaught && (wicketType.toLowerCase().includes('behind') || wicketType.toLowerCase().includes('slip'));
  const isLeave = isDot && !isExtra && Math.random() > 0.65;

  // 1. Detect Milestones & Match-Winning Moments
  const hasBatterScore = typeof options.strikerScore === 'number';
  const currBatterScore = options.strikerScore ?? runs;
  const prevBatterScore = hasBatterScore ? currBatterScore - runs : 0;
  const reachedFifty = hasBatterScore && prevBatterScore < 50 && currBatterScore >= 50 && currBatterScore < 100;
  const reachedCentury = hasBatterScore && prevBatterScore < 100 && currBatterScore >= 100 && currBatterScore < 150;
  const reached150 = hasBatterScore && prevBatterScore < 150 && currBatterScore >= 150 && currBatterScore < 200;
  const reached200 = hasBatterScore && prevBatterScore < 200 && currBatterScore >= 200;
  const isDuck = isWicket && hasBatterScore && currBatterScore === 0;

  const hasBowlerWickets = typeof options.bowlerWickets === 'number';
  const bowlerWickets = options.bowlerWickets ?? 0;
  const reached5Wickets = isWicket && hasBowlerWickets && bowlerWickets === 5;

  const prevPship = (options.partnershipRuns ?? 0) - runs;
  const currPship = options.partnershipRuns ?? runs;
  const reachedPship50 = prevPship < 50 && currPship >= 50 && currPship < 100;
  const reachedPship100 = prevPship < 100 && currPship >= 100;

  const isMatchWinning = Boolean(
    options.target &&
    options.target > 0 &&
    (options.currentScore ?? 0) + runs >= options.target &&
    !isWicket
  );

  // 2. Classify Event Type & Priority
  let eventType: CricketEventType = 'DOT_BALL';
  let priority: EventPriority = 'NORMAL';
  let milestone: MilestoneEventData | null = null;
  let baseDurationMs = 2400; // Normal ~2.4s

  if (isMatchWinning && isSix) {
    eventType = 'MATCH_WINNING_SIX';
    priority = 'VERY_HIGH';
    baseDurationMs = 4800;
    milestone = {
      type: 'MATCH_WINNING_SIX',
      title: 'MATCH WINNING SIX!',
      subtitle: `${options.strikerName || 'Striker'} SEALS THE VICTORY!`,
      badge: 'VICTORY',
      bannerDurationMs: 3000,
    };
  } else if (isMatchWinning && isFour) {
    eventType = 'MATCH_WINNING_FOUR';
    priority = 'VERY_HIGH';
    baseDurationMs = 4500;
    milestone = {
      type: 'MATCH_WINNING_FOUR',
      title: 'MATCH WINNING FOUR!',
      subtitle: `${options.strikerName || 'Striker'} HITS THE WINNING RUNS!`,
      badge: 'VICTORY',
      bannerDurationMs: 2800,
    };
  } else if (reached5Wickets) {
    eventType = 'BOWLER_5_WICKET_HAUL';
    priority = 'VERY_HIGH';
    baseDurationMs = 3800;
    milestone = {
      type: 'BOWLER_5_WICKET_HAUL',
      title: '5-WICKET HAUL!',
      subtitle: `${options.bowlerName || 'Bowler'} claims 5 wickets in the innings!`,
      badge: '5 WICKETS',
      playerName: options.bowlerName,
      statValue: '5 Wickets',
      bannerDurationMs: 2500,
    };
  } else if (reachedCentury || reached200 || reached150) {
    eventType = reached200 ? 'BATTER_200' : reached150 ? 'BATTER_150' : 'BATTER_CENTURY';
    priority = 'VERY_HIGH';
    baseDurationMs = 3800;
    milestone = {
      type: eventType,
      title: reached200 ? 'DOUBLE CENTURY! 200*' : reached150 ? 'MAGNIFICENT 150*!' : 'CENTURY! 100*',
      subtitle: `${options.strikerName || 'Batter'} raises the bat & helmet!`,
      badge: 'MILESTONE',
      playerName: options.strikerName,
      statValue: `${currBatterScore}*`,
      bannerDurationMs: 2500,
    };
  } else if (reachedFifty) {
    eventType = 'BATTER_FIFTY';
    priority = 'HIGH';
    baseDurationMs = 3200;
    milestone = {
      type: 'BATTER_FIFTY',
      title: 'FIFTY! 50*',
      subtitle: `${options.strikerName || 'Batter'} reaches a crucial half-century!`,
      badge: 'FIFTY',
      playerName: options.strikerName,
      statValue: `${currBatterScore}*`,
      bannerDurationMs: 2000,
    };
  } else if (isDuck) {
    eventType = 'BATTER_DUCK';
    priority = 'HIGH';
    baseDurationMs = 3000;
    milestone = {
      type: 'BATTER_DUCK',
      title: 'DUCK! OUT FOR 0',
      subtitle: `${options.strikerName || 'Batter'} departs without scoring`,
      badge: 'DUCK',
      bannerDurationMs: 1800,
    };
  } else if (isBowled) {
    eventType = 'WICKET_BOWLED';
    priority = 'HIGH';
    baseDurationMs = 3000;
  } else if (isLBW) {
    eventType = 'WICKET_LBW';
    priority = 'HIGH';
    baseDurationMs = 2900;
  } else if (isCaught) {
    eventType = 'WICKET_CAUGHT';
    priority = 'HIGH';
    baseDurationMs = 3100;
  } else if (isStumped) {
    eventType = 'WICKET_STUMPED';
    priority = 'HIGH';
    baseDurationMs = 3000;
  } else if (isRunOut) {
    eventType = 'WICKET_RUN_OUT';
    priority = 'HIGH';
    baseDurationMs = 3200;
  } else if (isSix) {
    eventType = 'SIX';
    priority = 'MEDIUM';
    baseDurationMs = 2800;
  } else if (isFour) {
    eventType = 'FOUR';
    priority = 'MEDIUM';
    baseDurationMs = 2600;
  } else if (runs === 3) {
    eventType = 'THREE_RUNS';
    priority = 'NORMAL';
    baseDurationMs = 2600;
  } else if (runs === 2) {
    eventType = 'TWO_RUNS';
    priority = 'NORMAL';
    baseDurationMs = 2500;
  } else if (runs === 1) {
    eventType = 'SINGLE';
    priority = 'NORMAL';
    baseDurationMs = 2300;
  } else {
    eventType = 'DOT_BALL';
    priority = 'NORMAL';
    baseDurationMs = 2200;
  }

  // 3. Emotion States Assignment
  let strikerEmotion: PlayerEmotionState = 'FOCUSED';
  let bowlerEmotion: PlayerEmotionState = 'FOCUSED';
  let keeperEmotion: PlayerEmotionState = 'FOCUSED';
  let teamEmotion: PlayerEmotionState = 'NEUTRAL';

  if (isMatchWinning) {
    strikerEmotion = 'CELEBRATING';
    bowlerEmotion = 'DISAPPOINTED';
    teamEmotion = 'CELEBRATING';
  } else if (reachedCentury || reachedFifty) {
    strikerEmotion = 'HAPPY';
    bowlerEmotion = 'FRUSTRATED';
    teamEmotion = 'HAPPY';
  } else if (isWicket) {
    strikerEmotion = isDuck ? 'DISAPPOINTED' : 'DISAPPOINTED';
    bowlerEmotion = reached5Wickets ? 'CELEBRATING' : 'EXCITED';
    keeperEmotion = isCaught || isStumped ? 'CELEBRATING' : 'HAPPY';
    teamEmotion = 'CELEBRATING';
  } else if (isSix) {
    strikerEmotion = 'EXCITED';
    bowlerEmotion = 'FRUSTRATED';
  } else if (isFour) {
    strikerEmotion = 'CONFIDENT';
    bowlerEmotion = 'AGGRESSIVE';
  } else if (isDot) {
    strikerEmotion = 'FOCUSED';
    bowlerEmotion = 'CONFIDENT';
  }

  // 4. Calculate 3D Pitch Bounce Coordinate based on Line & Length tactics
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

  // 5. Determine 3D Shot Trajectory Angle & Batting Stroke
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

  // 6. Compute Ground Target Point
  const rad = (shotAngleDeg - 90) * (Math.PI / 180);
  const targetDist = isSix ? 41.5 : isFour ? 37.5 : runs > 0 ? (runs * 4.5 + 5) : isEdge ? 13.5 : isLeave ? 14.5 : 2.0;
  const targetX = options.targetPos ? options.targetPos.x : Math.cos(rad) * targetDist;
  const targetZ = options.targetPos ? options.targetPos.z : 9.5 + Math.sin(rad) * targetDist;

  // 7. Post-Action Reaction & Celebration Assignments
  let strikerReactionAnim: PlayerAnimState = 'IDLE';
  let nonStrikerReactionAnim: PlayerAnimState = 'IDLE';
  let bowlerReactionAnim: PlayerAnimState = 'IDLE';
  let keeperReactionAnim: PlayerAnimState = 'KEEPER_CROUCH';
  let fielderReactionAnim: PlayerAnimState = 'FIELD_READY';

  if (isMatchWinning) {
    strikerReactionAnim = 'MATCH_WIN_CELEBRATION';
    nonStrikerReactionAnim = 'TEAM_HUG';
    bowlerReactionAnim = 'HANDS_ON_HEAD';
    fielderReactionAnim = 'HEAD_SHAKE';
  } else if (reachedCentury || reached200 || reached150) {
    strikerReactionAnim = 'HELMET_RAISE';
    nonStrikerReactionAnim = 'BAT_TAP';
    bowlerReactionAnim = 'CONFIDENT_WALK';
  } else if (reachedFifty) {
    strikerReactionAnim = 'BAT_RAISE';
    nonStrikerReactionAnim = 'BAT_TAP';
  } else if (isWicket) {
    strikerReactionAnim = isDuck ? 'BATTER_WALK_OFF' : 'BATTER_DISMISSED';
    bowlerReactionAnim = isLBW ? 'BOWLER_APPEAL' : 'BOWLER_CELEBRATION';
    keeperReactionAnim = isStumped ? 'KEEPER_STUMPING' : isCaught ? 'KEEPER_CATCH' : 'HIGH_FIVE';
    fielderReactionAnim = isCaught ? 'HIGH_FIVE' : isLBW ? 'FIELDER_APPEAL' : 'TEAM_HUG';
  } else if (isSix) {
    strikerReactionAnim = 'FIST_PUMP';
    bowlerReactionAnim = 'HANDS_ON_HEAD';
  } else if (isFour) {
    strikerReactionAnim = 'CONFIDENT_WALK';
    bowlerReactionAnim = 'CONFIDENT_WALK';
  } else if (isDot) {
    strikerReactionAnim = 'BATTING_READY';
    bowlerReactionAnim = 'BOWLING_READY';
  }

  // 8. Result Label
  let resultLabel = 'DOT BALL';
  if (milestone) {
    resultLabel = milestone.title;
  } else if (isWicket) {
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
      readyEnd: 0.04,
      runupEnd: 0.16,       // 0.00 - 0.16: Compressed bowler sprint
      releaseEnd: 0.24,     // 0.16 - 0.24: Windmill stride & release
      bounceEnd: 0.36,      // 0.24 - 0.36: Ball flight with swing & pitch bounce
      contactEnd: 0.46,     // 0.36 - 0.46: Batter reads ball & executes stroke
      fieldingEnd: 0.76,    // 0.46 - 0.76: Ball travels, fielding/catch/running action
      emotionEnd: 0.90,     // 0.76 - 0.90: Emotions, celebrations, appeals, reactions
      resultEnd: 1.00,      // 0.90 - 1.00: TV Graphics & final score sync
    },
    baseDurationMs,
    eventType,
    priority,
    milestone,
    strikerEmotion,
    bowlerEmotion,
    keeperEmotion,
    teamEmotion,
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
    strikerReactionAnim,
    nonStrikerReactionAnim,
    bowlerReactionAnim,
    keeperReactionAnim,
    fielderReactionAnim,
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
    isMatchWinning,
    resultLabel,
  };
}

