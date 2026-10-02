import { 
  ArenaPlayerState, 
  ArenaFormat, 
  MatchPerformanceRecord, 
  CareerStatsModel, 
  PlayerDevelopmentCategories, 
  TestBowlerMemory 
} from '../models/ArenaState';
import { safeNumber, safeRating, safeForm, safePositiveInt, safePositiveFloat } from '../utils/safeMath';
import { Player } from '../../types/common';

export interface PerformanceInput {
  matchId: string;
  date?: number;
  format: ArenaFormat;
  oppositionTeamId?: string;
  oppositionName?: string;
  oppositionStrength?: number; // 50 - 99 rating of opposition
  venue?: string;
  pitchType?: string;
  weather?: string;
  matchResult?: 'WIN' | 'LOSS' | 'DRAW' | 'TIE';

  // Batting
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;

  // Bowling
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;

  // Fielding
  catches: number;
  stumpings: number;
  runOuts: number;

  // Test specifics
  ballsSurvived?: number;
  dots?: number;
  timeAtCrease?: number;
  fourthInnings?: boolean;
  bowlerMemories?: Record<string, { balls: number; swing: number; movement: number; wickets: number }>;
}

export class ProgressionEngine {
  /**
   * Initializes a fresh ArenaPlayerState for a given player in a specific arena and format.
   * Ensures recentMatches = 0, recentForm = baseline, hasRecentMatches = false.
   */
  public static createInitialState(
    arenaId: string,
    player: Player,
    format: ArenaFormat
  ): ArenaPlayerState {
    const baseAbility = safeRating(player.baseAbility || player.rating || 75);
    const potential = safeRating(Math.max(baseAbility + 5, player.rating ? player.rating + 4 : 85));

    const initialStats: CareerStatsModel = {
      matches: 0,
      innings: 0,
      runs: 0,
      ballsFaced: 0,
      highestScore: 0,
      fifties: 0,
      hundreds: 0,
      doubleHundreds: 0,
      tripleHundreds: 0,
      fours: 0,
      sixes: 0,
      notOuts: 0,
      oversBowled: 0,
      ballsBowled: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      bestBowlingWickets: 0,
      bestBowlingRuns: 0,
      bestBowling: '0/0',
      fiveWickets: 0,
      tenWickets: 0,
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      dots: 0,
      ballsSurvived: 0,
      timeAtCrease: 0,
      partnershipRuns: 0,
      fourthInningsRuns: 0,
      sessionsBatted: 0,
      newBallWickets: 0,
    };

    const initialDev: PlayerDevelopmentCategories = {
      bat: baseAbility,
      bowl: safeNumber(player.stats?.bowling, 40),
      field: safeNumber(player.stats?.fielding, 75),
      keeping: player.role === 'Wicketkeeper' ? 85 : 30,
      mental: safeNumber(player.temperament, 75),
      technique: baseAbility,
      fitness: safeNumber(player.stamina, 85),
    };

    return {
      id: `${arenaId}_${player.id}_${format}`,
      arenaId,
      playerId: player.id,
      format,
      baseRating: baseAbility,
      currentRating: baseAbility,
      potential,
      battingRating: safeNumber(player.stats?.batting, baseAbility),
      bowlingRating: safeNumber(player.stats?.bowling, 40),
      fieldingRating: safeNumber(player.stats?.fielding, 75),
      wicketkeepingRating: player.role === 'Wicketkeeper' ? 85 : 30,

      formRating: 75, // Baseline form rating
      confidence: 75, // Baseline confidence
      fitness: 85,
      fatigue: 0,

      hasRecentMatches: false,
      recentMatchCount: 0,
      recentRuns: 0,
      recentWickets: 0,
      recentCatches: 0,
      recentInnings: 0,
      recentBallsFaced: 0,
      recentBallsBowled: 0,
      recentAverage: 0,
      recentStrikeRate: 0,
      recentEconomy: 0,

      developmentPoints: 0,
      ratingDelta: 0,
      development: initialDev,
      recentMatches: [],

      careerStats: { ...initialStats },
      seasonStats: { ...initialStats },
      competitionStats: { ...initialStats },

      testMemory: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  /**
   * Evaluates match performance deterministically and updates ArenaPlayerState without modifying global player.
   */
  public static processMatchPerformance(
    currentState: ArenaPlayerState,
    input: PerformanceInput,
    playerRole: string = 'Batsman'
  ): { updatedState: ArenaPlayerState; matchRecord: MatchPerformanceRecord } {
    const format = input.format;
    const oldRating = currentState.currentRating;
    const oldForm = currentState.hasRecentMatches ? currentState.formRating : 75;

    // 1. Calculate Expected Performance vs Actual Performance
    const expected = this.calculateExpectedScore(currentState, input, playerRole);
    const performanceScore = this.calculatePerformanceScore(currentState, input, playerRole);

    // 2. Form Update (Fast-moving, rolling formula: newForm = oldForm * 0.80 + performanceScore * 0.20)
    const newForm = safeForm((oldForm * 0.80) + (performanceScore * 0.20));

    // 3. Rating Delta (Gradual clamped rating changes: -0.15 to +0.30)
    const ratingDelta = this.calculateRatingDelta(performanceScore, expected);
    const newRating = safeRating(oldRating + ratingDelta);

    // 4. Update Confidence, Fitness, and Fatigue deterministically
    const newConfidence = safeForm(currentState.confidence * 0.85 + (performanceScore > 50 ? 15 : -10) + (performanceScore * 0.15));
    
    // Fatigue calculation based on format workload
    let matchFatigue = 0;
    if (format === 'TEST') {
      matchFatigue = (input.balls * 0.15) + (input.overs * 2.5);
    } else if (format === 'ODI') {
      matchFatigue = (input.balls * 0.10) + (input.overs * 1.5);
    } else {
      matchFatigue = (input.balls * 0.05) + (input.overs * 1.0);
    }
    const newFatigue = Math.min(100, Math.max(0, (currentState.fatigue * 0.7) + matchFatigue));
    const newFitness = Math.min(100, Math.max(50, currentState.fitness - (newFatigue * 0.05)));

    // 5. Development Categories Progression
    const updatedDev = this.progressDevelopmentCategories(currentState, input, playerRole, performanceScore);

    // 6. Test Bowler Memory update if in Test match
    const updatedTestMemory = { ...(currentState.testMemory || {}) };
    if (format === 'TEST' && input.bowlerMemories) {
      Object.entries(input.bowlerMemories).forEach(([bowlerId, mem]) => {
        const existing = updatedTestMemory[bowlerId] || {
          ballsSeen: 0,
          movementSeen: 0,
          swingSeen: 0,
          bounceSeen: 0,
          wicketsLost: 0,
          adaptationLevel: 0,
        };
        const newBallsSeen = existing.ballsSeen + mem.balls;
        const newWicketsLost = existing.wicketsLost + mem.wickets;
        const newAdaptation = Math.min(100, Math.max(0, Math.round((newBallsSeen * 1.2) - (newWicketsLost * 10))));

        updatedTestMemory[bowlerId] = {
          ballsSeen: newBallsSeen,
          movementSeen: existing.movementSeen + mem.movement,
          swingSeen: existing.swingSeen + mem.swing,
          bounceSeen: existing.bounceSeen + 1,
          wicketsLost: newWicketsLost,
          adaptationLevel: newAdaptation,
        };
      });
    }

    // 7. Create Match Performance Record
    const matchRecord: MatchPerformanceRecord = {
      matchId: input.matchId,
      date: input.date || Date.now(),
      format: input.format,
      oppositionTeamId: input.oppositionTeamId,
      oppositionName: input.oppositionName,
      venue: input.venue,
      result: input.matchResult,
      runs: safePositiveInt(input.runs),
      balls: safePositiveInt(input.balls),
      fours: safePositiveInt(input.fours),
      sixes: safePositiveInt(input.sixes),
      isOut: Boolean(input.isOut),
      strikeRate: input.balls > 0 ? safePositiveFloat((input.runs / input.balls) * 100) : 0,
      overs: safePositiveFloat(input.overs),
      maidens: safePositiveInt(input.maidens),
      runsConceded: safePositiveInt(input.runsConceded),
      wickets: safePositiveInt(input.wickets),
      economy: input.overs > 0 ? safePositiveFloat(input.runsConceded / input.overs) : 0,
      catches: safePositiveInt(input.catches),
      stumpings: safePositiveInt(input.stumpings),
      runOuts: safePositiveInt(input.runOuts),
      ballsSurvived: input.ballsSurvived || input.balls,
      dots: input.dots || 0,
      timeAtCrease: input.timeAtCrease || (input.balls * 1.5),
      fourthInnings: input.fourthInnings || false,
      performanceScore: Math.round(performanceScore),
      expectedScore: Math.round(expected),
      formBefore: Math.round(oldForm),
      formAfter: Math.round(newForm),
      ratingBefore: oldRating,
      ratingAfter: newRating,
      ratingDelta,
    };

    // 8. Update rolling recent match window (keep last 20)
    const updatedRecentMatches = [matchRecord, ...currentState.recentMatches].slice(0, 20);
    const recentWindow = updatedRecentMatches.slice(0, 10); // Window for stats calculation

    // Calculate aggregated recent stats
    const recentMatchCount = updatedRecentMatches.length;
    const hasRecentMatches = recentMatchCount > 0;
    const recentRuns = recentWindow.reduce((acc, m) => acc + m.runs, 0);
    const recentWickets = recentWindow.reduce((acc, m) => acc + m.wickets, 0);
    const recentCatches = recentWindow.reduce((acc, m) => acc + m.catches, 0);
    const recentInnings = recentWindow.filter(m => m.balls > 0 || m.runs > 0 || m.isOut).length;
    const recentBallsFaced = recentWindow.reduce((acc, m) => acc + m.balls, 0);
    const recentBallsBowled = recentWindow.reduce((acc, m) => acc + Math.round(m.overs * 6), 0);
    const dismissals = recentWindow.filter(m => m.isOut).length;
    const recentAverage = dismissals > 0 ? safePositiveFloat(recentRuns / dismissals) : recentRuns;
    const recentStrikeRate = recentBallsFaced > 0 ? safePositiveFloat((recentRuns / recentBallsFaced) * 100) : 0;
    const recentRunsConceded = recentWindow.reduce((acc, m) => acc + m.runsConceded, 0);
    const recentEconomy = recentBallsBowled > 0 ? safePositiveFloat(recentRunsConceded / (recentBallsBowled / 6)) : 0;

    // 9. Update Career, Season, Competition stats separately
    const updatedCareerStats = this.aggregateStats(currentState.careerStats, input);
    const updatedSeasonStats = this.aggregateStats(currentState.seasonStats, input);
    const updatedCompetitionStats = this.aggregateStats(currentState.competitionStats, input);

    const updatedState: ArenaPlayerState = {
      ...currentState,
      currentRating: newRating,
      formRating: newForm,
      confidence: newConfidence,
      fitness: newFitness,
      fatigue: newFatigue,
      hasRecentMatches,
      recentMatchCount,
      recentRuns,
      recentWickets,
      recentCatches,
      recentInnings,
      recentBallsFaced,
      recentBallsBowled,
      recentAverage: Math.round(recentAverage * 10) / 10,
      recentStrikeRate: Math.round(recentStrikeRate * 10) / 10,
      recentEconomy: Math.round(recentEconomy * 10) / 10,
      ratingDelta,
      development: updatedDev,
      recentMatches: updatedRecentMatches,
      careerStats: updatedCareerStats,
      seasonStats: updatedSeasonStats,
      competitionStats: updatedCompetitionStats,
      testMemory: updatedTestMemory,
      lastMatchAt: input.date || Date.now(),
      updatedAt: Date.now(),
    };

    return { updatedState, matchRecord };
  }

  /**
   * Expected score calculation (0 - 100) based on ratings, role, format, and opposition.
   */
  private static calculateExpectedScore(
    state: ArenaPlayerState,
    input: PerformanceInput,
    role: string
  ): number {
    let expected = state.currentRating || 75;

    // Opposition strength modifier
    if (input.oppositionStrength && input.oppositionStrength > 0) {
      const oppDiff = input.oppositionStrength - 75;
      expected += (oppDiff * 0.1); // facing stronger opposition slightly increases expectation threshold
    }

    return safeNumber(expected, 75);
  }

  /**
   * Format-specific deterministic performance scoring (0 - 100).
   */
  public static calculatePerformanceScore(
    state: ArenaPlayerState,
    input: PerformanceInput,
    role: string
  ): number {
    const format = input.format;
    let battingScore = 50;
    let bowlingScore = 50;
    let fieldingScore = 50;

    const batted = input.balls > 0 || input.runs > 0 || input.isOut;
    const bowled = input.overs > 0;

    // Batting evaluation
    if (batted) {
      battingScore = 50;
      if (format === 'IPL' || format === 'T20') {
        // T20 / IPL emphasizes strike rate, boundary hitting, and quick runs
        const expectedRuns = 25;
        const expectedSR = 135;
        const actualSR = input.balls > 0 ? (input.runs / input.balls) * 100 : 0;
        
        battingScore += (input.runs - expectedRuns) * 1.1;
        battingScore += (actualSR - expectedSR) * 0.25;
        battingScore += (input.fours * 2.0) + (input.sixes * 4.0);
        if (input.runs >= 50) battingScore += 10;
        if (input.runs >= 100) battingScore += 20;
        if (input.runs === 0 && input.isOut) battingScore -= 12;

      } else if (format === 'ODI') {
        // ODI emphasizes innings building, strike rotation, and partnerships
        const expectedRuns = 35;
        const expectedSR = 88;
        const actualSR = input.balls > 0 ? (input.runs / input.balls) * 100 : 0;

        battingScore += (input.runs - expectedRuns) * 0.9;
        battingScore += (actualSR - expectedSR) * 0.15;
        battingScore += (input.fours * 1.5) + (input.sixes * 3.0);
        if (input.balls >= 50) battingScore += 5; // Long innings bonus
        if (input.runs >= 50) battingScore += 8;
        if (input.runs >= 100) battingScore += 15;
        if (input.runs === 0 && input.isOut) battingScore -= 10;

      } else {
        // TEST emphasizes survival, concentration, balls faced, and patient defense
        const expectedRuns = 40;
        const ballsFaced = input.balls;
        
        battingScore += (input.runs - expectedRuns) * 0.7;
        battingScore += (ballsFaced * 0.25); // Survival rewarded heavily!
        if (input.dots) battingScore += (input.dots * 0.05);
        if (ballsFaced >= 50) battingScore += 10;
        if (ballsFaced >= 100) battingScore += 15;
        if (input.runs >= 50) battingScore += 10;
        if (input.runs >= 100) battingScore += 20;
        if (input.fourthInnings) battingScore *= 1.15; // 4th innings pressure modifier
        if (input.runs === 0 && input.isOut && ballsFaced < 5) battingScore -= 15;
      }
    }

    // Bowling evaluation
    if (bowled) {
      bowlingScore = 50;
      const actualEcon = input.overs > 0 ? input.runsConceded / input.overs : 8;

      if (format === 'IPL' || format === 'T20') {
        const expectedEcon = 8.2;
        bowlingScore += (input.wickets * 18);
        bowlingScore += (expectedEcon - actualEcon) * 6;
        bowlingScore += (input.maidens * 15);
        if (input.wickets >= 3) bowlingScore += 12;
        if (input.wickets >= 5) bowlingScore += 25;

      } else if (format === 'ODI') {
        const expectedEcon = 5.4;
        bowlingScore += (input.wickets * 16);
        bowlingScore += (expectedEcon - actualEcon) * 5;
        bowlingScore += (input.maidens * 10);
        if (input.wickets >= 3) bowlingScore += 10;
        if (input.wickets >= 5) bowlingScore += 20;

      } else {
        // TEST bowling: wickets through sustained pressure, maidens, low economy
        const expectedEcon = 3.2;
        bowlingScore += (input.wickets * 15);
        bowlingScore += (expectedEcon - actualEcon) * 4;
        bowlingScore += (input.maidens * 6);
        if (input.overs >= 15) bowlingScore += 6; // Workload spell bonus
        if (input.wickets >= 5) bowlingScore += 25; // 5-wicket haul
        if (input.wickets >= 10) bowlingScore += 40; // 10-wicket match
      }
    }

    // Fielding evaluation
    fieldingScore += (input.catches * 6) + (input.stumpings * 8) + (input.runOuts * 10);

    // Opposition Strength modifier
    let oppModifier = 1.0;
    if (input.oppositionStrength) {
      oppModifier = 1.0 + ((input.oppositionStrength - 75) * 0.003); // Max +-7.5%
    }

    // Combine according to role
    let overallScore = 50;
    if (batted && bowled) {
      if (role === 'All-rounder') {
        overallScore = (battingScore * 0.45) + (bowlingScore * 0.45) + (fieldingScore * 0.10);
      } else if (role === 'Bowler') {
        overallScore = (battingScore * 0.20) + (bowlingScore * 0.70) + (fieldingScore * 0.10);
      } else {
        overallScore = (battingScore * 0.70) + (bowlingScore * 0.20) + (fieldingScore * 0.10);
      }
    } else if (batted) {
      overallScore = (battingScore * 0.85) + (fieldingScore * 0.15);
    } else if (bowled) {
      overallScore = (bowlingScore * 0.85) + (fieldingScore * 0.15);
    } else {
      overallScore = fieldingScore;
    }

    overallScore *= oppModifier;

    // Result context modifier (individual performance remains primary!)
    if (input.matchResult === 'WIN') overallScore += 2;
    if (input.matchResult === 'LOSS') overallScore -= 1;

    return Math.min(100, Math.max(0, Math.round(overallScore)));
  }

  /**
   * Deterministic rating change brackets:
   * exceptional: +0.30, excellent: +0.20, good: +0.10, normal: 0, below average: -0.05, poor: -0.10, very poor: -0.15
   */
  private static calculateRatingDelta(performanceScore: number, expectedScore: number): number {
    const diff = performanceScore - expectedScore;

    if (performanceScore >= 90 || diff >= 25) return 0.30;
    if (performanceScore >= 75 || diff >= 15) return 0.20;
    if (performanceScore >= 60 || diff >= 5)  return 0.10;
    if (performanceScore >= 40 && diff >= -10) return 0.00;
    if (performanceScore >= 25 || diff >= -20) return -0.05;
    if (performanceScore >= 10 || diff >= -30) return -0.10;
    return -0.15;
  }

  /**
   * Development category growth bounded by potential.
   */
  private static progressDevelopmentCategories(
    state: ArenaPlayerState,
    input: PerformanceInput,
    role: string,
    performanceScore: number
  ): PlayerDevelopmentCategories {
    const current = state.development;
    const potential = state.potential;
    const growthFactor = Math.max(0, (potential - state.currentRating) / 20); // harder to grow near potential

    const dev = { ...current };

    if (input.runs > 20 || input.balls > 30) {
      dev.bat = Math.min(potential, Math.round((dev.bat + 0.10 * growthFactor) * 10) / 10);
      dev.technique = Math.min(potential, Math.round((dev.technique + 0.08 * growthFactor) * 10) / 10);
    }
    if (input.wickets > 0 || input.overs > 3) {
      dev.bowl = Math.min(potential, Math.round((dev.bowl + 0.10 * growthFactor) * 10) / 10);
    }
    if (input.catches > 0 || input.stumpings > 0) {
      dev.field = Math.min(potential, Math.round((dev.field + 0.05 * growthFactor) * 10) / 10);
    }
    if (role === 'Wicketkeeper' && (input.catches > 0 || input.stumpings > 0)) {
      dev.keeping = Math.min(potential, Math.round((dev.keeping + 0.10 * growthFactor) * 10) / 10);
    }
    if (performanceScore > 70) {
      dev.mental = Math.min(potential, Math.round((dev.mental + 0.10 * growthFactor) * 10) / 10);
    }

    return dev;
  }

  /**
   * Career/Season/Competition Stats Aggregator.
   */
  private static aggregateStats(current: CareerStatsModel, input: PerformanceInput): CareerStatsModel {
    const isBatInnings = input.balls > 0 || input.runs > 0 || input.isOut;
    const ballsBowled = Math.round(input.overs * 6);
    const newRuns = current.runs + input.runs;
    const newHighest = Math.max(current.highestScore, input.runs);
    
    let bestW = current.bestBowlingWickets;
    let bestR = current.bestBowlingRuns;
    if (input.wickets > bestW || (input.wickets === bestW && input.runsConceded < bestR)) {
      bestW = input.wickets;
      bestR = input.runsConceded;
    }

    return {
      matches: current.matches + 1,
      innings: current.innings + (isBatInnings ? 1 : 0),
      runs: newRuns,
      ballsFaced: current.ballsFaced + input.balls,
      highestScore: newHighest,
      fifties: current.fifties + (input.runs >= 50 && input.runs < 100 ? 1 : 0),
      hundreds: current.hundreds + (input.runs >= 100 && input.runs < 200 ? 1 : 0),
      doubleHundreds: current.doubleHundreds + (input.runs >= 200 && input.runs < 300 ? 1 : 0),
      tripleHundreds: current.tripleHundreds + (input.runs >= 300 ? 1 : 0),
      fours: current.fours + input.fours,
      sixes: current.sixes + input.sixes,
      notOuts: current.notOuts + (isBatInnings && !input.isOut ? 1 : 0),

      oversBowled: Math.round((current.ballsBowled + ballsBowled) / 6),
      ballsBowled: current.ballsBowled + ballsBowled,
      maidens: current.maidens + input.maidens,
      runsConceded: current.runsConceded + input.runsConceded,
      wickets: current.wickets + input.wickets,
      bestBowlingWickets: bestW,
      bestBowlingRuns: bestR,
      bestBowling: `${bestW}/${bestR}`,
      fiveWickets: current.fiveWickets + (input.wickets >= 5 ? 1 : 0),
      tenWickets: current.tenWickets + (input.wickets >= 10 ? 1 : 0),

      catches: current.catches + input.catches,
      stumpings: current.stumpings + input.stumpings,
      runOuts: current.runOuts + input.runOuts,

      dots: current.dots + (input.dots || 0),
      ballsSurvived: current.ballsSurvived + (input.ballsSurvived || input.balls),
      timeAtCrease: current.timeAtCrease + (input.timeAtCrease || Math.round(input.balls * 1.5)),
      partnershipRuns: current.partnershipRuns + input.runs,
      fourthInningsRuns: current.fourthInningsRuns + (input.fourthInnings ? input.runs : 0),
      sessionsBatted: current.sessionsBatted + (input.balls > 50 ? 1 : 0),
      newBallWickets: current.newBallWickets + (input.overs < 10 ? input.wickets : 0),
    };
  }

  /**
   * Form decay towards baseline (75) when a player does not play.
   */
  public static applyFormDecay(state: ArenaPlayerState, decayAmount: number = 2): ArenaPlayerState {
    if (!state.hasRecentMatches) return state;
    
    let newForm = state.formRating;
    if (newForm > 75) {
      newForm = Math.max(75, newForm - decayAmount);
    } else if (newForm < 75) {
      newForm = Math.min(75, newForm + decayAmount);
    }

    return {
      ...state,
      formRating: safeForm(newForm),
      fatigue: Math.max(0, state.fatigue - 15), // Resting recovers fatigue
      fitness: Math.min(100, state.fitness + 2), // Resting improves fitness
      updatedAt: Date.now(),
    };
  }
}
