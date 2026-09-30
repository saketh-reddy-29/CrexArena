import { RulesEngine } from '../rules/RulesEngine';
import { MatchSituationEngine } from './MatchSituationEngine';

export class DeliveryEngine {
  private rules: RulesEngine;
  private situationEngine: MatchSituationEngine;

  constructor(rules: RulesEngine, situationEngine: MatchSituationEngine) {
    this.rules = rules;
    this.situationEngine = situationEngine;
  }

  simulateDelivery(context: any) {
    const { batter, bowler, inningsState, target, matchState } = context;
    
    // 1. Calculate Situation & Pressure
    const pressure = this.situationEngine.calculatePressure(context);
    const format = this.rules.getConfig().type;
    const maxOvers = this.rules.getMaxOvers();
    const matchMaxBalls = maxOvers ? maxOvers * 6 : Infinity;

    // 2. Base Abilities (Fallback to overall rating if deep attributes are missing)
    const batterRating = batter.rating || 50;
    const bowlerRating = bowler.rating || 50;
    
    const battingScore = batterRating; 
    const bowlingScore = bowlerRating;

    // 3. Advantage calculation
    const advantage = battingScore - bowlingScore; // e.g. -3 (Bowler has small advantage)

    // 4. Base Run Probabilities per format
    let outcomes: {runs: number, weight: number}[] = [];
    if (format === 'T20' || format === 'IPL') {
      outcomes = [
        { runs: 0, weight: 35 },
        { runs: 1, weight: 30 },
        { runs: 2, weight: 10 },
        { runs: 3, weight: 2 },
        { runs: 4, weight: 17 },
        { runs: 6, weight: 6 }
      ];
    } else if (format === 'ODI') {
      outcomes = [
        { runs: 0, weight: 42 },
        { runs: 1, weight: 32 },
        { runs: 2, weight: 10 },
        { runs: 3, weight: 1 },
        { runs: 4, weight: 13 },
        { runs: 6, weight: 2 }
      ];
    } else { // TEST
      outcomes = [
        { runs: 0, weight: 50 },
        { runs: 1, weight: 30 },
        { runs: 2, weight: 7 },
        { runs: 3, weight: 1 },
        { runs: 4, weight: 11 },
        { runs: 6, weight: 0.2 }
      ];
    }

    let pWicket = 0.03;
    let pExtra = 0.03;

    // 5. Adjust run weights
    const phase = format === 'TEST' ? this.getTestPhase(inningsState.balls / 6) : 'MIDDLE';
    outcomes = this.adjustRunWeights(outcomes, batter, bowler, format, phase);

    // 6. Adjust wicket probability based on match situation and players
    const batterFactor = (battingScore - 50) / 50; 
    const bowlingFactor = (bowlingScore - 50) / 50; 
    
    pWicket -= batterFactor * 0.005;
    pWicket += bowlingFactor * 0.015;

    let attackingIntent = 0;
    if (format === 'T20' || format === 'IPL') {
      pWicket += 0.02;
      if (inningsState.balls > matchMaxBalls * 0.75) {
        attackingIntent += 0.10; // Death overs
      }
    } else if (format === 'TEST') {
      pWicket -= 0.01;
      const ballsFaced = batter.ballsFaced || 0;
      const settledness = Math.min(1, ballsFaced * 0.03);
      if (phase === 'NEW_BALL') pWicket += 0.015;
      pWicket *= (1 - (settledness * 0.25));
      if (ballsFaced > 150) pWicket += 0.015;
    }

    if (target) {
        const oversRemaining = (matchMaxBalls - inningsState.balls) / 6;
        const runsRequired = target - inningsState.runs;
        if (oversRemaining > 0) {
            const requiredRunRate = runsRequired / oversRemaining;
            if (requiredRunRate > 6) {
                attackingIntent += (requiredRunRate - 6) * 0.02;
            }
        }
    }

    if (attackingIntent > 0) {
        pWicket += attackingIntent * 0.10;
        // Increase 4 and 6 weights artificially based on intent
        const four = outcomes.find(o => o.runs === 4);
        const six = outcomes.find(o => o.runs === 6);
        if (four) four.weight *= (1 + attackingIntent * 1.5);
        if (six) six.weight *= (1 + attackingIntent * 2.0);
    }

    // 7. Cap probabilities
    pWicket = Math.max(0.01, Math.min(0.15, pWicket)); 
    this.capSixProbability(outcomes, format);

    let isWicket = false;
    let runs = 0;
    let extras = 0;

    // 8. Check Extras First
    const extraRoll = Math.random();
    if (extraRoll < pExtra) {
        extras = 1;
        return { runs: 0, extras: 1, isWicket: false, batterId: batter.id, bowlerId: bowler.id };
    }

    // 9. Check Wicket
    const wicketRoll = Math.random();
    if (wicketRoll < pWicket) {
        isWicket = true;
    } else {
        // 10. Select Run Outcome
        const outcome = this.selectWeightedOutcome(outcomes);
        runs = outcome.runs;
    }

    return {
      runs,
      extras,
      isWicket,
      wicketType: isWicket ? this.determineWicketType(bowler) : null,
      batterId: batter.id,
      bowlerId: bowler.id
    };
  }

  private safeNumber(val: any, fallback: number): number {
    const num = Number(val);
    return Number.isFinite(num) && !Number.isNaN(num) ? num : fallback;
  }

  private adjustRunWeights(outcomes: {runs: number, weight: number}[], batter: any, bowler: any, format: string, phase: string) {
      const power = this.safeNumber(batter.attributes?.power ?? batter.power, 50);
      const aggression = this.safeNumber(batter.attributes?.aggression ?? batter.aggression, 50);
      const technique = this.safeNumber(batter.attributes?.technique ?? batter.technique, 50);
      
      const bowlingQuality = this.safeNumber(bowler.attributes?.bowlingRating ?? bowler.rating, 50);

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

      // Early Test/new-ball caution
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
