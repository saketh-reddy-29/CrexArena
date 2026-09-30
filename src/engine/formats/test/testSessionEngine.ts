import { TestMatchState } from './testTypes';
import { testInningsEngine } from './testInningsEngine';
import { TEST_RULES } from './testRules';
import { testResultEngine } from './testResultEngine';

export class TestSessionEngine {
  public simulateSession(state: TestMatchState, deliveryEngine: any): TestMatchState {
    let currentState = { ...state };
    const sessionOversTarget = TEST_RULES.minimumOversPerDay / 3;
    let oversThisSession = 0;
    
    while (oversThisSession < sessionOversTarget && currentState.result === "IN_PROGRESS") {
      currentState = testInningsEngine.simulateOver(currentState, deliveryEngine);
      oversThisSession++;
      currentState.oversToday++;
      
      currentState = testResultEngine.checkMatchResult(currentState);
      if (currentState.inningsStatus === "ALL_OUT" || currentState.inningsStatus === "DECLARED" || currentState.inningsStatus === "COMPLETED") {
        // Transition to next innings
        currentState = testInningsEngine.startNextInnings(currentState);
      }
    }
    
    return currentState;
  }
}

export const testSessionEngine = new TestSessionEngine();
