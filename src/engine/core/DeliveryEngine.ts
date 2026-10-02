import { RulesEngine } from '../rules/RulesEngine';
import { MatchSituationEngine } from './MatchSituationEngine';
import { testBattingAI } from '../formats/test/testBattingAI';
import { formatStrategyEngine, FormatStrategyDecision } from '../formats/FormatStrategyEngine';
import { clampProbability } from '../rules/bowlerEligibility';

export class DeliveryEngine {
  private rules: RulesEngine;
  private situationEngine: MatchSituationEngine;

  constructor(rules: RulesEngine, situationEngine: MatchSituationEngine) {
    this.rules = rules;
    this.situationEngine = situationEngine;
  }

  simulateDelivery(context: any) {
    const { batter, bowler, inningsState, target, matchState } = context;
    const format = (this.rules.getConfig().type || 'T20').toUpperCase();
    const maxOvers = this.rules.getMaxOvers();
    const matchMaxBalls = maxOvers ? maxOvers * 6 : Infinity;

    // 1. Evaluate Format-Specific Strategy (T20, ODI, Test)
    const strategyDecision: FormatStrategyDecision = formatStrategyEngine.evaluate({
      format,
      innings: matchState?.currentInnings || inningsState?.innings || 1,
      balls: inningsState?.balls || 0,
      overs: Math.floor((inningsState?.balls || 0) / 6),
      maxOvers: maxOvers || undefined,
      runs: inningsState?.runs || 0,
      wickets: inningsState?.wickets || 0,
      target: target || null,
      batter: {
        id: batter.id,
        name: batter.name,
        rating: batter.rating || 50,
        battingRating: batter.battingRating || batter.rating || 50,
        power: batter.attributes?.power ?? batter.power ?? 50,
        aggression: batter.attributes?.aggression ?? batter.aggression ?? 50,
        technique: batter.attributes?.technique ?? batter.technique ?? 50,
        ballsFaced: batter.ballsFaced || 0,
        runsScored: batter.runs || 0,
        form: batter.form || 100,
        attributes: batter.attributes,
      },
      bowler: {
        id: bowler.id,
        name: bowler.name,
        rating: bowler.rating || 50,
        bowlingRating: bowler.bowlingRating || bowler.rating || 50,
        form: bowler.form || 100,
        attributes: bowler.attributes,
      },
      partnership: inningsState?.partnership,
      recentDots: inningsState?.recentDots || 0,
    });

    // 2. Base Abilities
    const batterRating = batter.rating || 50;
    const bowlerRating = bowler.rating || 50;
    const battingScore = batterRating;
    const bowlingScore = bowlerRating;

    // 3. Outcomes from Strategy Decision
    let outcomes = strategyDecision.baseRunWeights.map(o => ({ ...o }));

    if (format === 'TEST') {
      const intentScore = testBattingAI.decideIntent(matchState, batter, bowler);
      context.intentScore = intentScore;
      outcomes = testBattingAI.getShotSelection(intentScore);
    }

    let pWicket = strategyDecision.baseWicketProbability;
    let pExtra = strategyDecision.baseExtraProbability;

    // 4. Adjust run weights with player attributes
    const phase = format === 'TEST' ? this.getTestPhase((inningsState?.balls || 0) / 6) : 'MIDDLE';
    outcomes = this.adjustRunWeights(outcomes, batter, bowler, format, phase, context.intentScore);

    // 5. Adjust wicket probability based on player quality & risk tolerance
    const batterFactor = (battingScore - 50) / 50;
    const bowlingFactor = (bowlingScore - 50) / 50;

    pWicket -= batterFactor * 0.005;
    pWicket += bowlingFactor * 0.015;

    // Risk tolerance and situational aggression scaling
    let attackingIntent = 0;
    if (format === 'T20' || format === 'IPL') {
      if (inningsState?.balls > matchMaxBalls * 0.75) {
        attackingIntent += 0.10; // Death overs
      }
      if (strategyDecision.riskTolerance > 0.70) {
        attackingIntent += (strategyDecision.riskTolerance - 0.70) * 0.25;
      }
    } else if (format === 'TEST') {
      const ballsFaced = batter.ballsFaced || 0;
      const settledness = Math.min(1, ballsFaced * 0.03);
      if (phase === 'NEW_BALL') pWicket += 0.015;
      pWicket *= (1 - (settledness * 0.25));
      if (ballsFaced > 150) pWicket += 0.015;
    } else if (format === 'ODI') {
      if (strategyDecision.riskTolerance > 0.60) {
        attackingIntent += (strategyDecision.riskTolerance - 0.60) * 0.20;
      }
    }

    if (target) {
      const oversRemaining = (matchMaxBalls - (inningsState?.balls || 0)) / 6;
      const runsRequired = target - (inningsState?.runs || 0);
      if (oversRemaining > 0) {
        const requiredRunRate = runsRequired / oversRemaining;
        if (requiredRunRate > 6) {
          attackingIntent += (requiredRunRate - 6) * 0.02;
        }
      }
    }

    if (attackingIntent > 0) {
      pWicket += attackingIntent * 0.10;
      const four = outcomes.find(o => o.runs === 4);
      const six = outcomes.find(o => o.runs === 6);
      if (four) four.weight *= (1 + attackingIntent * 1.5);
      if (six) six.weight *= (1 + attackingIntent * 2.0);
    }

    // 6. Cap probabilities per format
    const maxWicketProb = format === 'TEST' ? 0.045 : format === 'ODI' ? 0.055 : 0.085;
    const minWicketProb = format === 'TEST' ? 0.005 : format === 'ODI' ? 0.008 : 0.010;
    pWicket = clampProbability(Math.max(minWicketProb, Math.min(maxWicketProb, pWicket)));
    this.capSixProbability(outcomes, format);

    let isWicket = false;
    let runs = 0;
    let extras = 0;

    // 7. Check Extras First
    const extraRoll = Math.random();
    if (extraRoll < pExtra) {
      extras = 1;
      return {
        runs: 0,
        extras: 1,
        isWicket: false,
        batterId: batter.id,
        bowlerId: bowler.id,
        strategy: strategyDecision,
      };
    }

    // 8. Check Wicket
    const wicketRoll = Math.random();
    if (wicketRoll < pWicket) {
      isWicket = true;
    } else {
      // 9. Select Run Outcome
      const outcome = this.selectWeightedOutcome(outcomes);
      runs = outcome.runs;
    }

    return {
      runs,
      extras,
      isWicket,
      wicketType: isWicket ? this.determineWicketType(bowler) : null,
      batterId: batter.id,
      bowlerId: bowler.id,
      strategy: strategyDecision,
    };
  }

  private safeNumber(val: any, fallback: number): number {
    const num = Number(val);
    return Number.isFinite(num) && !Number.isNaN(num) ? num : fallback;
  }

  private adjustRunWeights(outcomes: {runs: number, weight: number}[], batter: any, bowler: any, format: string, phase: string, intentScore?: number) {
    let power = this.safeNumber(batter.attributes?.power ?? batter.power, 50);
    const aggression = this.safeNumber(batter.attributes?.aggression ?? batter.aggression, 50);
    const technique = this.safeNumber(batter.attributes?.technique ?? batter.technique, 50);
    const bowlingQuality = this.safeNumber(bowler.attributes?.bowlingRating ?? bowler.rating, 50);

    if (format === "TEST" && intentScore !== undefined) {
      const intentMultiplier = Math.max(0.1, intentScore / 50);
      power = power * intentMultiplier;
    }

    const six = outcomes.find(o => o.runs === 6);
    const four = outcomes.find(o => o.runs === 4);
    if (!six || !four) return outcomes;

    let sixMultiplier = 1;
    sixMultiplier += (power - 50) / 150;
    sixMultiplier += (aggression - 50) / 200;
    sixMultiplier -= (bowlingQuality - 50) / 250;

    if (format === "TEST") {
      sixMultiplier *= 0.20;
    } else if (format === "ODI") {
      sixMultiplier *= 0.65;
    } else if (format === "T20" || format === "IPL") {
      sixMultiplier *= 1.20;
    }

    if (format === "TEST" && phase === "NEW_BALL") {
      sixMultiplier *= 0.35;
    }

    six.weight = Math.max(0.01, six.weight * sixMultiplier);
    four.weight *= 1 + (technique - 50) / 300;

    return outcomes;
  }

  private capSixProbability(outcomes: {runs: number, weight: number}[], format: string) {
    const six = outcomes.find(o => o.runs === 6);
    if (!six) return;

    if (format === "TEST") six.weight = Math.min(six.weight, 0.5);
    else if (format === "ODI") six.weight = Math.min(six.weight, 3);
    else if (format === "T20" || format === "IPL") six.weight = Math.min(six.weight, 8);
  }

  private selectWeightedOutcome(outcomes: {runs: number, weight: number}[]) {
    const valid = outcomes.filter(o => Number.isFinite(o.weight) && o.weight > 0);
    if (valid.length === 0) {
      throw new Error("No valid run outcomes");
    }

    const totalWeight = valid.reduce((sum, o) => sum + o.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const outcome of valid) {
      roll -= outcome.weight;
      if (roll <= 0) return outcome;
    }
    return valid[0];
  }

  private determineWicketType(bowler: any) {
    const rand = Math.random();
    if (rand < 0.20) return 'BOWLED';
    if (rand < 0.35) return 'LBW';
    if (rand < 0.85) return 'CAUGHT';
    if (rand < 0.90) return 'RUN_OUT';
    return 'STUMPED';
  }

  private getTestPhase(overs: number) {
    if (overs < 10) return "NEW_BALL";
    if (overs < 30) return "SETTLING";
    if (overs < 70) return "MIDDLE";
    return "OLD_BALL";
  }
}
