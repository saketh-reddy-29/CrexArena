import { Player } from '../../types/common';
import { PitchType, WeatherCondition, PlayerMatchStats } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';
import { Point } from '../strategy/BowlerFieldStrategyEngine';
import { MatchEngine } from '../../lib/matchEngine';
import { 
  DeliveryResult, 
  DeliveryResultType, 
  BallTrajectoryPath 
} from '../../types/delivery';

export interface DeliverySimulationInput {
  striker: Player;
  nonStriker: Player;
  bowler: Player;
  currentBalls: number;
  currentWickets: number;
  requiredRate: number;
  pitchType: PitchType;
  weather: WeatherCondition;
  format: ArenaFormat;
  isFreeHit?: boolean;
  bouncersThisOver?: number;
  strikerStats?: PlayerMatchStats;
  bowlerStats?: PlayerMatchStats;
  recentOutcomes?: string[];
  battingTeamId?: string;
  bowlingTeamId?: string;
  drsReviewsRemaining?: number;
  battingIntent?: string;
  bowlingPlan?: any;
  batterInningsState?: any;
}

export class DeliveryResultFactory {
  private static readonly BOUNDARY_RADIUS = 268;
  private static readonly GROUND_CENTER = 300;
  private static readonly BATTER_CREASE_Y = 410;
  private static readonly BOWLER_CREASE_Y = 190;

  /**
   * Helper: compute mathematical ray boundary intersection from batter crease (300, 410)
   */
  public static getBoundaryPoint(shotAngleDeg: number, distanceFactor: number = 1.0): Point {
    const rad = shotAngleDeg * (Math.PI / 180);
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    
    // (t*dx)^2 + (110 + t*dy)^2 = R^2
    const b = 220 * dy;
    const c = 12100 - (this.BOUNDARY_RADIUS * this.BOUNDARY_RADIUS);
    const disc = Math.sqrt(b * b - 4 * c);
    const tBoundary = (-b + disc) / 2;
    const t = Math.max(25, tBoundary * distanceFactor);
    
    return {
      x: Math.round(this.GROUND_CENTER + dx * t),
      y: Math.round(this.BATTER_CREASE_Y + dy * t),
    };
  }

  /**
   * Helper: normalize (x, y) coordinates to [0, 1] space
   */
  public static normalizePoint(p: Point): Point {
    return {
      x: Number((p.x / 600).toFixed(4)),
      y: Number((p.y / 600).toFixed(4)),
    };
  }

  /**
   * Generates single immutable DeliveryResult from match context.
   */
  public static createDeliveryResult(input: DeliverySimulationInput): DeliveryResult {
    const {
      striker,
      nonStriker,
      bowler,
      currentBalls,
      currentWickets,
      requiredRate,
      pitchType,
      weather,
      format,
      isFreeHit = false,
      bouncersThisOver = 0,
      strikerStats,
      bowlerStats,
      recentOutcomes,
      battingTeamId,
      bowlingTeamId,
      drsReviewsRemaining = 2,
    } = input;

    const overIndex = Math.floor(currentBalls / 6);
    const ballInOver = (currentBalls % 6) + 1;
    const overProgress = currentBalls / 6;

    // 1. Simulate ball outcome ONCE through MatchEngine (Authoritative single roll)
    const rawOutcome = MatchEngine.simulateBall(
      striker,
      bowler,
      overProgress,
      currentWickets,
      requiredRate,
      pitchType,
      weather,
      strikerStats,
      bowlerStats,
      recentOutcomes,
      isFreeHit,
      bouncersThisOver,
      format,
      input.battingIntent,
      input.bowlingPlan,
      input.batterInningsState
    );

    let isWicket = rawOutcome.isWicket && currentWickets < 10;
    let wicketType = rawOutcome.wicketType;
    let commentary = rawOutcome.commentary;

    // Handle DRS commentary if review was possible on an out decision
    if (drsReviewsRemaining > 0 && battingTeamId && bowlingTeamId && isWicket) {
      const review = MatchEngine.simulateDRS(rawOutcome, battingTeamId, drsReviewsRemaining);
      if (review) {
        commentary += '\n\n' + MatchEngine.getDRSCommentary(review, striker.name, bowler.name);
        if (review.overturned) {
          isWicket = false; // Overturn on review
        }
      }
    }

    const isLegalBall = rawOutcome.extraType !== 'Wide' && rawOutcome.extraType !== 'No Ball';
    const batterRuns = rawOutcome.isExtra ? 0 : rawOutcome.runs;
    const extraRuns = rawOutcome.isExtra ? rawOutcome.runs : 0;
    const totalRuns = rawOutcome.runs;
    const isLeftHander = (striker as any)?.battingHand === 'Left' || false;

    // 2. Classify authoritative DeliveryResultType
    let resultType: DeliveryResultType;
    if (isWicket) {
      resultType = 'WICKET';
    } else if (rawOutcome.extraType === 'Wide') {
      resultType = 'WIDE';
    } else if (rawOutcome.extraType === 'No Ball') {
      resultType = 'NO_BALL';
    } else if (rawOutcome.extraType === 'Bye') {
      resultType = 'BYE';
    } else if (rawOutcome.extraType === 'Leg Bye') {
      resultType = 'LEG_BYE';
    } else if (totalRuns === 6) {
      resultType = 'SIX';
    } else if (totalRuns === 4) {
      resultType = 'FOUR';
    } else if (totalRuns === 3) {
      resultType = 'THREE';
    } else if (totalRuns === 2) {
      resultType = 'TWO';
    } else if (totalRuns === 1) {
      resultType = 'SINGLE';
    } else {
      resultType = 'DOT';
    }

    // 3. Compute continuous 2D trajectory path & target fielding zone
    const { ballPath, shotType, targetZone } = this.calculateBallPath(
      resultType,
      totalRuns,
      isWicket,
      wicketType,
      rawOutcome.extraType,
      isLeftHander
    );

    // 4. Strike rotation logic
    const strikeRotated = !rawOutcome.isExtra 
      ? (batterRuns % 2 === 1) 
      : (rawOutcome.extraType === 'Bye' || rawOutcome.extraType === 'Leg Bye') && totalRuns % 2 === 1;

    // 5. Over completion logic
    const overCompleted = isLegalBall && (currentBalls + 1) % 6 === 0;

    const deliveryId = `del_${Date.now()}_${currentBalls}_${Math.floor(Math.random() * 10000)}`;

    const deliveryResult: DeliveryResult = {
      id: deliveryId,
      ballNumber: currentBalls + (isLegalBall ? 1 : 0),
      overIndex,
      ballInOver,
      strikerId: striker.id,
      strikerName: striker.name,
      nonStrikerId: nonStriker.id,
      nonStrikerName: nonStriker.name,
      bowlerId: bowler.id,
      bowlerName: bowler.name,
      legalBall: isLegalBall,
      batterRuns,
      extraRuns,
      totalRuns,
      extraType: rawOutcome.extraType,
      wicket: isWicket,
      wicketType,
      dismissedPlayerId: isWicket ? striker.id : undefined,
      dismissedPlayerName: isWicket ? striker.name : undefined,
      shotType,
      targetZone,
      ballPath,
      resultType,
      commentary,
      timestamp: Date.now(),
      strikeRotated,
      overCompleted,
      isFreeHit,
      triggeredFreeHit: rawOutcome.triggeredFreeHit || rawOutcome.extraType === 'No Ball',
    };

    return Object.freeze(deliveryResult);
  }

  /**
   * Computes authoritative ball trajectory points from start to target.
   */
  public static calculateBallPath(
    resultType: DeliveryResultType,
    runs: number,
    isWicket: boolean,
    wicketType?: string,
    extraType?: string,
    isLeftHander: boolean = false
  ): { ballPath: BallTrajectoryPath; shotType: string; targetZone: string } {
    const start: Point = { x: 300, y: this.BOWLER_CREASE_Y };
    let bounce: Point = { x: 300, y: 330 };
    let contact: Point = { x: 300, y: this.BATTER_CREASE_Y };
    let target: Point = { x: 300, y: 460 };
    let shotType = 'FORWARD_DEFENSE';
    let targetZone = 'WICKETKEEPER';
    let isAerial = false;
    let apexHeight = 0;

    if (resultType === 'WIDE') {
      const isOffSide = Math.random() > 0.4;
      bounce = { x: isOffSide ? 335 : 265, y: 320 };
      contact = { x: isOffSide ? 345 : 255, y: 410 };
      target = { x: isOffSide ? 355 : 245, y: 465 };
      shotType = 'WIDE_LEAVE';
      targetZone = isOffSide ? 'WIDE_OFF' : 'WIDE_LEG';
    } else if (resultType === 'NO_BALL') {
      bounce = { x: 300, y: 290 }; // High full toss or front foot overstep
      contact = { x: 300, y: 410 };
      target = this.getBoundaryPoint(35, 0.6);
      shotType = 'NO_BALL_HIT';
      targetZone = 'MID_WICKET';
    } else if (isWicket) {
      if (wicketType === 'Bowled') {
        bounce = { x: 300, y: 340 };
        contact = { x: 300, y: 415 };
        target = { x: 300, y: 422 }; // Stumps
        shotType = 'MISSED_DEFENSE';
        targetZone = 'STUMPS';
      } else if (wicketType === 'LBW') {
        bounce = { x: 300, y: 335 };
        contact = { x: 300, y: 410 };
        target = { x: 300, y: 412 }; // Batter pads
        shotType = 'PAD_INTERCEPT';
        targetZone = 'STUMPS';
      } else if (wicketType === 'Caught Behind') {
        bounce = { x: 298, y: 335 };
        contact = { x: 295, y: 410 };
        target = { x: 300, y: 460 }; // Keeper gloves
        shotType = 'FEATHER_EDGE';
        targetZone = 'WICKETKEEPER';
      } else if (wicketType === 'Caught') {
        const catchingZones = [
          { name: '1st Slip', pos: { x: 265, y: 472 }, shot: 'OUTSIDE_EDGE' },
          { name: 'Gully', pos: { x: 190, y: 450 }, shot: 'SQUARER_EDGE' },
          { name: 'Cover', pos: { x: 170, y: 285 }, shot: 'LOFTED_DRIVE' },
          { name: 'Mid-Off', pos: { x: 245, y: 195 }, shot: 'MISHIT_DRIVE' },
          { name: 'Mid-On', pos: { x: 355, y: 195 }, shot: 'CHIPPED_ON_DRIVE' },
          { name: 'Deep Mid-Wicket', pos: { x: 515, y: 240 }, shot: 'SKIED_PULL' },
          { name: 'Long-Off', pos: { x: 235, y: 75 }, shot: 'HOLE_OUT_DEEP' },
        ];
        const selected = catchingZones[Math.floor(Math.random() * catchingZones.length)];
        bounce = { x: 300, y: 330 };
        contact = { x: 300, y: 410 };
        target = selected.pos;
        shotType = selected.shot;
        targetZone = selected.name;
        isAerial = true;
        apexHeight = 55;
      } else if (wicketType === 'Stumped') {
        bounce = { x: 302, y: 340 };
        contact = { x: 300, y: 420 };
        target = { x: 300, y: 455 };
        shotType = 'STEP_OUT_MISS';
        targetZone = 'WICKETKEEPER';
      } else if (wicketType === 'Run Out') {
        bounce = { x: 300, y: 330 };
        contact = { x: 300, y: 410 };
        target = { x: 245, y: 195 }; // Direct hit from mid-off
        shotType = 'HURRIED_SINGLE';
        targetZone = 'STUMPS';
      } else {
        target = { x: 300, y: 420 };
        shotType = 'DISMISSAL';
        targetZone = 'STUMPS';
      }
    } else if (runs === 6) {
      isAerial = true;
      apexHeight = 80;
      const sixOptions = [
        { angle: -55, shot: 'LOFTED_COVER_DRIVE', zone: 'DEEP_COVER' },
        { angle: -10, shot: 'STRAIGHT_DRIVE_SIX', zone: 'LONG_OFF' },
        { angle: 15, shot: 'LONG_ON_MONSTER_SIX', zone: 'LONG_ON' },
        { angle: 55, shot: 'DEEP_MID_WICKET_PULL_SIX', zone: 'DEEP_MID_WICKET' },
        { angle: 75, shot: 'COW_CORNER_SLOG_SIX', zone: 'COW_CORNER' },
        { angle: 100, shot: 'SQUARE_LEG_HOOK_SIX', zone: 'DEEP_SQUARE_LEG' },
      ];
      const selected = sixOptions[Math.floor(Math.random() * sixOptions.length)];
      target = this.getBoundaryPoint(selected.angle, 1.05);
      shotType = selected.shot;
      targetZone = selected.zone;
    } else if (runs === 4) {
      isAerial = false;
      const fourOptions = [
        { angle: -55, shot: 'COVER_DRIVE_FOUR', zone: 'COVER' },
        { angle: -35, shot: 'EXTRA_COVER_FOUR', zone: 'EXTRA_COVER' },
        { angle: 0, shot: 'STRAIGHT_DRIVE_FOUR', zone: 'LONG_OFF' },
        { angle: 25, shot: 'ON_DRIVE_FOUR', zone: 'LONG_ON' },
        { angle: 65, shot: 'MID_WICKET_PULL_FOUR', zone: 'MID_WICKET' },
        { angle: -90, shot: 'SQUARE_CUT_FOUR', zone: 'POINT' },
        { angle: -135, shot: 'LATE_CUT_FOUR', zone: 'THIRD_MAN' },
        { angle: 95, shot: 'SQUARE_LEG_FLICK_FOUR', zone: 'SQUARE_LEG' },
        { angle: 140, shot: 'FINE_LEG_GLANCE_FOUR', zone: 'FINE_LEG' },
      ];
      const selected = fourOptions[Math.floor(Math.random() * fourOptions.length)];
      target = this.getBoundaryPoint(selected.angle, 0.98);
      shotType = selected.shot;
      targetZone = selected.zone;
    } else if (runs >= 1 && runs <= 3) {
      const distFactor = runs === 3 ? 0.76 : runs === 2 ? 0.58 : 0.38;
      const runningOptions = [
        { angle: -75, shot: 'POINT_PUSH', zone: 'POINT' },
        { angle: -25, shot: 'MID_OFF_DRIVE', zone: 'MID_OFF' },
        { angle: 20, shot: 'MID_ON_TAP', zone: 'MID_ON' },
        { angle: 55, shot: 'MID_WICKET_NUDGE', zone: 'MID_WICKET' },
        { angle: 90, shot: 'SQUARE_LEG_CLIP', zone: 'SQUARE_LEG' },
        { angle: 130, shot: 'FINE_LEG_GLANCE', zone: 'FINE_LEG' },
        { angle: -125, shot: 'THIRD_MAN_STEER', zone: 'THIRD_MAN' },
      ];
      const selected = runningOptions[Math.floor(Math.random() * runningOptions.length)];
      target = this.getBoundaryPoint(selected.angle, distFactor);
      shotType = selected.shot;
      targetZone = selected.zone;
    } else {
      // Dot ball
      const dotOptions = [
        { pos: { x: 300, y: 460 }, shot: 'BEATEN_OUTSIDE_OFF', zone: 'WICKETKEEPER' },
        { pos: { x: 296, y: 390 }, shot: 'SOLID_FORWARD_DEFENSE', zone: 'PITCH' },
        { pos: { x: 304, y: 395 }, shot: 'BACKFOOT_DEFENSE', zone: 'PITCH' },
        { pos: { x: 175, y: 400 }, shot: 'POINT_STOP', zone: 'POINT' },
        { pos: { x: 245, y: 220 }, shot: 'MID_OFF_STOP', zone: 'MID_OFF' },
      ];
      const selected = dotOptions[Math.floor(Math.random() * dotOptions.length)];
      target = selected.pos;
      shotType = selected.shot;
      targetZone = selected.zone;
    }

    // Mirror for left-handed batter across central axis x=300
    if (isLeftHander) {
      bounce = { x: 600 - bounce.x, y: bounce.y };
      contact = { x: 600 - contact.x, y: contact.y };
      target = { x: 600 - target.x, y: target.y };
    }

    const ballPath: BallTrajectoryPath = {
      start,
      bounce,
      contact,
      target,
      normalizedStart: this.normalizePoint(start),
      normalizedBounce: this.normalizePoint(bounce),
      normalizedContact: this.normalizePoint(contact),
      normalizedTarget: this.normalizePoint(target),
      isAerial,
      apexHeight,
    };

    return { ballPath, shotType, targetZone };
  }

  /**
   * Generates a fully deterministic DeliveryResult for automated test verification.
   */
  public static createDeterministicResult(scenario: {
    resultType: DeliveryResultType;
    runs?: number;
    extraType?: 'Wide' | 'No Ball' | 'Bye' | 'Leg Bye';
    wicketType?: 'Bowled' | 'Caught' | 'Caught Behind' | 'LBW' | 'Run Out' | 'Stumped' | 'Timed Out' | 'Hit Wicket';
    striker: Player;
    nonStriker: Player;
    bowler: Player;
    currentBalls: number;
    currentWickets: number;
  }): DeliveryResult {
    const { resultType, extraType, wicketType, striker, nonStriker, bowler, currentBalls, currentWickets } = scenario;
    const isWicket = resultType === 'WICKET';
    const isLegalBall = resultType !== 'WIDE' && resultType !== 'NO_BALL';

    let batterRuns = 0;
    let extraRuns = 0;
    let totalRuns = scenario.runs ?? 0;

    if (resultType === 'DOT') {
      totalRuns = 0;
      batterRuns = 0;
    } else if (resultType === 'SINGLE') {
      totalRuns = 1;
      batterRuns = 1;
    } else if (resultType === 'TWO') {
      totalRuns = 2;
      batterRuns = 2;
    } else if (resultType === 'THREE') {
      totalRuns = 3;
      batterRuns = 3;
    } else if (resultType === 'FOUR') {
      totalRuns = 4;
      batterRuns = 4;
    } else if (resultType === 'SIX') {
      totalRuns = 6;
      batterRuns = 6;
    } else if (resultType === 'WIDE') {
      totalRuns = scenario.runs ?? 1;
      extraRuns = totalRuns;
    } else if (resultType === 'NO_BALL') {
      totalRuns = scenario.runs ?? 1;
      extraRuns = totalRuns;
    } else if (resultType === 'BYE' || resultType === 'LEG_BYE') {
      totalRuns = scenario.runs ?? 1;
      extraRuns = totalRuns;
    }

    const { ballPath, shotType, targetZone } = this.calculateBallPath(
      resultType,
      totalRuns,
      isWicket,
      wicketType,
      extraType,
      false
    );

    const strikeRotated = (!extraType && batterRuns % 2 === 1) ||
      ((extraType === 'Bye' || extraType === 'Leg Bye') && totalRuns % 2 === 1);

    const overCompleted = isLegalBall && (currentBalls + 1) % 6 === 0;

    return Object.freeze({
      id: `det_${Date.now()}_${currentBalls}`,
      ballNumber: currentBalls + (isLegalBall ? 1 : 0),
      overIndex: Math.floor(currentBalls / 6),
      ballInOver: (currentBalls % 6) + 1,
      strikerId: striker.id,
      strikerName: striker.name,
      nonStrikerId: nonStriker.id,
      nonStrikerName: nonStriker.name,
      bowlerId: bowler.id,
      bowlerName: bowler.name,
      legalBall: isLegalBall,
      batterRuns,
      extraRuns,
      totalRuns,
      extraType,
      wicket: isWicket,
      wicketType,
      dismissedPlayerId: isWicket ? striker.id : undefined,
      dismissedPlayerName: isWicket ? striker.name : undefined,
      shotType,
      targetZone,
      ballPath,
      resultType,
      commentary: `${striker.name} ${resultType} vs ${bowler.name}`,
      timestamp: Date.now(),
      strikeRotated,
      overCompleted,
      isFreeHit: false,
      triggeredFreeHit: resultType === 'NO_BALL',
    });
  }
}

