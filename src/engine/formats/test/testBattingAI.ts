import { TestMatchState, BattingIntent } from './testTypes';

export class TestBattingAI {
  public decideIntent(state: TestMatchState, batter: any, bowler: any): number {
    let intent = 50;
    
    // New batter (mocking ballsFaced if not present)
    const ballsFaced = batter.ballsFaced || 0;
    if (ballsFaced < 10) {
      intent -= 25;
    } else if (ballsFaced < 30) {
      intent -= 10;
    } else if (ballsFaced > 100) {
      intent += 5;
    }

    // New ball
    if (state.ball.inningsBallAge < 10) {
      intent -= 15;
    }

    // Strong bowler
    const bowlingRating = bowler.bowlingRating || bowler.rating || 50;
    if (bowlingRating > 85) {
      intent -= 10;
    }

    // Good batting conditions (assuming deterioration means harder to bat)
    if (state.pitch.deterioration < 0.2) {
      intent += 5;
    }

    // Match Situation
    if (state.inningsNumber === 4 && state.target) {
      const runsRequired = state.target - state.score;
      const oversRemaining = state.timeRemaining / 6; // roughly 1 over = 6 mins approx, but let's just say max balls
      // We'll calculate simple required run rate
      if (oversRemaining > 0) {
         const rrr = runsRequired / oversRemaining;
         if (rrr > 5) intent += 20;
         if (state.day === 5 && rrr > 4) intent += 25;
      }
    }
    
    // Player Style modifiers
    const playerAggression = batter.aggression || 50;
    intent += (playerAggression - 50) / 2; // scale by aggression

    return Math.max(0, Math.min(100, intent));
  }
  
  public getShotSelection(intent: number): {runs: number, weight: number}[] {
    // Dynamically adjust run weights based on intent (0 to 100)
    // Intent 0: All defense/leave
    // Intent 50: Normal test match
    // Intent 100: T20 style attack
    
    const leaveDefendWeight = Math.max(5, 75 - intent * 0.7); // drops from 75 to 5
    const singleWeight = 10 + (intent < 50 ? intent * 0.4 : 20 - (intent - 50) * 0.1); 
    const twoWeight = Math.max(2, intent * 0.15);
    const fourWeight = Math.max(1, intent * 0.35);
    const sixWeight = intent > 60 ? (intent - 60) * 0.2 : 0;
    
    return [
      { runs: 0, weight: leaveDefendWeight },
      { runs: 1, weight: singleWeight },
      { runs: 2, weight: twoWeight },
      { runs: 3, weight: Math.max(1, intent * 0.05) },
      { runs: 4, weight: fourWeight },
      { runs: 6, weight: sixWeight }
    ];
  }
}

export const testBattingAI = new TestBattingAI();
