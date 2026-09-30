import { TestMatchState } from './testTypes';
import { TEST_RULES } from './testRules';

export class FollowOnEngine {
  public checkFollowOn(state: TestMatchState): TestMatchState {
    const currentState = { ...state };
    
    const lead = Math.abs(currentState.team1Score - currentState.team2Score);
    if (lead >= TEST_RULES.followOnRuns) {
      // AI decision to enforce follow on
      const aiWantsFollowOn = Math.random() > 0.2; // 80% chance for now
      if (aiWantsFollowOn) {
        // We will swap teams in `startNextInnings` anyway, so to force follow on (same team bats again), 
        // we swap them here so when `startNextInnings` swaps again, it's the same team.
        const temp = currentState.currentBattingTeam;
        currentState.currentBattingTeam = currentState.currentBowlingTeam;
        currentState.currentBowlingTeam = temp;
      }
    }
    
    return currentState;
  }
}

export const followOnEngine = new FollowOnEngine();
