import { TestMatchState } from './testTypes';
import { TEST_RULES } from './testRules';

export class NewBallEngine {
  public checkNewBall(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    
    currentState.ball.oversSinceNewBall++;
    
    if (currentState.ball.oversSinceNewBall >= TEST_RULES.newBallAfterOvers) {
      // AI decision to take new ball
      const aiWantsNewBall = Math.random() > 0.1; // High chance
      if (aiWantsNewBall) {
        currentState.ball.isNewBall = true;
        currentState.ball.oversSinceNewBall = 0;
      }
    } else {
        currentState.ball.isNewBall = false;
    }
    
    return currentState;
  }
}

export const newBallEngine = new NewBallEngine();
