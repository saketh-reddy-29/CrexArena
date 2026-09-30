import { TestMatchState, BattingIntent, TestMatchContext } from './testTypes';

export class TestBattingAI {
  public decideIntent(context: TestMatchContext, batter: any, bowler: any): number {
    let intent = 50;
    
    // New batter
    const ballsFaced = context.batterBallsFaced;
    if (ballsFaced < 10) {
      intent -= 25;
    } else if (ballsFaced < 30) {
      intent -= 10;
    } else if (ballsFaced > 100) {
      intent += 5;
    }

    // New ball
    if (context.ballAge < 10) {
      intent -= 15;
    }

    // Strong bowler
    const bowlingRating = bowler.bowlingRating || bowler.rating || 50;
    if (bowlingRating > 85) {
      intent -= 10;
    }

    // Good batting conditions
    if (context.pitchDeterioration < 0.2) {
      intent += 5;
    }

    // Match Situation
    if (context.innings === 4 && context.requiredRuns) {
      const runsRequired = context.requiredRuns;
      const oversRemaining = context.requiredOvers || 90;
      
      if (oversRemaining > 0) {
         const rrr = runsRequired / oversRemaining;
         if (rrr > 5) intent += 20;
         if (context.day === 5 && rrr > 4) intent += 25;
      }
    }
    
    // Player Style modifiers
    const playerAggression = batter.aggression || 50;
    intent += (playerAggression - 50) / 2; // scale by aggression

    return Math.max(0, Math.min(100, intent));
  }
  
  public getShotSelection(intent: number): {runs: number, weight: number}[] {
    // Intent 0: Extreme survival (95% dots)
    // Intent 50: Normal test match (70% dots, 20% singles, 8% boundaries)
    // Intent 100: ODI style attack
    
    const leaveDefendWeight = Math.max(5, 85 - intent * 0.6); 
    const singleWeight = intent < 40 ? Math.max(2, intent * 0.4) : 16 + (intent - 40) * 0.3; 
    const twoWeight = Math.max(1, intent * 0.1);
    const fourWeight = intent < 40 ? Math.max(0.2, intent * 0.05) : (intent - 30) * 0.3;
    const sixWeight = intent > 70 ? (intent - 70) * 0.2 : 0;
    
    return [
      { runs: 0, weight: leaveDefendWeight },
      { runs: 1, weight: singleWeight },
      { runs: 2, weight: twoWeight },
      { runs: 3, weight: Math.max(0.5, intent * 0.02) },
      { runs: 4, weight: fourWeight },
      { runs: 6, weight: sixWeight }
    ];
  }
}

export const testBattingAI = new TestBattingAI();
