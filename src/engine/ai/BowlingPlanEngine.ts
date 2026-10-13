import { Player } from '../../types/common';
import { PitchType } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';

export type BowlingPlanType =
  | 'ATTACK_STUMPS'
  | 'FULL_OUTSIDE_OFF'
  | 'GOOD_LENGTH_OFF_STUMP'
  | 'SHORT_BODY_LINE'
  | 'YORKER'
  | 'WIDE_YORKER'
  | 'SPIN_ATTACK'
  | 'DEFENSIVE_LINE'
  | 'DOT_BALL_PRESSURE'
  | 'BATTER_WEAKNESS_ATTACK';

export interface DetailedBowlingPlan {
  planType: BowlingPlanType;
  line: 'OUTSIDE_OFF' | 'STUMPS' | 'DOWN_LEG' | 'WIDE_OUTSIDE_OFF';
  length: 'YORKER' | 'FULL' | 'GOOD' | 'SHORT' | 'BOUNCER';
  variation: 'NORMAL' | 'SLOWER_BALL' | 'SWING' | 'REVERSE_SWING' | 'GOOGLY' | 'TOP_SPIN';
  intent: 'ATTACKING' | 'CONTAINING' | 'WICKET_TAKING' | 'DEFENSIVE' | 'SHORT_BALL_TRAP';
  tacticalPurpose: string;
  targetScoringZones: string[];
  riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedFieldPreset?: string;
  summary: string;
}

export interface BowlingPlanContext {
  format: ArenaFormat;
  overs: number;
  balls: number;
  wickets: number;
  target?: number;
  pitch: PitchType;
  strikerBalls?: number;
  strikerRuns?: number;
  recentBoundaryZones?: string[];
  bouncersThisOver?: number;
}

export class BowlingPlanEngine {
  /**
   * Evaluates bowler repertoire, batter profile and situation to generate an intelligent bowling plan.
   */
  public static selectBowlingPlan(
    bowler: Player,
    striker: Player,
    context: BowlingPlanContext
  ): DetailedBowlingPlan {
    const isSpinner = this.isSpinBowler(bowler);
    const isPacer = !isSpinner;
    const isLeftHander = (striker as any)?.battingHand === 'Left' || false;
    const overs = context.overs;
    const isDeath = context.format === 'T20' ? overs >= 16 : context.format === 'ODI' ? overs >= 40 : false;
    const isPowerplay = context.format === 'T20' ? overs < 6 : context.format === 'ODI' ? overs < 10 : overs < 15;
    const isTest = context.format === 'TEST';

    const strikerBalls = context.strikerBalls || 0;
    const isNewBatter = strikerBalls < 8;

    // ── 1. Spinner Plans ──
    if (isSpinner) {
      if (isTest || (isNewBatter && context.wickets < 6)) {
        return {
          planType: 'SPIN_ATTACK',
          line: isLeftHander ? 'OUTSIDE_OFF' : 'STUMPS',
          length: 'GOOD',
          variation: 'GOOGLY',
          intent: 'WICKET_TAKING',
          tacticalPurpose: 'Tempt batter forward with flight and extract turn into the rough/slips',
          targetScoringZones: ['SLIP', 'SHORT_LEG', 'COVER'],
          riskProfile: 'MEDIUM',
          recommendedFieldPreset: 'SPIN_WEB',
          summary: 'Attacking spin flight enticing drive against the turn towards close catchers',
        };
      }

      if (isDeath) {
        return {
          planType: 'DEFENSIVE_LINE',
          line: 'WIDE_OUTSIDE_OFF',
          length: 'GOOD',
          variation: 'SLOWER_BALL',
          intent: 'CONTAINING',
          tacticalPurpose: 'Drag batter wide away from their power hitting arc',
          targetScoringZones: ['DEEP_COVER', 'LONG_OFF'],
          riskProfile: 'LOW',
          recommendedFieldPreset: 'DEATH_YORKER_SHIELD',
          summary: 'Darting flat spin wide outside off stump starving leg-side leverage',
        };
      }

      return {
        planType: 'DOT_BALL_PRESSURE',
        line: 'STUMPS',
        length: 'GOOD',
        variation: 'NORMAL',
        intent: 'CONTAINING',
        tacticalPurpose: 'Stump-to-stump accuracy building dot ball pressure',
        targetScoringZones: ['MID_WICKET', 'POINT'],
        riskProfile: 'LOW',
        recommendedFieldPreset: 'MIDDLE_SQUEEZE',
        summary: 'Tight disciplined line choking singles and building partnership pressure',
      };
    }

    // ── 2. Pacer Plans ──

    // Death overs: York & wide yorker mixed with cutters (never 100% same delivery)
    if (isDeath) {
      const ballInOver = context.balls % 6;
      if (ballInOver === 2 || ballInOver === 4) {
        return {
          planType: 'WIDE_YORKER',
          line: 'WIDE_OUTSIDE_OFF',
          length: 'YORKER',
          variation: 'SLOWER_BALL',
          intent: 'DEFENSIVE',
          tacticalPurpose: 'Laser-guided wide tramline yorker keeping ball outside hitting arc',
          targetScoringZones: ['DEEP_POINT', 'THIRD_MAN'],
          riskProfile: 'LOW',
          recommendedFieldPreset: 'DEATH_YORKER_SHIELD',
          summary: 'Wide line tramline yorker neutralizing front-leg clearing boundary attempts',
        };
      }

      return {
        planType: 'YORKER',
        line: 'STUMPS',
        length: 'YORKER',
        variation: 'NORMAL',
        intent: 'DEFENSIVE',
        tacticalPurpose: 'Target base of the stumps at high pace to beat the swinging bat',
        targetScoringZones: ['LONG_ON', 'LONG_OFF'],
        riskProfile: 'MEDIUM',
        recommendedFieldPreset: 'DEATH_YORKER_SHIELD',
        summary: 'Toecrusher yorker aimed directly at the base of middle and leg stumps',
      };
    }

    // New batter or Test attacking phase: test the channel outside off
    if (isTest || isNewBatter || isPowerplay) {
      if (context.recentBoundaryZones?.includes('PULL') || context.recentBoundaryZones?.includes('SQUARE_LEG')) {
        return {
          planType: 'FULL_OUTSIDE_OFF',
          line: 'OUTSIDE_OFF',
          length: 'FULL',
          variation: 'SWING',
          intent: 'ATTACKING',
          tacticalPurpose: 'Drive batter away from leg side into off-side catching ring',
          targetScoringZones: ['COVER', 'GULLY', 'POINT'],
          riskProfile: 'MEDIUM',
          recommendedFieldPreset: 'ATTACKING_PACE',
          summary: 'Full swinging delivery enticing drive away from batter body towards slip cordon',
        };
      }

      return {
        planType: 'GOOD_LENGTH_OFF_STUMP',
        line: 'OUTSIDE_OFF',
        length: 'GOOD',
        variation: 'SWING',
        intent: 'WICKET_TAKING',
        tacticalPurpose: 'Corridor of uncertainty testing outside edge into the cordon',
        targetScoringZones: ['SLIP', 'GULLY', 'KEEPER'],
        riskProfile: 'MEDIUM',
        recommendedFieldPreset: 'ATTACKING_PACE',
        summary: 'Disciplined 4th stump good length moving away to extract edge',
      };
    }

    // Short ball surprise if bouncer quota allows
    if ((context.bouncersThisOver || 0) < 1 && Math.random() < 0.20) {
      return {
        planType: 'SHORT_BODY_LINE',
        line: 'STUMPS',
        length: 'SHORT',
        variation: 'NORMAL',
        intent: 'SHORT_BALL_TRAP',
        tacticalPurpose: 'Hurried bouncer into ribs to induce mistimed pull to deep square leg',
        targetScoringZones: ['DEEP_SQUARE_LEG', 'FINE_LEG'],
        riskProfile: 'HIGH',
        recommendedFieldPreset: 'MIDDLE_SQUEEZE',
        summary: 'Sharp rising delivery aimed at batter chest testing pull shot control',
      };
    }

    // Standard middle overs containing plan
    return {
      planType: 'ATTACK_STUMPS',
      line: 'STUMPS',
      length: 'GOOD',
      variation: 'NORMAL',
      intent: 'CONTAINING',
      tacticalPurpose: 'Hard length testing defensive discipline and inducing misjudgment',
      targetScoringZones: ['MID_OFF', 'MID_ON', 'COVER'],
      riskProfile: 'LOW',
      recommendedFieldPreset: 'MIDDLE_SQUEEZE',
      summary: 'Stump-to-stump hard length testing batter defence and limiting boundary angles',
    };
  }

  private static isSpinBowler(bowler: Player): boolean {
    const style = bowler.bowlingStyle?.toLowerCase() || '';
    const name = bowler.name.toLowerCase();
    return style.includes('spin') || style.includes('leg') || style.includes('off') || style.includes('slow') ||
      ['rashid', 'noor', 'varun', 'chahal', 'kuldeep', 'bishnoi', 'jadeja', 'krunal', 'akeal', 'rahul chahar', 'axar', 'narine', 'sundar', 'ashwin'].some(t => name.includes(t));
  }
}

