import { TestMatchState } from './testTypes';

export class LastHourEngine {
  public checkLastHour(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    // Logic for last hour on day 5 minimum overs
    return currentState;
  }
}

export const lastHourEngine = new LastHourEngine();
