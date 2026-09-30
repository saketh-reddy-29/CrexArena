import { TestMatchState, TestResult } from './testTypes';
import { followOnEngine } from './followOnEngine';

export class TestResultEngine {
  public checkMatchResult(state: TestMatchState): TestMatchState {
    let currentState = { ...state };
    
    if (currentState.inningsNumber === 4 && currentState.target !== undefined) {
      if (currentState.score >= currentState.target) {
        currentState.result = currentState.currentBattingTeam === currentState.team1Name ? "TEAM_1_WIN" : "TEAM_2_WIN";
        return currentState;
      }
      
      if (currentState.wickets >= 10 && currentState.score < currentState.target - 1) {
        currentState.result = currentState.currentBowlingTeam === currentState.team1Name ? "TEAM_1_WIN" : "TEAM_2_WIN";
        return currentState;
      }
      
      if (currentState.wickets >= 10 && currentState.score === currentState.target - 1) {
        currentState.result = "TIE";
        return currentState;
      }
    }
    
    return currentState;
  }
}

export const testResultEngine = new TestResultEngine();
