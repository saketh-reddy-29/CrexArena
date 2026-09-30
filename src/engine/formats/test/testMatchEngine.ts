import { TestMatchState, TestResult } from './testTypes';
import { testDayEngine } from './testDayEngine';
import { testResultEngine } from './testResultEngine';

export class TestMatchEngine {
  public simulateMatch(initialState: TestMatchState) {
    let matchState = { ...initialState };
    
    while (matchState.result === "IN_PROGRESS" && matchState.day <= 5) {
      matchState = testDayEngine.simulateDay(matchState);
      
      // End of match check
      matchState = testResultEngine.checkMatchResult(matchState);
      
      if (matchState.result !== "IN_PROGRESS") {
        break;
      }
      
      matchState.day++;
    }
    
    // Draw condition if 5 days are over and no result
    if (matchState.result === "IN_PROGRESS") {
      matchState.result = "DRAW";
    }
    
    return matchState;
  }
}

export const testMatchEngine = new TestMatchEngine();
