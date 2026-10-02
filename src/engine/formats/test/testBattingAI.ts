import { TestMatchContext, BattingIntent } from './testTypes';
import { safeNumber, safeProbability } from '../../utils/safeMath';

export class TestBattingAI {
  /**
   * Calculates the exact BattingIntent enum and intent level (0-100) based on balls faced by the batter.
   * 0-5 balls: SURVIVAL
   * 6-15: SETTLING
   * 16-30: CONTROLLED
   * 31+: NORMAL / PLAYER DEPENDENT
   */
  public getBattingIntentCategory(ballsFaced: number): BattingIntent {
    if (ballsFaced <= 5) return 'SURVIVAL';
    if (ballsFaced <= 15) return 'SETTLING';
    if (ballsFaced <= 30) return 'CONTROLLED_ATTACK';
    return 'NORMAL';
  }

  /**
   * Calculates settledness (0 - 100) based on balls faced by batter.
   * 0 balls = 0, 5 balls = 15 (low), 15 balls = 45 (moderate), 30 balls = 75 (high), 50+ balls = 90-100 (very high).
   */
  public calculateSettledness(ballsFaced: number): number {
    if (ballsFaced <= 0) return 0;
    if (ballsFaced <= 5) return ballsFaced * 3; // 0 - 15
    if (ballsFaced <= 15) return 15 + ((ballsFaced - 5) * 3); // 15 - 45
    if (ballsFaced <= 30) return 45 + ((ballsFaced - 15) * 2); // 45 - 75
    if (ballsFaced <= 50) return 75 + ((ballsFaced - 30) * 0.75); // 75 - 90
    return Math.min(100, 90 + ((ballsFaced - 50) * 0.2)); // 90 - 100
  }

  public decideIntent(context: TestMatchContext, batter: any, bowler: any): number {
    const ballsFaced = safeNumber(context?.batterBallsFaced ?? batter?.ballsFaced, 0);
    const intentCategory = this.getBattingIntentCategory(ballsFaced);
    
    let intent = 50;
    
    // 1. Balls-faced based intent phases
    if (intentCategory === 'SURVIVAL') {
      intent = 10; // SURVIVAL: Leave outside off, defend good length, block, low risk
    } else if (intentCategory === 'SETTLING') {
      intent = 25; // SETTLING: Build familiarity, low risk singles, careful watch
    } else if (intentCategory === 'CONTROLLED_ATTACK') {
      intent = 40; // CONTROLLED: Normal test scoring, punish loose balls
    } else {
      intent = 50; // NORMAL / PLAYER DEPENDENT
    }

    // 2. Batter-Bowler Adaptation Memory modifier
    const memory = context?.bowlerSpellOvers !== undefined && batter?.testMemory ? batter.testMemory[bowler?.id] : null;
    if (memory) {
      const adaptation = safeNumber(memory.adaptationLevel, 0);
      intent += (adaptation * 0.1); // better adapted batter can play with more confidence
    }

    // 3. New ball modifier
    if (context?.ballAge !== undefined && context.ballAge < 10) {
      intent -= 15;
    }

    // 4. Bowler rating threat
    const bowlingRating = bowler?.bowlingRating || bowler?.rating || 50;
    if (bowlingRating > 85) {
      intent -= 10;
    }

    // 5. Match Situation in 4th innings
    if (context?.innings === 4 && context?.requiredRuns) {
      const runsRequired = context.requiredRuns;
      const oversRemaining = context.requiredOvers || 90;
      if (oversRemaining > 0) {
        const rrr = runsRequired / oversRemaining;
        if (rrr > 5) intent += 20;
        if (context.day === 5 && rrr > 4) intent += 25;
      }
    }
    
    // 6. Player Style modifiers
    const playerAggression = batter?.aggression || 50;
    intent += (playerAggression - 50) / 2;

    return Math.max(0, Math.min(100, intent));
  }
  
  public getShotSelection(intent: number): {runs: number, weight: number}[] {
    // Intent 0-10: Extreme survival (90-95% dots/leaves/blocks)
    // Intent 25: Settling (75-80% dots, 15% singles)
    // Intent 50: Normal test match (65% dots, 25% singles, 10% boundaries)
    // Intent 100: Attacking (ODI style attack)
    
    const leaveDefendWeight = Math.max(5, 88 - (intent * 0.65)); 
    const singleWeight = intent < 20 ? Math.max(2, intent * 0.3) : 15 + ((intent - 20) * 0.35); 
    const twoWeight = Math.max(1, intent * 0.1);
    const threeWeight = Math.max(0.2, intent * 0.02);
    const fourWeight = intent < 20 ? Math.max(0.1, intent * 0.04) : Math.max(1, (intent - 20) * 0.32);
    const sixWeight = intent > 70 ? (intent - 70) * 0.2 : 0;
    
    return [
      { runs: 0, weight: leaveDefendWeight },
      { runs: 1, weight: singleWeight },
      { runs: 2, weight: twoWeight },
      { runs: 3, weight: threeWeight },
      { runs: 4, weight: fourWeight },
      { runs: 6, weight: sixWeight }
    ];
  }
}

export const testBattingAI = new TestBattingAI();
