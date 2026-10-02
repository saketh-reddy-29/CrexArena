import { safeNumber } from '../utils/safeMath';

export type BattingIntentType =
  | 'SURVIVAL'
  | 'DEFENSIVE'
  | 'ROTATE'
  | 'BUILDING'
  | 'CONTROLLED_ATTACK'
  | 'AGGRESSIVE'
  | 'ALL_OUT_ATTACK';

export type BowlingIntentType =
  | 'CONTAINMENT'
  | 'DOT_BALL_PRESSURE'
  | 'BUILD_PRESSURE'
  | 'BREAK_PARTNERSHIP'
  | 'ATTACK_STUMPS'
  | 'DEATH_EXECUTION';

export interface FormatStrategyContext {
  format: 'T20' | 'IPL' | 'ODI' | 'TEST' | string;
  innings: number;
  balls: number;
  overs: number;
  maxOvers?: number;
  runs: number;
  wickets: number;
  target?: number | null;
  batter: {
    id?: string;
    name?: string;
    rating?: number;
    battingRating?: number;
    power?: number;
    aggression?: number;
    technique?: number;
    temperament?: number;
    ballsFaced?: number;
    runsScored?: number;
    form?: number;
    attributes?: Record<string, any>;
  };
  bowler: {
    id?: string;
    name?: string;
    rating?: number;
    bowlingRating?: number;
    economy?: number;
    wicketTaking?: number;
    form?: number;
    attributes?: Record<string, any>;
  };
  partnership?: {
    runs: number;
    balls: number;
  };
  recentDots?: number;
  day?: number;
  isDeclarationPush?: boolean;
}

export interface FormatStrategyDecision {
  battingIntent: BattingIntentType;
  bowlingIntent: BowlingIntentType;
  riskTolerance: number;       // 0.00 (extreme caution) to 1.00 (all-out attack)
  wicketValue: number;         // 0 to 100
  runValue: number;            // 0 to 100
  boundaryValue: number;       // 0 to 100
  partnershipValue: number;    // 0 to 100
  pressureValue: number;       // 0 to 100
  settledness: number;         // 0 to 100
  baseRunWeights: { runs: number; weight: number }[];
  baseWicketProbability: number;
  baseExtraProbability: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. T20 Strategy Engine: Maximum scoring rate within 20 overs
// ─────────────────────────────────────────────────────────────────────────────
export class T20StrategyEngine {
  public evaluate(context: FormatStrategyContext): FormatStrategyDecision {
    const { batter, bowler, overs, balls, wickets, target, runs } = context;
    const maxOvers = context.maxOvers || 20;
    const ballsRemaining = Math.max(0, maxOvers * 6 - balls);
    const wicketsRemaining = Math.max(0, 10 - wickets);

    // Settledness increases faster in T20 (ready to launch after 8-12 balls)
    const ballsFaced = safeNumber(batter.ballsFaced, 0);
    const settledness = Math.min(100, ballsFaced * 8.5);

    // Dynamic wicket value: High early on, lower at the death if wickets in hand
    let wicketValue = 65;
    if (wicketsRemaining <= 3) wicketValue = 90;
    else if (overs >= 16) wicketValue = 35; // Wickets are sacrificed for boundary attempts

    const runValue = 95;
    const boundaryValue = 95;
    const partnershipValue = 50;

    // Pressure & Required Run Rate Calculation
    let pressureValue = 40;
    let requiredRunRate = 0;
    if (target && ballsRemaining > 0) {
      const runsNeeded = Math.max(0, target - runs);
      requiredRunRate = (runsNeeded / ballsRemaining) * 6;
      if (requiredRunRate > 12) pressureValue = 90;
      else if (requiredRunRate > 9.5) pressureValue = 75;
      else if (requiredRunRate > 7.5) pressureValue = 55;
    }

    // Recent dot balls increase batter frustration and risk
    const recentDots = safeNumber(context.recentDots, 0);
    pressureValue = Math.min(100, pressureValue + recentDots * 6);

    // Batting Intent & Risk Tolerance
    let riskTolerance = 0.60;
    let battingIntent: BattingIntentType = 'AGGRESSIVE';

    if (wicketsRemaining <= 3 && overs < 14) {
      // Collapse recovery mode (e.g. 20/4)
      battingIntent = 'BUILDING';
      riskTolerance = 0.35;
    } else if (overs >= 16 || (target && requiredRunRate > 11)) {
      // Death overs / high chase = All out attack
      battingIntent = 'ALL_OUT_ATTACK';
      riskTolerance = 0.85;
    } else if (overs < 6) {
      // Powerplay: exploit 2 fielders outside 30yd circle
      battingIntent = 'AGGRESSIVE';
      riskTolerance = 0.65;
    } else {
      // Middle overs
      battingIntent = settledness > 40 ? 'AGGRESSIVE' : 'ROTATE';
      riskTolerance = settledness > 40 ? 0.60 : 0.45;
    }

    // Bowling Intent
    let bowlingIntent: BowlingIntentType = 'CONTAINMENT';
    if (overs >= 16) {
      bowlingIntent = 'DEATH_EXECUTION';
    } else if (wicketsRemaining <= 4 || overs < 6) {
      bowlingIntent = 'ATTACK_STUMPS';
    } else {
      bowlingIntent = 'DOT_BALL_PRESSURE';
    }

    // Base Run Probabilities for T20
    const baseRunWeights = [
      { runs: 0, weight: 34 },
      { runs: 1, weight: 31 },
      { runs: 2, weight: 10 },
      { runs: 3, weight: 2 },
      { runs: 4, weight: 17 },
      { runs: 6, weight: 6 },
    ];

    const baseWicketProbability = 0.045; // ~1 in 22 balls
    const baseExtraProbability = 0.035;

    return {
      battingIntent,
      bowlingIntent,
      riskTolerance,
      wicketValue,
      runValue,
      boundaryValue,
      partnershipValue,
      pressureValue,
      settledness,
      baseRunWeights,
      baseWicketProbability,
      baseExtraProbability,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ODI Strategy Engine: 50-Over Inning construction & partnership builder
// ─────────────────────────────────────────────────────────────────────────────
export class ODIStrategyEngine {
  public evaluate(context: FormatStrategyContext): FormatStrategyDecision {
    const { batter, bowler, overs, balls, wickets, target, runs } = context;
    const maxOvers = context.maxOvers || 50;
    const ballsRemaining = Math.max(0, maxOvers * 6 - balls);
    const wicketsRemaining = Math.max(0, 10 - wickets);

    const ballsFaced = safeNumber(batter.ballsFaced, 0);
    const settledness = Math.min(100, ballsFaced * 4.0); // Takes ~25 balls to settle

    let wicketValue = 85; // Wickets are very precious in 50-over cricket
    if (wicketsRemaining <= 4) wicketValue = 98;
    else if (overs >= 45) wicketValue = 45;

    const runValue = 80;
    const boundaryValue = 75;
    const partnershipValue = 90;

    // Phase-specific analysis (Overs 1-10, 11-35, 36-40, 41-50)
    let battingIntent: BattingIntentType = 'ROTATE';
    let riskTolerance = 0.40;
    let bowlingIntent: BowlingIntentType = 'BUILD_PRESSURE';

    if (overs < 10) {
      // Overs 1-10: Powerplay (Controlled attack, high wicket preservation)
      battingIntent = settledness > 30 ? 'CONTROLLED_ATTACK' : 'BUILDING';
      riskTolerance = 0.45;
      bowlingIntent = 'ATTACK_STUMPS';
    } else if (overs >= 10 && overs < 36) {
      // Overs 11-35: Middle Consolidation (Strike rotation, low risk)
      if (wicketsRemaining <= 4) {
        battingIntent = 'DEFENSIVE';
        riskTolerance = 0.25;
      } else {
        battingIntent = 'ROTATE';
        riskTolerance = 0.35;
      }
      bowlingIntent = 'DOT_BALL_PRESSURE';
    } else if (overs >= 36 && overs < 41) {
      // Overs 36-40: Acceleration preparation
      battingIntent = settledness > 50 ? 'CONTROLLED_ATTACK' : 'ROTATE';
      riskTolerance = 0.50;
      bowlingIntent = 'CONTAINMENT';
    } else {
      // Overs 41-50: Death overs
      battingIntent = wicketsRemaining > 4 ? 'ALL_OUT_ATTACK' : 'AGGRESSIVE';
      riskTolerance = wicketsRemaining > 4 ? 0.75 : 0.55;
      bowlingIntent = 'DEATH_EXECUTION';
    }

    // Required rate pressure in 2nd innings
    let pressureValue = 35;
    if (target && ballsRemaining > 0) {
      const runsNeeded = Math.max(0, target - runs);
      const rrr = (runsNeeded / ballsRemaining) * 6;
      if (rrr > 9) {
        pressureValue = 85;
        riskTolerance = Math.min(0.85, riskTolerance + 0.25);
        battingIntent = 'AGGRESSIVE';
      } else if (rrr > 7) {
        pressureValue = 65;
        riskTolerance = Math.min(0.70, riskTolerance + 0.15);
      }
    }

    // Base Run Probabilities for ODI (Focus on 1s and 2s, moderate boundaries)
    const baseRunWeights = [
      { runs: 0, weight: 42 },
      { runs: 1, weight: 33 },
      { runs: 2, weight: 11 },
      { runs: 3, weight: 1 },
      { runs: 4, weight: 11 },
      { runs: 6, weight: 2 },
    ];

    const baseWicketProbability = 0.030; // ~1 in 33 balls
    const baseExtraProbability = 0.030;

    return {
      battingIntent,
      bowlingIntent,
      riskTolerance,
      wicketValue,
      runValue,
      boundaryValue,
      partnershipValue,
      pressureValue,
      settledness,
      baseRunWeights,
      baseWicketProbability,
      baseExtraProbability,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Test Strategy Engine: Survival, concentration, and patience
// ─────────────────────────────────────────────────────────────────────────────
export class TestStrategyEngine {
  public evaluate(context: FormatStrategyContext): FormatStrategyDecision {
    const { batter, bowler, overs, wickets, target, runs } = context;
    const ballsFaced = safeNumber(batter.ballsFaced, 0);

    // Test Settledness Curve (0-5 balls: vulnerable, 30+ balls: locked in)
    let settledness = 0;
    if (ballsFaced <= 5) settledness = ballsFaced * 3.0; // 0-15
    else if (ballsFaced <= 15) settledness = 15 + (ballsFaced - 5) * 3.0; // 15-45
    else if (ballsFaced <= 30) settledness = 45 + (ballsFaced - 15) * 2.0; // 45-75
    else settledness = Math.min(100, 75 + (ballsFaced - 30) * 0.5); // 75-100

    const wicketValue = 98; // Wicket is priceless
    const runValue = 40;
    const boundaryValue = 35;
    const partnershipValue = 95;

    // Bowler building pressure through consecutive dot balls
    const recentDots = safeNumber(context.recentDots, 0);
    const pressureValue = Math.min(100, 20 + recentDots * 4.5 + (wickets > 6 ? 25 : 0));

    // Intent Progression: SURVIVAL -> DEFENSIVE -> BUILDING -> CONTROLLED_ATTACK
    let battingIntent: BattingIntentType = 'DEFENSIVE';
    let riskTolerance = 0.15;

    if (context.isDeclarationPush) {
      battingIntent = 'AGGRESSIVE';
      riskTolerance = 0.65;
    } else if (ballsFaced <= 8) {
      battingIntent = 'SURVIVAL';
      riskTolerance = 0.08;
    } else if (ballsFaced <= 25) {
      battingIntent = 'DEFENSIVE';
      riskTolerance = 0.18;
    } else if (settledness > 60) {
      battingIntent = 'BUILDING';
      riskTolerance = 0.28;
    }

    // 4th innings target pressure
    if (context.innings === 4 && target) {
      const runsRemaining = target - runs;
      const oversRemaining = 90; // Day 5 remaining overs heuristic
      const rrr = (runsRemaining / (oversRemaining * 6)) * 6;
      if (rrr > 4.5) {
        battingIntent = 'CONTROLLED_ATTACK';
        riskTolerance = 0.45;
      }
    }

    const bowlingIntent: BowlingIntentType = recentDots > 3 ? 'BUILD_PRESSURE' : 'ATTACK_STUMPS';

    // Base Run Probabilities for Test (60-70% dots, patient singles, rare 6s)
    let dotWeight = Math.max(55, 78 - (settledness * 0.2));
    let singleWeight = 16 + (settledness * 0.1);
    let twoWeight = 4;
    let threeWeight = 0.5;
    let fourWeight = 4 + (settledness * 0.08);
    let sixWeight = 0.2;

    if (battingIntent === 'SURVIVAL') {
      dotWeight = 88;
      singleWeight = 9;
      twoWeight = 2;
      threeWeight = 0.1;
      fourWeight = 0.9;
      sixWeight = 0.0;
    }

    const baseRunWeights = [
      { runs: 0, weight: dotWeight },
      { runs: 1, weight: singleWeight },
      { runs: 2, weight: twoWeight },
      { runs: 3, weight: threeWeight },
      { runs: 4, weight: fourWeight },
      { runs: 6, weight: sixWeight },
    ];

    // Dismissal probability scales down as batter becomes settled
    let baseWicketProbability = 0.035; // New batter is vulnerable
    if (settledness > 50) baseWicketProbability *= 0.70;
    if (ballsFaced > 150) baseWicketProbability *= 1.15; // Fatigue factor after long innings

    const baseExtraProbability = 0.025;

    return {
      battingIntent,
      bowlingIntent,
      riskTolerance,
      wicketValue,
      runValue,
      boundaryValue,
      partnershipValue,
      pressureValue,
      settledness,
      baseRunWeights,
      baseWicketProbability,
      baseExtraProbability,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Master Format Strategy Engine
// ─────────────────────────────────────────────────────────────────────────────
export class FormatStrategyEngine {
  private t20Engine = new T20StrategyEngine();
  private odiEngine = new ODIStrategyEngine();
  private testEngine = new TestStrategyEngine();

  public evaluate(context: FormatStrategyContext): FormatStrategyDecision {
    const format = (context.format || 'T20').toUpperCase();

    if (format === 'T20' || format === 'IPL' || format === 'THE_HUNDRED' || format === 'T10') {
      return this.t20Engine.evaluate(context);
    } else if (format === 'ODI' || format === 'LIST_A' || format === '50_OVER') {
      return this.odiEngine.evaluate(context);
    } else {
      return this.testEngine.evaluate(context);
    }
  }
}

export const formatStrategyEngine = new FormatStrategyEngine();
