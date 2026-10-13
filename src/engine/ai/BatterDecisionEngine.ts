import { Player } from '../../types/common';

export type BattingIntent =
  | 'SURVIVAL'
  | 'DEFENSIVE'
  | 'SETTLING'
  | 'ROTATE_STRIKE'
  | 'NORMAL'
  | 'CONTROLLED_ATTACK'
  | 'ACCELERATE';

export interface BatterInningsState {
  playerId: string;
  inningsId: string;
  ballsFaced: number;
  runsScored: number;
  dots: number;
  boundaries: number;
  falseShots: number;
  beatenDeliveries: number;
  edges: number;
  mistimedShots: number;
  concentration: number; // 0 - 100
  settledness: number;   // 0 - 100 (10-20 when entering, up to 90-95 when settled)
  confidence: number;    // 0 - 100
  currentIntent: BattingIntent;
}

export interface BatterDecisionContext {
  format: 'T20' | 'ODI' | 'TEST' | string;
  batter: Player;
  bowler?: Player | null;
  inningsState: {
    score: number;
    wickets: number;
    balls: number;
    target?: number;
    partnershipRuns?: number;
    partnershipBalls?: number;
  };
  bowlingPlan?: {
    line?: string;
    length?: string;
    variation?: string;
    intent?: string;
  };
  ballAgeOvers?: number;
  pitchType?: string;
  userOverrideIntent?: BattingIntent;
}

export class BatterDecisionEngine {
  /**
   * Initializes a fresh batter state for the current innings.
   * New batters start with bounded, realistic settledness (12-18), NOT maximum.
   */
  public static createInitialBatterState(
    playerId: string,
    inningsId: string,
    player?: Player | null
  ): BatterInningsState {
    const temperament = player?.temperament ?? (player?.role === 'Bowler' ? 45 : 75);
    const battingSkill = player?.stats?.batting ?? (player?.role === 'Bowler' ? 25 : 70);

    // Initial settledness: new batter at the crease is naturally tentative
    const initialSettledness = Math.round(10 + (temperament / 100) * 8); // 14 - 18
    const initialConcentration = Math.round(70 + (temperament / 100) * 15); // 77 - 85
    const initialConfidence = Math.round(50 + (battingSkill / 100) * 15); // 54 - 65

    return {
      playerId,
      inningsId,
      ballsFaced: 0,
      runsScored: 0,
      dots: 0,
      boundaries: 0,
      falseShots: 0,
      beatenDeliveries: 0,
      edges: 0,
      mistimedShots: 0,
      concentration: initialConcentration,
      settledness: initialSettledness,
      confidence: initialConfidence,
      currentIntent: 'SETTLING',
    };
  }

  /**
   * Selects an intelligent, adaptive batting intent.
   * Respects manual user choice when present.
   */
  public static selectBattingIntent(
    state: BatterInningsState,
    context: BatterDecisionContext
  ): BattingIntent {
    // 1. Manual user override takes strict precedence
    if (context.userOverrideIntent) {
      return context.userOverrideIntent;
    }

    const { format, batter, bowler, inningsState, bowlingPlan } = context;
    const isTest = format === 'TEST';
    const isODI = format === 'ODI';
    const isT20 = format === 'T20' || format === 'IPL';

    const overs = Math.floor(inningsState.balls / 6);
    const wickets = inningsState.wickets;
    const target = inningsState.target || 0;
    const maxBalls = isT20 ? 120 : isODI ? 300 : 9999;
    const ballsRemaining = Math.max(1, maxBalls - inningsState.balls);
    const requiredRunRate = target > 0 ? ((target - inningsState.score) / (ballsRemaining / 6)) : 0;

    const isTailender = (batter.role === 'Bowler') || (batter.stats?.batting || 50) < 38;
    const isFinisher = ['russell', 'klaasen', 'pooran', 'hetmyer', 'tim david', 'rinku'].some(t => batter.name.toLowerCase().includes(t));
    const isAnchor = ['kohli', 'williamson', 'rahul', 'root', 'pujara'].some(t => batter.name.toLowerCase().includes(t));

    // Tailender logic
    if (isTailender) {
      if (isTest) return 'SURVIVAL';
      if (wickets >= 8 && requiredRunRate > 10) return 'ACCELERATE';
      return state.ballsFaced < 6 ? 'DEFENSIVE' : 'NORMAL';
    }

    // ── Test Cricket Logic ──
    if (isTest) {
      // Under heavy collapse (6+ wickets or tail), focus on survival
      if (wickets >= 7) return 'SURVIVAL';

      // New ball pressure (first 15 overs of innings or new ball taken)
      const ballAge = context.ballAgeOvers ?? overs;
      const isNewBall = ballAge < 12;

      if (state.ballsFaced < 15 || isNewBall) {
        return state.settledness < 30 ? 'DEFENSIVE' : 'SETTLING';
      }

      // Settled in Test
      if (state.settledness >= 55) {
        if (target > 0 && requiredRunRate > 4.5 && ballsRemaining < 180) {
          return 'CONTROLLED_ATTACK';
        }
        return 'NORMAL';
      }

      return 'SETTLING';
    }

    // ── ODI Cricket Logic ──
    if (isODI) {
      const isPowerplay = overs < 10;
      const isDeath = overs >= 40;

      // Chasing pressure
      if (target > 0) {
        if (requiredRunRate > 10) return 'ACCELERATE';
        if (requiredRunRate > 7.5) return 'CONTROLLED_ATTACK';
        if (requiredRunRate < 4.5 && wickets <= 4) return 'ROTATE_STRIKE';
      }

      // Death overs in first innings
      if (isDeath) {
        if (wickets < 7 && state.settledness > 40) return 'ACCELERATE';
        return 'CONTROLLED_ATTACK';
      }

      // Early innings / New batter
      if (state.ballsFaced < 8 && !isDeath) {
        return wickets >= 4 ? 'DEFENSIVE' : 'SETTLING';
      }

      // Middle overs (11-40): strike rotation & steady accumulation
      if (state.settledness >= 45) {
        return isFinisher && overs >= 35 ? 'CONTROLLED_ATTACK' : 'ROTATE_STRIKE';
      }

      return 'NORMAL';
    }

    // ── T20 Cricket Logic ──
    const isDeathT20 = overs >= 16;
    const isPowerplayT20 = overs < 6;

    // Chasing under steep RRR
    if (target > 0) {
      if (requiredRunRate > 13) return 'ACCELERATE';
      if (requiredRunRate > 10) return 'CONTROLLED_ATTACK';
      if (requiredRunRate < 6) return 'ROTATE_STRIKE';
    }

    // Death overs
    if (isDeathT20) {
      if (wickets < 8) return 'ACCELERATE';
      return 'CONTROLLED_ATTACK';
    }

    // Powerplay
    if (isPowerplayT20) {
      if (isAnchor && state.ballsFaced < 6) return 'SETTLING';
      return state.ballsFaced < 4 ? 'NORMAL' : 'CONTROLLED_ATTACK';
    }

    // Middle overs (7-15)
    if (state.ballsFaced < 5) return 'SETTLING';
    if (state.settledness > 60 && isFinisher) return 'CONTROLLED_ATTACK';
    if (wickets >= 5) return 'NORMAL';

    return 'ROTATE_STRIKE';
  }

  /**
   * Updates batter state after an authoritative delivery outcome.
   * Settledness increases with deliveries handled, but decreases on repeated false shots/dots.
   */
  public static updateBatterStateAfterDelivery(
    state: BatterInningsState,
    delivery: {
      runs: number;
      isWicket: boolean;
      isExtra?: boolean;
      extraType?: string;
      isBoundary?: boolean;
    }
  ): BatterInningsState {
    const isLegal = delivery.extraType !== 'Wide' && delivery.extraType !== 'No Ball';
    if (!isLegal) return state; // Extras do not count towards batter balls faced

    const runs = delivery.runs;
    const isWicket = delivery.isWicket;
    const isBoundary = runs === 4 || runs === 6 || delivery.isBoundary;
    const isDot = runs === 0 && !isWicket;

    const ballsFaced = state.ballsFaced + 1;
    const runsScored = state.runsScored + runs;
    const dots = state.dots + (isDot ? 1 : 0);
    const boundaries = state.boundaries + (isBoundary ? 1 : 0);

    // Natural settledness progression:
    // +2.2 points per ball handled safely up to 30 balls, smoothly plateauing towards 90-95.
    let settledDelta = 0;
    if (isBoundary) settledDelta = 3.5;
    else if (runs > 0) settledDelta = 2.4;
    else if (isDot) settledDelta = 1.2;

    // Small decay if trapped in excessive dot ball pressure
    if (isDot && state.dots >= 4 && state.runsScored < 5) {
      settledDelta = -0.5;
    }

    const nextSettledness = Math.min(94, Math.max(8, state.settledness + settledDelta));

    // Confidence adjustment
    let confDelta = isBoundary ? 4 : runs > 0 ? 1 : -0.5;
    const nextConfidence = Math.min(100, Math.max(15, state.confidence + confDelta));

    // Concentration: slowly tires over very long innings (>60 balls)
    let nextConcentration = state.concentration;
    if (ballsFaced > 60) {
      nextConcentration = Math.max(50, state.concentration - 0.2);
    }

    return {
      ...state,
      ballsFaced,
      runsScored,
      dots,
      boundaries,
      settledness: Math.round(nextSettledness * 10) / 10,
      confidence: Math.round(nextConfidence * 10) / 10,
      concentration: Math.round(nextConcentration * 10) / 10,
    };
  }
}

