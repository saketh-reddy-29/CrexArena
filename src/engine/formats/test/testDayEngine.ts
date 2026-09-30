import { TestMatchState, TestSession } from './testTypes';
import { testSessionEngine } from './testSessionEngine';

export class TestDayEngine {
  public simulateDay(state: TestMatchState, deliveryEngine: any): TestMatchState {
    let currentState = { ...state };
    currentState.oversToday = 0;
    
    // Morning Session
    currentState.session = TestSession.MORNING;
    currentState = testSessionEngine.simulateSession(currentState, deliveryEngine);
    if (currentState.result !== "IN_PROGRESS") return currentState;
    
    // Afternoon Session
    currentState.session = TestSession.AFTERNOON;
    currentState = testSessionEngine.simulateSession(currentState, deliveryEngine);
    if (currentState.result !== "IN_PROGRESS") return currentState;
    
    // Evening Session
    currentState.session = TestSession.EVENING;
    currentState = testSessionEngine.simulateSession(currentState, deliveryEngine);
    
    return currentState;
  }
}

export const testDayEngine = new TestDayEngine();
