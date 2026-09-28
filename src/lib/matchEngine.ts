import { Player } from '../types/common';
import {
  PitchType,
  WeatherCondition,
  TossDecision,
  BallOutcome,
  InningsData,
  PlayerMatchStats,
  PowerPlayPhase,
  DRSReview,
  DRSResult,
  SuperOverInnings,
  SuperOver,
  ImpactPlayerSubstitution,
  StrategicTimeout,
} from '../types/match';
import { calculateEffectiveRating } from './ratingEngine';
import { ArenaFormat } from '../stores/useGameStore';

// ═══════════════════════════════════════════════════════════════════════
//  IPL Match Engine — Real IPL Rules
//  Inspired by Cricket Director (cricketdirector.com)
//
//  Rules implemented:
//    ✓ Free Hit after No Ball
//    ✓ Impact Player substitution
//    ✓ DRS (2 reviews per innings, auto-simulated)
//    ✓ Strategic Timeout (momentum reset)
//    ✓ Super Over (tied match resolution)
//    ✓ 4-over bowling limit per bowler
//    ✓ Minimum 5 bowlers enforcement
//    ✓ Bouncer limit (2 per over)
//    ✓ T20 wide rules (stricter tramline)
//    ✓ Timed Out (rare event)
//    ✓ PowerPlay field restrictions affecting probabilities
// ═══════════════════════════════════════════════════════════════════════

export class MatchEngine {
  static getOversPerMatch(format?: string): number {
    return format === 'ODI' ? 50 : 20;
  }
  static readonly BALLS_PER_OVER = 6;
  static getMaxOversPerBowler(format?: string): number {
    if (format === 'TEST') return Infinity;
    return format === 'ODI' ? 10 : 4;
  }
  static readonly MIN_BOWLERS = 5;
  static readonly MAX_DRS_REVIEWS = 2;
  static readonly MAX_BOUNCERS_PER_OVER = 2;
  static readonly MAX_OVERSEAS_PLAYERS = 4;

  // ─── Pitch & Weather ─────────────────────────────────────────────

  static generatePitch(): PitchType {
    const types = Object.values(PitchType);
    return types[Math.floor(Math.random() * types.length)];
  }

  static generateWeather(): WeatherCondition {
    const conditions = Object.values(WeatherCondition);
    return conditions[Math.floor(Math.random() * conditions.length)];
  }

  // ─── Toss ────────────────────────────────────────────────────────

  static simulateToss(team1Id: string, team2Id: string): { winnerId: string; decision: TossDecision } {
    const winnerId = Math.random() > 0.5 ? team1Id : team2Id;
    // In IPL, ~60% teams choose to bowl first (dew factor)
    const decision = Math.random() > 0.4 ? TossDecision.BOWL : TossDecision.BAT;
    return { winnerId, decision };
  }

  // ─── PowerPlay Phase ─────────────────────────────────────────────

  static getPowerPlayPhase(overs: number, format?: string): PowerPlayPhase {
    if (format === 'TEST') {
      // In tests, field can be attacking or defensive, but there are no strict death overs
      if (overs < 15) return PowerPlayPhase.MANDATORY;
      if (overs > 80 && overs < 90) return PowerPlayPhase.DEATH; // New ball due
      return PowerPlayPhase.MIDDLE;
    }
    if (format === 'ODI') {
      if (overs < 10) return PowerPlayPhase.MANDATORY; // 2 outside
      if (overs < 40) return PowerPlayPhase.MIDDLE; // 4 outside
      return PowerPlayPhase.DEATH; // 5 outside
    }
    // T20 Default
    if (overs < 6) return PowerPlayPhase.MANDATORY; // 2 outside
    if (overs < 16) return PowerPlayPhase.MIDDLE; // up to 5 outside
    return PowerPlayPhase.DEATH;
  }

  // ─── Utility ─────────────────────────────────────────────────────

  private static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private static chooseWeighted<T extends string | number>(weights: Array<[T, number]>): T {
    const total = weights.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
    let roll = Math.random() * total;
    for (const [value, weight] of weights) {
      roll -= Math.max(0, weight);
      if (roll <= 0) return value;
    }
    return weights[weights.length - 1][0];
  }

  // ─── Recent Outcome Analysis ─────────────────────────────────────

  private static normalizeRecentOutcome(outcome: string): 'W' | 0 | 1 | 2 | 3 | 4 | 6 | null {
    if (outcome === 'W') return 'W';
    if (outcome === 'Wd' || outcome === 'Nb') return null;
    const parsed = Number(outcome);
    if (parsed === 0 || parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 || parsed === 6) return parsed;
    return null;
  }

  private static getRecentWicketModifier(recentOutcomes?: string[]): number {
    if (!recentOutcomes?.length) return 1;

    const recent = recentOutcomes
      .map((outcome) => this.normalizeRecentOutcome(outcome))
      .filter((outcome): outcome is 'W' | 0 | 1 | 2 | 3 | 4 | 6 => outcome !== null);

    if (!recent.length) return 1;

    const last12 = recent.slice(-12);
    const wicketsInLast12 = last12.filter((ball) => ball === 'W').length;
    const lastWicketIndex = recent.lastIndexOf('W');
    const ballsSinceLastWicket = lastWicketIndex === -1 ? 99 : recent.length - lastWicketIndex;

    let modifier = 1;
    if (ballsSinceLastWicket <= 2) modifier *= 0.35;
    else if (ballsSinceLastWicket <= 5) modifier *= 0.6;
    if (wicketsInLast12 >= 2) modifier *= 0.72;
    if (wicketsInLast12 >= 3) modifier *= 0.55;

    return this.clamp(modifier, 0.2, 1);
  }

  // ─── Player Analysis ─────────────────────────────────────────────

  private static isPaceBowler(bowler: Player): boolean {
    const style = bowler.bowlingStyle?.toLowerCase() || '';
    return style.includes('fast') || style.includes('pace') || style.includes('medium') || bowler.role === 'Bowler';
  }

  private static isSpinBowler(bowler: Player): boolean {
    const style = bowler.bowlingStyle?.toLowerCase() || '';
    const name = bowler.name.toLowerCase();
    return style.includes('spin') || style.includes('leg') || style.includes('off') || style.includes('slow') ||
      ['rashid', 'noor', 'varun', 'chahal', 'kuldeep', 'bishnoi', 'jadeja', 'krunal', 'akeal', 'rahul chahar', 'axar', 'narine', 'sundar', 'suyash', 'vicky ostwal'].some(token => name.includes(token));
  }

  private static getPaceSkill(batsman: Player): number {
    const style = batsman.battingStyle?.toLowerCase() || '';
    const base = batsman.stats?.batting || 60;
    return this.clamp(base + (style.includes('right') || style.includes('left') ? 4 : 0), 20, 99);
  }

  private static getSpinSkill(batsman: Player): number {
    const name = batsman.name.toLowerCase();
    const base = batsman.stats?.batting || 60;
    const knownSpinPlayers = ['kohli', 'rahul', 'gill', 'gaikwad', 'shreyas', 'suryakumar', 'samson', 'pant', 'du plessis', 'jaiswal', 'head', 'buttler', 'klaasen'];
    return this.clamp(base + (knownSpinPlayers.some(token => name.includes(token)) ? 7 : 0), 20, 99);
  }

  private static getDeathBowling(bowler: Player): number {
    const name = bowler.name.toLowerCase();
    const base = bowler.stats?.bowling || 45;
    const deathSpecialists = ['bumrah', 'natarajan', 'pathirana', 'rabada', 'starc', 'boult', 'arshdeep', 'shami', 'siraj', 'naveen', 'harshal', 'cummins', 'archer', 'ferguson'];
    return this.clamp(base + (deathSpecialists.some(token => name.includes(token)) ? 10 : 0), 20, 99);
  }

  // ─── Fielding Effects ────────────────────────────────────────────

  private static getFieldingEffect(batsman: Player, bowler: Player, outcome: number, wicketType?: BallOutcome['wicketType']): Pick<BallOutcome, 'runs' | 'isWicket' | 'fieldingEvent' | 'commentary'> | null {
    const fielderQuality = this.clamp(((bowler.stats?.fielding || 72) + (bowler.rating || 75)) / 2, 45, 96);

    if (wicketType === 'Caught' && Math.random() < this.clamp((74 - fielderQuality) / 650, 0.01, 0.08)) {
      return {
        runs: 1,
        isWicket: false,
        fieldingEvent: 'Dropped Catch',
        commentary: `${batsman.name} gets a life! The catch goes down and ${bowler.name} cannot believe it.`,
      };
    }

    if (wicketType === 'Run Out' && Math.random() < this.clamp((fielderQuality - 68) / 280, 0.02, 0.12)) {
      return {
        runs: 0,
        isWicket: true,
        fieldingEvent: 'Direct Hit',
        commentary: `DIRECT HIT! Sharp work in the ring and ${batsman.name} is short of the crease.`,
      };
    }

    if ((outcome === 4 || outcome === 2) && Math.random() < this.clamp((fielderQuality - 70) / 360, 0.01, 0.09)) {
      return {
        runs: Math.max(1, outcome - 2),
        isWicket: false,
        fieldingEvent: 'Boundary Save',
        commentary: `Brilliant boundary save! ${batsman.name} struck it well, but the fielder dives and cuts off two.`,
      };
    }

    if (outcome === 1 && Math.random() < this.clamp((72 - fielderQuality) / 420, 0.01, 0.07)) {
      return {
        runs: 2,
        isWicket: false,
        fieldingEvent: 'Misfield',
        commentary: `Misfield in the circle! ${batsman.name} turns one into two.`,
      };
    }

    return null;
  }

  // ─── Batter Archetypes ───────────────────────────────────────────

  private static getBatterArchetype(batsman: Player): 'anchor' | 'finisher' | 'accumulator' | 'attacker' | 'tail' {
    const name = batsman.name.toLowerCase();
    const aggression = batsman.aggression ?? (batsman.role === 'Bowler' ? 35 : 72);
    const temperament = batsman.temperament ?? (batsman.role === 'Bowler' ? 35 : 76);
    const batting = batsman.stats?.batting || 0;

    if (batting < 45 && (batsman.role === 'Bowler' || batsman.role === 'All-rounder' && batting < 35)) return 'tail';
    if (['kohli', 'williamson', 'rahul', 'gill', 'rahane', 'sudharsan', 'gaikwad', 'shreyas', 'jaiswal'].some(token => name.includes(token))) return 'anchor';
    if (['russell', 'pooran', 'hetmyer', 'klaasen', 'tim david', 'stoinis', 'livingstone', 'stubbs', 'rinku', 'buttler', 'pant'].some(token => name.includes(token))) return 'finisher';
    if (temperament >= 86 && aggression <= 78) return 'anchor';
    if (aggression >= 90 && batting >= 70) return 'finisher';
    if (temperament >= 80 && aggression < 85) return 'accumulator';
    return 'attacker';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CORE: Simulate a single ball delivery
  //  Now includes: Free Hit, DRS, Bouncer limits, PowerPlay effects
  // ═══════════════════════════════════════════════════════════════════

  static simulateBall(
    batsman: Player,
    bowler: Player,
    overs: number,
    wickets: number,
    requiredRate: number,
    pitchType: PitchType,
    weather: WeatherCondition,
    strikerStats?: PlayerMatchStats,
    bowlerStats?: PlayerMatchStats,
    recentOutcomes?: string[],
    isFreeHit: boolean = false,
    bouncersThisOver: number = 0,
    format?: string,
  ): BallOutcome {
    if (!batsman || !bowler) {
      return { runs: 0, isWicket: false, isExtra: false, batsmanId: batsman?.id || 'unknown', bowlerId: bowler?.id || 'unknown', commentary: "Match interruption: Missing player data." };
    }

    const overNumber = Math.floor(overs);
    const ballInInnings = Math.round(overs * this.BALLS_PER_OVER);
    const phase = this.getPowerPlayPhase(overs, format);
    const arenaFormat: ArenaFormat = (format as ArenaFormat) || 'T20';

    const isPowerplay = phase === PowerPlayPhase.MANDATORY;
    const isMiddleOvers = phase === PowerPlayPhase.MIDDLE;
    const isDeathOvers = phase === PowerPlayPhase.DEATH;
    const isPace = this.isPaceBowler(bowler);
    const isSpin = this.isSpinBowler(bowler);
    const archetype = this.getBatterArchetype(batsman);

    const batterEff = calculateEffectiveRating(batsman, arenaFormat);
    const bowlerEff = calculateEffectiveRating(bowler, arenaFormat);

    const batterSkill = batterEff.batting;
    const bowlerSkill = bowlerEff.bowling;
    const matchupSkill = isSpin ? this.getSpinSkill(batsman) : this.getPaceSkill(batsman);
    const aggression = batsman.aggression ?? (archetype === 'finisher' ? 92 : archetype === 'anchor' ? 64 : 76);
    const temperament = batsman.temperament ?? (archetype === 'anchor' ? 90 : archetype === 'finisher' ? 62 : 76);
    const form = batsman.form ?? 78;
    const bowlerForm = bowler.form ?? 78;
    const deathBowling = this.getDeathBowling(bowler);
    const batterMomentum = this.clamp(strikerStats?.momentum || 0, -16, 18);
    const bowlerMomentum = this.clamp(bowlerStats?.momentum || 0, -12, 18);
    const batterBalls = strikerStats?.balls || 0;
    const batterRuns = strikerStats?.runs || 0;
    const batterStrikeRate = batterBalls ? (batterRuns / batterBalls) * 100 : 100;
    const consecutiveDots = strikerStats?.consecutiveDots || 0;
    const bowlerDots = bowlerStats?.dots || 0;
    const bowlerLegalBalls = (bowlerStats?.overs || 0) * 6 + (bowlerStats?.legalBallsThisOver || 0);
    const bowlerDotRate = bowlerLegalBalls ? bowlerDots / bowlerLegalBalls : 0.35;
    const bowlerEconomy = bowlerLegalBalls ? ((bowlerStats?.runsConceded || 0) / bowlerLegalBalls) * 6 : 8;
    const recentWicketModifier = this.getRecentWicketModifier(recentOutcomes);

    // ── Pitch & Weather modifiers ──
    let pitchBatMod = 0;
    let pitchBowlMod = 0;
    if (pitchType === PitchType.BATTING) pitchBatMod += 0.08;
    if (pitchType === PitchType.PACE && isPace) pitchBowlMod += 0.08;
    if (pitchType === PitchType.SPIN && isSpin) pitchBowlMod += 0.08;
    if (pitchType === PitchType.SPIN && isMiddleOvers) pitchBowlMod += 0.04;
    if (pitchType === PitchType.SLOW) {
      pitchBatMod -= 0.06;
      pitchBowlMod += isSpin ? 0.08 : 0.03;
    }
    if (weather === WeatherCondition.CLOUDY && isPace && overs < 5) pitchBowlMod += 0.07;
    if (weather === WeatherCondition.DEW && !isPowerplay) pitchBatMod += 0.07;
    if (weather === WeatherCondition.HUMID && isDeathOvers) pitchBowlMod -= 0.03;

    // ── Skill calculations ──
    const skillEdge = this.clamp((batterSkill * 0.68 + matchupSkill * 0.32 + form * 0.35 - bowlerSkill - bowlerForm * 0.25) / 100, -0.35, 0.35);
    const setBatter = batterBalls >= 18 ? 0.08 : batterBalls >= 10 ? 0.04 : batterBalls < 6 ? -0.03 : 0;
    const tailPenalty = archetype === 'tail' ? -0.28 : 0;
    const anchorCalm = archetype === 'anchor' && batterBalls > 12 ? 0.06 : 0;

    // ── Pressure system ──
    const chasePressure = requiredRate > 0
      ? this.clamp((requiredRate - (isDeathOvers ? 10.5 : isMiddleOvers ? 8.5 : 9.2)) / 8, -0.18, 0.42)
      : 0;
    const scoreboardPressure = wickets >= 7 ? 0.24 : wickets >= 5 ? 0.14 : wickets >= 3 && overs < 10 ? 0.07 : 0;
    const dotPressure = this.clamp(consecutiveDots * 0.055 + Math.max(0, bowlerDotRate - 0.42) * 0.25, 0, 0.32);
    const pressure = this.clamp(chasePressure + scoreboardPressure + dotPressure - batterMomentum * 0.01, 0, 0.7);

    // ── Attack intent ──
    let attack = 0.5;
    if (arenaFormat === 'TEST') {
      attack = 0.35; // Test batsmen are naturally more defensive
      if (isPowerplay) attack = 0.45;
      if (isDeathOvers) attack = 0.30; // New ball -> more caution
    } else if (requiredRate > 0) {
      if (requiredRate > 12) attack = 0.85;
      else if (requiredRate > 9) attack = 0.7;
      else if (requiredRate < 6) attack = 0.4;
    } else if (isDeathOvers) {
      attack = 0.75;
    } else if (isPowerplay) {
      attack = 0.65;
    }

    let intent = 0.08;
    if (isPowerplay) intent += 0.13;
    if (isDeathOvers) intent += 0.27;
    if (requiredRate > 9.5) intent += 0.12;
    if (requiredRate > 12) intent += 0.18;
    if (requiredRate > 15) intent += 0.16;
    if (wickets >= 6 && !isDeathOvers) intent -= 0.12;
    if (archetype === 'anchor') intent -= 0.06;
    if (archetype === 'accumulator') intent -= 0.03;
    if (archetype === 'finisher') intent += isDeathOvers || requiredRate > 10 ? 0.16 : 0.06;
    if (batterStrikeRate < 85 && batterBalls > 14) intent += 0.08;

    // FREE HIT: Batsman plays more aggressively
    if (isFreeHit) {
      intent += 0.25;
      attack = Math.min(0.95, attack + 0.2);
    }

    intent = this.clamp(intent + aggression / 600 - temperament / 1000 + (attack - 0.5) * 0.15, 0, 0.85);

    // ── Bowling control ──
    const bowlingControl = this.clamp(
      (bowlerSkill - 70) / 180 + bowlerMomentum * 0.012 + pitchBowlMod - pitchBatMod +
      (isSpin && isMiddleOvers ? 0.08 : 0) +
      (isPace && isPowerplay ? 0.05 : 0) +
      (isPace && isDeathOvers ? (deathBowling - 70) / 240 : 0) +
      (bowlerEconomy < 7 ? 0.05 : bowlerEconomy > 10 ? -0.05 : 0),
      -0.22,
      0.34
    );

    const battingControl = this.clamp(skillEdge + setBatter + anchorCalm + pitchBatMod - pitchBowlMod + batterMomentum * 0.01 + tailPenalty, -0.36, 0.36);
    const releaseShot = consecutiveDots >= 3 || (requiredRate > 12 && Math.random() < 0.55);

    // ═══ EXTRAS: No Ball + Wide (IPL T20 Rules) ═══

    const extraRand = Math.random();

    // No Ball check (triggers Free Hit for next delivery)
    const noBallProb = 0.012 + (isDeathOvers ? 0.008 : 0) - bowlingControl * 0.015;
    // Bouncer above waist (above limit) = automatic no ball
    const bouncerNoBall = isPace && bouncersThisOver >= this.MAX_BOUNCERS_PER_OVER && Math.random() < 0.03;

    if (extraRand < noBallProb || bouncerNoBall) {
      const noBallCommentary = bouncerNoBall
        ? `NO BALL! That's the third bouncer of the over from ${bowler.name}. Free hit coming up!`
        : `NO BALL! ${bowler.name} has overstepped! One run and a FREE HIT coming up. The crowd roars!`;

      return {
        runs: 1,
        isWicket: false,
        isExtra: true,
        extraType: 'No Ball',
        batsmanId: batsman.id,
        bowlerId: bowler.id,
        commentary: noBallCommentary,
        triggeredFreeHit: true,  // Next ball is a free hit
        isFreeHit: false,
      };
    }

    // Wide ball check (T20 has stricter tramline)
    const wideProb = 0.022 + (isDeathOvers ? 0.008 : 0) - bowlingControl * 0.02;
    if (extraRand < noBallProb + wideProb && extraRand >= noBallProb) {
      return {
        runs: 1,
        isWicket: false,
        isExtra: true,
        extraType: 'Wide',
        batsmanId: batsman.id,
        bowlerId: bowler.id,
        commentary: `WIDE! ${bowler.name} misses the tramline. That's a gift run under pressure.`,
        isFreeHit,
      };
    }

    // ═══ OUTCOME WEIGHTS ═══

    let dot = isPowerplay ? 30 : isMiddleOvers ? 36 : 24;
    let one = isPowerplay ? 34 : isMiddleOvers ? 38 : 28;
    let two = isPowerplay ? 10 : isMiddleOvers ? 11 : 14;
    let three = isPowerplay ? 1.2 : isMiddleOvers ? 1.5 : 2.2;
    let four = isPowerplay ? 13 : isMiddleOvers ? 7 : 14;
    let six = isPowerplay ? 5 : isMiddleOvers ? 3 : 8;
    let wicket = isPowerplay ? 2.5 : isMiddleOvers ? 2.2 : 4.0;
    if (arenaFormat === 'TEST') {
      wicket *= 0.6; // Test matches have much lower per-ball wicket probability
    }

    // PowerPlay: fewer fielders outside → more boundaries but also catches in close
    if (isPowerplay) {
      four += 3;  // Only 2 outside the ring = more boundaries
      six += 1.5;
      wicket += 0.8;  // More catches in close positions
    }

    // Modifiers
    dot += bowlingControl * 35 + pressure * 14 - battingControl * 16;
    one += temperament / 20 + (archetype === 'anchor' || archetype === 'accumulator' ? 5 : 0) - intent * 6;
    two += battingControl * 6 + (archetype === 'accumulator' ? 3 : 0);
    four += battingControl * 16 + intent * 12 - bowlingControl * 10;
    six += battingControl * 9 + intent * 14 - bowlingControl * 10;
    wicket += pressure * 8 + intent * 4 + bowlingControl * 6 - temperament / 50 - battingControl * 3;
    wicket *= recentWicketModifier;

    // FREE HIT: Can only be dismissed by Run Out
    if (isFreeHit) {
      wicket = 0.3;  // Very small chance of run out only
      four += 5;
      six += 4;
      dot -= 8;
    }

    if (isSpin && isMiddleOvers) {
      dot += 8;
      one += 5;
      four -= 3;
      six -= 2;
      wicket += pressure * 2.5;
    }

    if (pitchType === PitchType.SLOW) {
      dot += 7;
      one += 4;
      two += 2;
      four -= 4;
      six -= 5;
      wicket += releaseShot ? 2 : 0.8;
    }

    if (isDeathOvers) {
      dot -= 5;
      one -= 3;
      two += 2;
      four += 2;
      six += archetype === 'finisher' ? 4 : 1.5;
      wicket += releaseShot ? 2.5 : 0.8;
    }

    if (releaseShot) {
      dot -= 4;
      four += 2;
      six += 2;
      wicket += isFreeHit ? 0 : 2.5;  // No wicket risk on free hit
    }

    if (wickets >= 6 && !isDeathOvers) {
      dot += 6;
      one += 6;
      four -= 4;
      six -= 4;
    }

    dot += Math.max(0, 0.5 - attack) * 8;
    four += Math.max(0, attack - 0.5) * 10;
    six += Math.max(0, attack - 0.5) * 8;

    if (ballInInnings > 0 && ballInInnings % 6 >= 4 && bowlerStats?.lastOverRuns !== undefined && bowlerStats.lastOverRuns <= 3) {
      dot += 3;
      wicket += isFreeHit ? 0 : 1.5;
    }

    const outcome = this.chooseWeighted<number>([
      [0, this.clamp(dot, 16, 50)],
      [1, this.clamp(one, 20, 50)],
      [2, this.clamp(two, 5, 18)],
      [3, this.clamp(three, 0.3, 3.5)],
      [4, this.clamp(four, 3, isDeathOvers ? 20 : 16)],
      [6, this.clamp(six, 0.8, isDeathOvers ? 14 : 9)],
      [-1, this.clamp(wicket, isFreeHit ? 0.1 : 0.8, isDeathOvers ? 5.5 : 4.0)]
    ]);

    // ═══ WICKET ═══
    if (outcome === -1) {
      let wicketType: BallOutcome['wicketType'] = 'Caught';

      // On FREE HIT: only Run Out is possible
      if (isFreeHit) {
        wicketType = 'Run Out';
      } else {
        const wicketRoll = Math.random();
        if (isDeathOvers || releaseShot || intent > 0.45) {
          wicketType = wicketRoll < 0.68 ? 'Caught' : wicketRoll < 0.86 ? 'Bowled' : 'Run Out';
        } else if (isSpin) {
          wicketType = wicketRoll < 0.42 ? 'Caught' : wicketRoll < 0.68 ? 'LBW' : wicketRoll < 0.86 ? 'Stumped' : 'Bowled';
        } else {
          wicketType = wicketRoll < 0.38 ? 'Caught' : wicketRoll < 0.52 ? 'Caught Behind' : wicketRoll < 0.80 ? 'Bowled' : 'LBW';
        }
      }

      // Fielding effect can override (dropped catch, etc.)
      const fieldingEffect = this.getFieldingEffect(batsman, bowler, 0, wicketType);
      if (fieldingEffect && !fieldingEffect.isWicket) {
        return {
          runs: fieldingEffect.runs,
          isWicket: false,
          isExtra: false,
          batsmanId: batsman.id,
          bowlerId: bowler.id,
          fieldingEvent: fieldingEffect.fieldingEvent,
          commentary: fieldingEffect.commentary,
          isFreeHit,
        };
      }

      let commentary = '';
      if (isFreeHit) {
        commentary = `RUN OUT on a Free Hit! ${batsman.name} took the risk for an extra run but the throw is accurate. Gone!`;
      } else if (wicketType === 'Caught') {
        commentary = releaseShot
          ? `OUT! ${batsman.name} tries to break free, but ${bowler.name} has the field set perfectly. Taken in the deep!`
          : `OUT! ${bowler.name} finds the edge and ${batsman.name} is caught. Massive wicket!`;
      } else if (wicketType === 'Caught Behind') {
        commentary = `Feather behind! ${bowler.name} finds just enough movement and ${batsman.name} has to walk.`;
      } else if (wicketType === 'Bowled') {
        commentary = `BOWLED HIM! ${bowler.name} nails the length and ${batsman.name}'s stumps are shattered!`;
      } else if (wicketType === 'LBW') {
        commentary = `Huge appeal — GIVEN! ${bowler.name} has trapped ${batsman.name} in front. Plumb LBW!`;
      } else if (wicketType === 'Stumped') {
        commentary = `Beaten in the flight and STUMPED! Brilliant keeping. ${bowler.name} outfoxes ${batsman.name}.`;
      } else {
        commentary = `RUN OUT! The pressure forces a risky single and ${batsman.name} is short of the crease!`;
      }

      return {
        runs: 0,
        isWicket: true,
        wicketType,
        isExtra: false,
        batsmanId: batsman.id,
        bowlerId: bowler.id,
        fieldingEvent: fieldingEffect?.fieldingEvent,
        commentary,
        isFreeHit,
      };
    }

    // ═══ RUNS ═══
    const fieldingEffect = this.getFieldingEffect(batsman, bowler, outcome);
    if (fieldingEffect) {
      return {
        runs: fieldingEffect.runs,
        isWicket: fieldingEffect.isWicket,
        isExtra: false,
        batsmanId: batsman.id,
        bowlerId: bowler.id,
        fieldingEvent: fieldingEffect.fieldingEvent,
        commentary: fieldingEffect.commentary,
        isFreeHit,
      };
    }

    let commentary = '';
    if (outcome === 6) {
      commentary = isFreeHit
        ? `FREE HIT SIX! ${batsman.name} knows there's no risk and launches it into the stands! The crowd erupts!`
        : isDeathOvers
          ? `${batsman.name} clears the front leg and LAUNCHES it for SIX! Death-over carnage!`
          : `${batsman.name} picks the length early and deposits it over the rope for SIX!`;
    } else if (outcome === 4) {
      commentary = isFreeHit
        ? `FREE HIT FOUR! ${batsman.name} cashes in with a crisp drive through the covers!`
        : releaseShot
          ? `Pressure released! ${batsman.name} finds the gap and races away for FOUR.`
          : `${batsman.name} times it beautifully through the field for FOUR.`;
    } else if (outcome === 3) {
      commentary = `Excellent placement from ${batsman.name}; they run hard and come back for three.`;
    } else if (outcome === 2) {
      commentary = archetype === 'accumulator' || archetype === 'anchor'
        ? `${batsman.name} works it into space and pushes hard for two. Smart cricket.`
        : `Good running between the wickets, two added.`;
    } else if (outcome === 1) {
      commentary = consecutiveDots >= 2
        ? `${batsman.name} gets off strike. Sensible release after the dots.`
        : `${batsman.name} nudges it into the ring and rotates the strike.`;
    } else {
      commentary = isFreeHit
        ? `Dot ball on a Free Hit! ${batsman.name} couldn't capitalize. Rare miss.`
        : pressure > 0.28
          ? `Dot ball from ${bowler.name}. The squeeze is real now.`
          : isSpin && isMiddleOvers
            ? `${bowler.name} gives it air, no gap for ${batsman.name}. Dot.`
            : `${batsman.name} cannot beat the infield. Dot ball.`;
    }

    return {
      runs: outcome,
      isWicket: false,
      isExtra: false,
      batsmanId: batsman.id,
      bowlerId: bowler.id,
      commentary,
      isFreeHit,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DRS: Decision Review System (Auto-Simulated)
  //  Each team gets 2 reviews per innings.
  //  Successful review (overturned) = review retained.
  // ═══════════════════════════════════════════════════════════════════

  static simulateDRS(
    ballOutcome: BallOutcome,
    reviewingTeamId: string,
    reviewsRemaining: number,
  ): DRSReview | null {
    if (reviewsRemaining <= 0) return null;

    // Only review on dismissals (LBW, Caught Behind, Caught)
    // Or on not-out close calls
    const isLBW = ballOutcome.wicketType === 'LBW';
    const isCaughtBehind = ballOutcome.wicketType === 'Caught Behind';
    const isCaught = ballOutcome.wicketType === 'Caught';

    if (!ballOutcome.isWicket) {
      // Batting team reviews a not-out LBW appeal (close call)
      if (Math.random() < 0.04) {  // 4% chance of a close not-out LBW that gets reviewed
        const result = Math.random();
        const drsResult = result < 0.25
          ? DRSResult.OVERTURNED
          : result < 0.55
            ? DRSResult.UMPIRES_CALL
            : DRSResult.UPHELD;

        return {
          reviewingTeamId,
          originalDecision: 'Not Out',
          reviewType: 'LBW',
          result: drsResult,
          overturned: drsResult === DRSResult.OVERTURNED,
        };
      }
      return null;
    }

    // Batting team reviews an out decision
    if (!isLBW && !isCaughtBehind && !isCaught) return null;

    // 15% chance the dismissed batter decides to review
    if (Math.random() > 0.15) return null;

    const reviewType = isLBW ? 'LBW' as const : isCaughtBehind ? 'Caught Behind' as const : 'Caught' as const;
    const result = Math.random();
    let drsResult: DRSResult;

    if (isLBW) {
      // LBW reviews: 30% overturned, 25% umpire's call, 45% upheld
      drsResult = result < 0.30 ? DRSResult.OVERTURNED : result < 0.55 ? DRSResult.UMPIRES_CALL : DRSResult.UPHELD;
    } else if (isCaughtBehind) {
      // Caught behind: 35% overturned (no edge), 65% upheld
      drsResult = result < 0.35 ? DRSResult.OVERTURNED : DRSResult.UPHELD;
    } else {
      // Caught: 20% overturned (grassed/no bat), 80% upheld
      drsResult = result < 0.20 ? DRSResult.OVERTURNED : DRSResult.UPHELD;
    }

    return {
      reviewingTeamId,
      originalDecision: 'Out',
      reviewType,
      result: drsResult,
      overturned: drsResult === DRSResult.OVERTURNED,
    };
  }

  static getDRSCommentary(review: DRSReview, batsmanName: string, bowlerName: string): string {
    if (review.originalDecision === 'Out') {
      if (review.overturned) {
        if (review.reviewType === 'LBW') {
          return `🔍 DRS REVIEW: Ball tracking shows it's missing the stumps! Decision OVERTURNED. ${batsmanName} survives! Great use of the review.`;
        }
        if (review.reviewType === 'Caught Behind') {
          return `🔍 DRS REVIEW: UltraEdge shows NO edge! Decision OVERTURNED. ${batsmanName} called back. ${bowlerName} shakes his head.`;
        }
        return `🔍 DRS REVIEW: Replays show it was NOT out! Decision OVERTURNED. ${batsmanName} gets a reprieve!`;
      }
      if (review.result === DRSResult.UMPIRES_CALL) {
        return `🔍 DRS REVIEW: Umpire's Call! The ball was clipping the stumps. Original decision stays — ${batsmanName} has to go, but the review is RETAINED.`;
      }
      return `🔍 DRS REVIEW: Decision UPHELD! ${batsmanName} is out. Review lost for the batting team.`;
    } else {
      // Not Out review by bowling team
      if (review.overturned) {
        return `🔍 DRS REVIEW: Ball tracking shows THREE REDS! Decision OVERTURNED — ${batsmanName} is OUT! Brilliant review by the bowling team.`;
      }
      if (review.result === DRSResult.UMPIRES_CALL) {
        return `🔍 DRS REVIEW: Umpire's Call on impact. Stays Not Out. ${bowlerName} is frustrated but the review is RETAINED.`;
      }
      return `🔍 DRS REVIEW: Not enough evidence. Decision stays Not Out. Review lost for the bowling team.`;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  STRATEGIC TIMEOUT
  //  Bowling team: between overs 6-9
  //  Batting team: between overs 13-16
  //  Effect: Resets momentum by ~30%
  // ═══════════════════════════════════════════════════════════════════

  static shouldTriggerStrategicTimeout(
    overNumber: number,
    inningsNumber: 1 | 2,
    existingTimeouts: StrategicTimeout[]
  ): StrategicTimeout | null {
    const bowlingTimeout = existingTimeouts.find(t => t.teamType === 'bowling' && t.inningsNumber === inningsNumber);
    const battingTimeout = existingTimeouts.find(t => t.teamType === 'batting' && t.inningsNumber === inningsNumber);

    // Bowling team timeout: between overs 6-9 (usually at 7 or 8)
    if (!bowlingTimeout && overNumber >= 6 && overNumber <= 9) {
      if (overNumber === 7 || (overNumber === 9 && !bowlingTimeout)) {
        return { teamType: 'bowling', overNumber, inningsNumber };
      }
    }

    // Batting team timeout: between overs 13-16 (usually at 14 or 15)
    if (!battingTimeout && overNumber >= 13 && overNumber <= 16) {
      if (overNumber === 14 || (overNumber === 16 && !battingTimeout)) {
        return { teamType: 'batting', overNumber, inningsNumber };
      }
    }

    return null;
  }

  static getTimeoutCommentary(timeout: StrategicTimeout): string {
    if (timeout.teamType === 'bowling') {
      return `⏱️ STRATEGIC TIMEOUT called by the bowling team after over ${timeout.overNumber}. Time to regroup and plan the middle-overs strategy.`;
    }
    return `⏱️ STRATEGIC TIMEOUT called by the batting team after over ${timeout.overNumber}. Time to assess the target and plan the final assault.`;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  IMPACT PLAYER — AI Auto-Selection
  //  Analyzes match situation and picks the best substitute
  // ═══════════════════════════════════════════════════════════════════

  static selectImpactPlayer(
    squad: Player[],
    playingXI: string[],
    substitutes: Player[],
    matchSituation: {
      wickets: number;
      overs: number;
      runs: number;
      isChasing: boolean;
      requiredRate?: number;
      overseasInXI: number;
    }
  ): ImpactPlayerSubstitution | null {
    if (substitutes.length === 0) return null;

    const { wickets, overs, runs, isChasing, requiredRate, overseasInXI } = matchSituation;

    // Filter: if 4 overseas already in XI, impact player must be Indian
    const eligible = overseasInXI >= this.MAX_OVERSEAS_PLAYERS
      ? substitutes.filter(p => p.nationality === 'Indian')
      : substitutes;

    if (eligible.length === 0) return null;

    // Decide what we need
    const needBatting = (isChasing && requiredRate && requiredRate > 10) || wickets >= 4;
    const needBowling = !isChasing && overs >= 10 && runs > 100;

    let bestSub: Player | null = null;
    let outgoingPlayerId = '';
    let reason = '';

    if (needBatting) {
      // Find best available batsman
      bestSub = eligible.reduce((best, p) =>
        (p.stats?.batting || 0) > (best.stats?.batting || 0) ? p : best, eligible[0]);
      reason = 'Batting reinforcement';

      // Replace weakest bowler in XI
      const xiBowlers = playingXI
        .map(id => squad.find(p => p.id === id))
        .filter((p): p is Player => !!p && (p.role === 'Bowler'))
        .sort((a, b) => (a.stats?.batting || 0) - (b.stats?.batting || 0));
      outgoingPlayerId = xiBowlers[0]?.id || playingXI[playingXI.length - 1];
    } else if (needBowling) {
      // Find best available bowler
      bestSub = eligible.reduce((best, p) =>
        (p.stats?.bowling || 0) > (best.stats?.bowling || 0) ? p : best, eligible[0]);
      reason = 'Bowling reinforcement';

      // Replace weakest batsman in XI
      const xiBatsmen = playingXI
        .map(id => squad.find(p => p.id === id))
        .filter((p): p is Player => !!p && (p.role === 'Batsman'))
        .sort((a, b) => (a.stats?.batting || 0) - (b.stats?.batting || 0));
      outgoingPlayerId = xiBatsmen[0]?.id || playingXI[playingXI.length - 1];
    } else {
      // Bring in best all-rounder
      bestSub = eligible.reduce((best, p) => {
        const score = (p.stats?.batting || 0) + (p.stats?.bowling || 0);
        const bestScore = (best.stats?.batting || 0) + (best.stats?.bowling || 0);
        return score > bestScore ? p : best;
      }, eligible[0]);
      reason = 'Tactical flexibility';
      outgoingPlayerId = playingXI[playingXI.length - 1];
    }

    if (!bestSub) return null;

    return {
      incomingPlayerId: bestSub.id,
      outgoingPlayerId,
      teamId: bestSub.intendedTeamId || '',
      overNumber: Math.floor(overs),
      reason,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SUPER OVER — Tied Match Resolution
  // ═══════════════════════════════════════════════════════════════════

  static simulateSuperOver(
    team1BatsmenIds: [string, string, string],
    team1BowlerId: string,
    team2BatsmenIds: [string, string, string],
    team2BowlerId: string,
    players: Player[],
    pitchType: PitchType,
    weather: WeatherCondition,
    attempt: number = 1,
  ): SuperOver {
    const getPlayer = (id: string) => players.find(p => p.id === id)!;

    const simulateSuperOverInnings = (
      batsmenIds: [string, string, string],
      bowlerId: string,
      target: number = 0,
    ): SuperOverInnings => {
      const innings: SuperOverInnings = {
        battingTeamId: getPlayer(batsmenIds[0])?.intendedTeamId || '',
        bowlingTeamId: getPlayer(bowlerId)?.intendedTeamId || '',
        runs: 0,
        wickets: 0,
        balls: 0,
        batsmanIds: batsmenIds,
        bowlerId,
        ballByBall: [],
      };

      let strikerIdx = 0;
      let nonStrikerIdx = 1;
      const bowler = getPlayer(bowlerId);

      for (let ball = 0; ball < 6; ball++) {
        if (innings.wickets >= 2) break;  // All out in super over (only 3 batsmen)

        // Check if chasing team has won
        if (target > 0 && innings.runs > target) break;

        const striker = getPlayer(batsmenIds[strikerIdx]);
        if (!striker || !bowler) break;

        const requiredRate = target > 0
          ? ((target + 1 - innings.runs) / ((6 - ball) / 6)) || 0
          : 0;

        const result = this.simulateBall(
          striker, bowler, 19, innings.wickets, requiredRate,
          pitchType, weather, undefined, undefined, undefined, false, 0
        );

        innings.ballByBall.push(result);

        if (result.isWicket) {
          innings.wickets++;
          // Next batter comes in
          if (innings.wickets < 2) {
            strikerIdx = 2;  // Third batter
          }
        } else {
          innings.runs += result.runs;
          if (result.isExtra) innings.runs += 0;  // Already counted in runs

          // Rotate strike on odd runs
          if (result.runs % 2 === 1) {
            [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
          }
        }

        innings.balls++;
      }

      return innings;
    };

    // Team 1 bats first in Super Over
    const innings1 = simulateSuperOverInnings(team1BatsmenIds, team2BowlerId);
    // Team 2 chases
    const innings2 = simulateSuperOverInnings(team2BatsmenIds, team1BowlerId, innings1.runs);

    const superOver: SuperOver = {
      innings: [innings1, innings2],
      attempt,
    };

    if (innings2.runs > innings1.runs) {
      superOver.winnerId = innings2.battingTeamId;
    } else if (innings1.runs > innings2.runs) {
      superOver.winnerId = innings1.battingTeamId;
    }
    // If still tied, winnerId remains undefined (another super over needed)

    return superOver;
  }

  static getSuperOverCommentary(superOver: SuperOver): string {
    const i1 = superOver.innings[0];
    const i2 = superOver.innings[1];

    if (superOver.winnerId === i1.battingTeamId) {
      return `🏆 SUPER OVER WON! Team batting first scored ${i1.runs}/${i1.wickets}. The chasing team could only manage ${i2.runs}/${i2.wickets}. What a finish!`;
    } else if (superOver.winnerId === i2.battingTeamId) {
      return `🏆 SUPER OVER WON! Chasing ${i1.runs + 1} to win, they got there with ${i2.runs}/${i2.wickets}! Incredible scenes!`;
    }
    return `😱 SUPER OVER TIED! Both teams scored ${i1.runs}. We need ANOTHER Super Over!`;
  }

  // ─── Bowler Validation ───────────────────────────────────────────

  static canBowlerBowl(bowlerStats: PlayerMatchStats | undefined, format?: string): boolean {
    if (!bowlerStats) return true;
    const totalOvers = (bowlerStats.overs || 0) + ((bowlerStats.legalBallsThisOver || 0) >= 6 ? 1 : 0);
    return totalOvers < this.getMaxOversPerBowler(format);
  }

  static getAvailableBowlers(
    bowlerIds: string[],
    players: Player[],
    bowlerRecords: Record<string, PlayerMatchStats>,
    currentBowlerId?: string,
  ): Player[] {
    return bowlerIds
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => {
        if (!p) return false;
        if (p.id === currentBowlerId) return false;  // Can't bowl consecutive overs
        return this.canBowlerBowl(bowlerRecords[p.id]);
      });
  }

  // ─── Squad & Batting Order ───────────────────────────────────────

  static orderSquad(squadIds: string[], players: Player[]): Player[] {
    const squadPlayers = squadIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    squadPlayers.sort((a, b) => {
       const getBatScore = (p: Player) => {
           let s = (p.stats?.batting || 0);
           if (p.role === 'Batsman' || p.role === 'Wicketkeeper') s += 50;
           if (p.role === 'All-rounder') s += 25;
           return s;
       };
       return getBatScore(b) - getBatScore(a);
    });
    return squadPlayers;
  }

  static getBowlerOrder(squadIds: string[], players: Player[]): Player[] {
    const squadPlayers = squadIds.map(id => players.find(p => p.id === id)).filter(Boolean) as Player[];
    squadPlayers.sort((a, b) => {
       const getBowlScore = (p: Player) => {
           let s = (p.stats?.bowling || 0);
           if (p.role === 'Bowler') s += 50;
           if (p.role === 'All-rounder') s += 25;
           return s;
       };
       return getBowlScore(b) - getBowlScore(a);
    });
    return squadPlayers;
  }

  // ─── Innings Data Factory ────────────────────────────────────────

  static createEmptyInnings(battingTeamId: string, bowlingTeamId: string): InningsData {
    return {
      battingTeamId,
      bowlingTeamId,
      runs: 0,
      wickets: 0,
      overs: 0,
      balls: 0,
      batsmen: {},
      bowlers: {},
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      fallOfWickets: [],
      // IPL-specific
      isFreeHitPending: false,
      drsReviews: [],
      drsReviewsRemaining: this.MAX_DRS_REVIEWS,
      strategicTimeouts: [],
      currentPhase: PowerPlayPhase.MANDATORY,
    };
  }

  static getPlayerStats(playerId: string, record: Record<string, PlayerMatchStats>): PlayerMatchStats {
    if (!record[playerId]) {
      record[playerId] = {
        playerId,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        overs: 0,
        runsConceded: 0,
        dots: 0,
        bouncersThisOver: 0,
        oversBowled: 0,
        legalBallsThisOver: 0,
      };
    }
    return record[playerId];
  }
}
