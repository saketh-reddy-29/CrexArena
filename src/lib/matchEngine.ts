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
import { getMatchFormatConfig } from '../engine/config/MatchFormatConfig';

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
    return getMatchFormatConfig(format).oversPerInnings;
  }
  static readonly BALLS_PER_OVER = 6;
  static getMaxOversPerBowler(format?: string): number {
    return getMatchFormatConfig(format).maxOversPerBowler;
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

  static clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  static safeNum(value: unknown, fallback: number = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private static chooseWeighted<T extends string | number>(weights: Array<[T, number]>): T {
    const total = weights.reduce((sum, [, weight]) => sum + (Number.isFinite(weight) ? Math.max(0, weight) : 0), 0);
    if (total <= 0) return weights[0][0]; // Safe fallback: first option (dot/safe), NEVER fall back to last index
    let roll = Math.random() * total;
    for (const [value, weight] of weights) {
      const w = Number.isFinite(weight) ? Math.max(0, weight) : 0;
      roll -= w;
      if (roll <= 0) return value;
    }
    return weights[0][0];
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
    // Unbiased natural context: no artificial 0.35x/0.6x post-wicket suppression,
    // and no artificial wicket spikes. Wickets emerge naturally from deliveries and matchups.
    return 1.0;
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
    extraIntent?: string,
    extraPlan?: any,
    extraContext?: any,
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

    // ── Attack intent & Batting Intent Resolution ──
    const effectiveIntent = (extraIntent as string) || (
      arenaFormat === 'TEST'
        ? (archetype === 'anchor' || batterBalls < 8 ? 'DEFENSIVE' : 'BALANCED')
        : (requiredRate > 12 || isDeathOvers)
          ? 'ACCELERATE'
          : (requiredRate > 9 || isPowerplay)
            ? 'CONTROLLED_ATTACK'
            : (wickets >= 6 && !isDeathOvers)
              ? 'DEFENSIVE'
              : 'NORMAL'
    );

    // ── Bounded Multipliers (Calibrated Model) ──
    const formatConfig = getMatchFormatConfig(arenaFormat);
    const baseWicketProb = formatConfig.baseWicketProbability;

    // Batter risk multiplier
    const batSkillMod = this.clamp(1.0 - (batterSkill - 70) / 140, 0.70, 1.30);
    const tempMod = this.clamp(1.0 - (temperament - 70) / 220, 0.85, 1.15);
    const formMod = this.clamp(1.0 - (form - 75) / 220, 0.85, 1.15);
    // Bounded settledness: new batter is slightly vulnerable (1.18x), settled batter has lower risk (0.82x)
    const settledMod = batterBalls >= 25 ? 0.82 : batterBalls >= 12 ? 0.90 : batterBalls >= 5 ? 1.00 : 1.18;
    const tailMod = archetype === 'tail' ? 1.35 : 1.0;
    const mBat = this.clamp(batSkillMod * tempMod * formMod * settledMod * tailMod, 0.55, 1.65);

    // Bowler threat multiplier
    const bowlSkillMod = this.clamp(1.0 + (bowlerSkill - 70) / 140, 0.70, 1.35);
    const bowlFormMod = this.clamp(1.0 + (bowlerForm - 75) / 220, 0.85, 1.15);
    const deathThreat = isDeathOvers && isPace ? this.clamp(1.0 + (deathBowling - 70) / 220, 0.90, 1.25) : 1.0;
    const mBowl = this.clamp(bowlSkillMod * bowlFormMod * deathThreat, 0.65, 1.45);

    // Matchup multiplier
    const mMatchup = this.clamp(1.0 - (matchupSkill - 70) / 200, 0.80, 1.20);

    // Pitch & conditions multiplier
    let mPitch = 1.0;
    if (pitchType === PitchType.SPIN && isSpin) mPitch += 0.15;
    if (pitchType === PitchType.PACE && isPace) mPitch += 0.12;
    if (pitchType === PitchType.SLOW) mPitch += 0.08;
    if (pitchType === PitchType.BATTING) mPitch -= 0.12;
    if (weather === WeatherCondition.CLOUDY && isPace && overs < 6) mPitch += 0.10;
    if (weather === WeatherCondition.DEW && !isPowerplay) mPitch -= 0.08;
    mPitch = this.clamp(mPitch, 0.78, 1.28);

    // Delivery quality & plan multiplier
    let mPlan = 1.0;
    if (extraPlan) {
      if (extraPlan.intent === 'ATTACKING' || extraPlan.intent === 'WICKET_TAKING') mPlan += 0.10;
      else if (extraPlan.intent === 'DEFENSIVE' || extraPlan.intent === 'CONTAINING') mPlan -= 0.10;
    }
    mPlan = this.clamp(mPlan, 0.75, 1.25);

    // Intent multiplier
    let mIntent = 1.0;
    switch (effectiveIntent) {
      case 'SURVIVAL':
        mIntent = 0.45;
        break;
      case 'DEFENSIVE':
        mIntent = 0.58;
        break;
      case 'SETTLING':
        mIntent = 0.78;
        break;
      case 'ROTATE_STRIKE':
      case 'ROTATE':
        mIntent = 0.88;
        break;
      case 'NORMAL':
      case 'BALANCED':
        mIntent = 1.00;
        break;
      case 'CONTROLLED_ATTACK':
      case 'AGGRESSIVE':
        mIntent = 1.35;
        break;
      case 'ACCELERATE':
      case 'ALL_OUT_ATTACK':
        mIntent = 1.80;
        break;
    }

    // Context adjustment
    let mContext = 1.0;
    if (requiredRate > 12) mContext += 0.15;
    else if (requiredRate > 9) mContext += 0.08;
    mContext = this.clamp(mContext, 0.85, 1.30);

    // ═══ SINGLE AUTHORITATIVE WICKET ROLL ═══
    let rawWicketProb = baseWicketProb * mBat * mBowl * mMatchup * mPitch * mPlan * mIntent * mContext;
    if (isFreeHit) {
      rawWicketProb = 0.002; // Free Hit: only rare run out
    }

    const minWicket = isFreeHit ? 0.001 : formatConfig.minWicketProbability;
    const maxWicket = isFreeHit ? 0.005 : formatConfig.maxWicketProbability;
    const finalWicketProb = this.clamp(rawWicketProb, minWicket, maxWicket);

    const isWicket = wickets < 10 && Math.random() < finalWicketProb;

    if (isWicket) {
      let wicketType: BallOutcome['wicketType'] = 'Caught';
      if (isFreeHit) {
        wicketType = 'Run Out';
      } else {
        const wicketRoll = Math.random();
        if (effectiveIntent === 'ACCELERATE' || effectiveIntent === 'ALL_OUT_ATTACK' || isDeathOvers) {
          wicketType = wicketRoll < 0.65 ? 'Caught' : wicketRoll < 0.85 ? 'Bowled' : 'Run Out';
        } else if (isSpin) {
          wicketType = wicketRoll < 0.40 ? 'Caught' : wicketRoll < 0.65 ? 'LBW' : wicketRoll < 0.85 ? 'Stumped' : 'Bowled';
        } else {
          wicketType = wicketRoll < 0.38 ? 'Caught' : wicketRoll < 0.58 ? 'Caught Behind' : wicketRoll < 0.82 ? 'Bowled' : 'LBW';
        }
      }

      let commentary = '';
      if (isFreeHit) {
        commentary = `RUN OUT on a Free Hit! ${batsman.name} took the risk for an extra run but the throw is accurate. Gone!`;
      } else if (wicketType === 'Caught') {
        commentary = effectiveIntent === 'ACCELERATE' || effectiveIntent === 'ALL_OUT_ATTACK'
          ? `OUT! ${batsman.name} tries to clear the rope, but ${bowler.name} has the field set perfectly. Taken in the deep!`
          : `OUT! ${bowler.name} induces the false stroke and ${batsman.name} is caught cleanly!`;
      } else if (wicketType === 'Caught Behind') {
        commentary = `Feather behind! ${bowler.name} finds just enough movement and ${batsman.name} is caught behind.`;
      } else if (wicketType === 'Bowled') {
        commentary = `BOWLED HIM! ${bowler.name} nails the line and length, shattering ${batsman.name}'s stumps!`;
      } else if (wicketType === 'LBW') {
        commentary = `Huge appeal — GIVEN! ${bowler.name} traps ${batsman.name} right in front of the stumps. Plumb LBW!`;
      } else if (wicketType === 'Stumped') {
        commentary = `Beaten in the flight and STUMPED! Lightning glovework. ${bowler.name} outfoxes ${batsman.name}.`;
      } else {
        commentary = `RUN OUT! Crisp fielding in the inner ring and ${batsman.name} is caught short of the crease!`;
      }

      return {
        runs: 0,
        isWicket: true,
        wicketType,
        isExtra: false,
        batsmanId: batsman.id,
        bowlerId: bowler.id,
        commentary,
        isFreeHit,
      };
    }

    // ═══ RUNS DISTRIBUTION (WHEN NOT A WICKET) ═══
    let { dot, one, two, three, four, six } = { ...formatConfig.baseRunDistribution };

    // Adjust base weights based on intent
    if (effectiveIntent === 'SURVIVAL' || effectiveIntent === 'DEFENSIVE') {
      dot = Math.round(dot * 1.30);
      one = Math.max(5, Math.round(one * 0.55));
      two = Math.max(1, Math.round(two * 0.4));
      three = Math.max(0.1, Math.round(three * 0.3));
      four = Math.max(0.5, Math.round(four * 0.25));
      six = Math.max(0.05, Math.round(six * 0.1));
    } else if (effectiveIntent === 'SETTLING') {
      dot = Math.round(dot * 1.12);
      one = Math.round(one * 0.90);
      four = Math.max(1, Math.round(four * 0.65));
      six = Math.max(0.1, Math.round(six * 0.35));
    } else if (effectiveIntent === 'ROTATE_STRIKE' || effectiveIntent === 'ROTATE') {
      dot = Math.max(12, Math.round(dot * 0.75));
      one = Math.round(one * 1.25);
      two = Math.round(two * 1.20);
      four = Math.max(1.5, Math.round(four * 0.70));
      six = Math.max(0.2, Math.round(six * 0.40));
    } else if (effectiveIntent === 'CONTROLLED_ATTACK' || effectiveIntent === 'AGGRESSIVE') {
      dot = Math.max(10, Math.round(dot * 0.65));
      one = Math.round(one * 0.85);
      four = Math.round(four * 1.55);
      six = Math.round(six * 1.65);
    } else if (effectiveIntent === 'ACCELERATE' || effectiveIntent === 'ALL_OUT_ATTACK') {
      dot = Math.max(8, Math.round(dot * 0.50));
      one = Math.round(one * 0.70);
      four = Math.round(four * 1.95);
      six = Math.round(six * 2.30);
    }

    // PowerPlay effects (fewer fielders deep -> slightly more boundaries)
    if (isPowerplay) {
      four += 3;
      six += 1;
      dot -= 3;
    }

    // Advantage edge
    const battingControl = this.clamp((batterSkill - bowlerSkill) / 100, -0.35, 0.35);
    dot -= battingControl * 8;
    four += battingControl * 6;
    six += battingControl * 4;

    if (isFreeHit) {
      four += 8;
      six += 6;
      dot = Math.max(8, dot - 12);
    }

    const outcome = this.chooseWeighted<number>([
      [0, Math.max(10, dot)],
      [1, Math.max(10, one)],
      [2, Math.max(2, two)],
      [3, Math.max(0.2, three)],
      [4, Math.max(2, four)],
      [6, Math.max(0.5, six)]
    ]);

    let commentary = '';
    if (outcome === 6) {
      commentary = isFreeHit
        ? `FREE HIT SIX! ${batsman.name} takes full toll and deposits it into the stands!`
        : isDeathOvers
          ? `${batsman.name} clears the front leg and LAUNCHES it for SIX! Towering hit!`
          : `${batsman.name} picks the length early and sends it sailing over the ropes for SIX!`;
    } else if (outcome === 4) {
      commentary = isFreeHit
        ? `FREE HIT FOUR! ${batsman.name} cashes in with a glorious drive through the covers!`
        : `${batsman.name} times it crisply through the gap, racing away for FOUR!`;
    } else if (outcome === 3) {
      commentary = `Superb running between the wickets! ${batsman.name} places it into the outfield and pushes hard for three.`;
    } else if (outcome === 2) {
      commentary = `${batsman.name} works it into space and scampers back for a comfortable couple.`;
    } else if (outcome === 1) {
      commentary = `${batsman.name} drops it into the ring and quickly rotates the strike.`;
    } else {
      commentary = isFreeHit
        ? `Dot ball on a Free Hit! Sharp bowling from ${bowler.name}.`
        : effectiveIntent === 'DEFENSIVE' || effectiveIntent === 'SURVIVAL'
          ? `${batsman.name} defends solidly right off the middle of the bat. Well played.`
          : `Tight line from ${bowler.name}, no run possible. Dot ball.`;
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
