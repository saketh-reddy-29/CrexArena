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
    const maxOvers = this.rules.getMaxOvers() || 50;
    const matchMaxBalls = maxOvers * 6;

    // 2. Base Abilities (Fallback to overall rating if deep attributes are missing)
    const batterRating = batter.rating || 50;
    const bowlerRating = bowler.rating || 50;
    
    const battingScore = batterRating; 
    const bowlingScore = bowlerRating;

    // 3. Advantage calculation
    const advantage = battingScore - bowlingScore; // e.g. -3 (Bowler has small advantage)

    // 4. Base Run Probabilities
    let pDot = 0.35;
    let pOne = 0.30;
    let pTwo = 0.08;
    let pThree = 0.01;
    let pFour = 0.15;
    let pSix = 0.05;
    let pWicket = 0.03;
    let pExtra = 0.03;

    // 5. Batter quality modifies distribution
    const batterFactor = (battingScore - 50) / 50; // -1 to +1
    pDot -= batterFactor * 0.04;
    pOne += batterFactor * 0.015;
    pTwo += batterFactor * 0.01;
    pFour += batterFactor * 0.02;
    pSix += batterFactor * 0.01;
    pWicket -= batterFactor * 0.005;

    // 6. Bowler quality modifies it
    const bowlingFactor = (bowlingScore - 50) / 50; // -1 to +1
    pDot += bowlingFactor * 0.04;
    pFour -= bowlingFactor * 0.02;
    pSix -= bowlingFactor * 0.01;
    pWicket += bowlingFactor * 0.015;

    // 7. Format modifiers
    let attackingIntent = 0;
    
    if (format === 'T20' || format === 'IPL') {
      pFour += 0.05;
      pSix += 0.05;
      pWicket += 0.02;
      pDot -= 0.05;
      
      // Situation modifiers for short format
      if (inningsState.balls > matchMaxBalls * 0.75) {
        attackingIntent += 0.10; // Death overs
      }
    } else if (format === 'ODI') {
      pOne += 0.05;
      pTwo += 0.02;
    } else if (format === 'TEST') {
      pDot += 0.15;
      pOne -= 0.05;
      pFour -= 0.05;
      pSix -= 0.04;
      pWicket -= 0.01;
      
      // Fatigue in tests
      if (batter.ballsFaced > 150) {
          pWicket += 0.01;
      }
    }

    // 8. Match Situation Intent
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
        pFour += attackingIntent * 0.15;
        pSix += attackingIntent * 0.10;
        pWicket += attackingIntent * 0.10;
        pDot -= attackingIntent * 0.10;
    }

    // 9. Normalize probabilities
    pWicket = Math.max(0.01, Math.min(0.15, pWicket)); // Cap wicket probability
    
    let isWicket = false;
    let runs = 0;
    let extras = 0;

    // 10. Check Extras First
    const extraRoll = Math.random();
    if (extraRoll < pExtra) {
        extras = 1;
        // Wides/NBs don't count as a legal ball in the UI usually, but we handle score here.
        return { runs: 0, extras: 1, isWicket: false, batterId: batter.id, bowlerId: bowler.id };
    }

    // 11. Check Wicket
    const wicketRoll = Math.random();
    if (wicketRoll < pWicket) {
        isWicket = true;
    } else {
        // 12. Run Model (Only if not a wicket)
        // Re-normalize run probabilities so they add up to 1
        const totalRunProb = Math.max(0.01, pDot + pOne + pTwo + pThree + pFour + pSix);
        const normDot = pDot / totalRunProb;
        const normOne = pOne / totalRunProb;
        const normTwo = pTwo / totalRunProb;
        const normThree = pThree / totalRunProb;
        const normFour = pFour / totalRunProb;
        // normSix is remainder

        const runRoll = Math.random();
        
        if (runRoll < normDot) runs = 0;
        else if (runRoll < normDot + normOne) runs = 1;
        else if (runRoll < normDot + normOne + normTwo) runs = 2;
        else if (runRoll < normDot + normOne + normTwo + normThree) runs = 3;
        else if (runRoll < normDot + normOne + normTwo + normThree + normFour) runs = 4;
        else runs = 6;
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

  private determineWicketType(bowler: any) {
    const rand = Math.random();
    if (rand < 0.20) return 'BOWLED';
    if (rand < 0.35) return 'LBW';
    if (rand < 0.85) return 'CAUGHT';
    if (rand < 0.90) return 'RUN_OUT';
    return 'STUMPED';
  }
}
