import { TestMatchState } from './testTypes';

export class BallAgeEngine {
  public updateBallAge(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    
    currentState.ball.inningsBallAge++;
    
    return currentState;
  }
}

export const ballAgeEngine = new BallAgeEngine();
