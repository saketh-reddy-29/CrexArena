import { TestMatchState } from './testTypes';
import { TEST_RULES } from './testRules';
import { followOnEngine } from './followOnEngine';
import { declarationEngine } from './declarationEngine';
import { newBallEngine } from './newBallEngine';
import { pitchDeteriorationEngine } from './pitchDeteriorationEngine';
import { ballAgeEngine } from './ballAgeEngine';

export class TestInningsEngine {
  public simulateOver(state: TestMatchState): TestMatchState {
    let currentState = { ...state };
    
    // Simulate 6 valid deliveries
    for (let ball = 1; ball <= 6; ball++) {
      currentState.balls++;
      
      // Simple mock for run scoring / wicket (Will be replaced by delivery engine logic)
      if (Math.random() < 0.03) {
        currentState.wickets++;
      } else {
        currentState.score += Math.floor(Math.random() * 4);
      }
      
      if (currentState.currentBattingTeam === currentState.team1Name) {
        currentState.team1Score = currentState.score;
      } else {
        currentState.team2Score = currentState.score;
      }
      
      currentState = ballAgeEngine.updateBallAge(currentState);
      currentState = pitchDeteriorationEngine.deterioratePitch(currentState);
      
      if (currentState.wickets >= TEST_RULES.maxWickets) {
        currentState.inningsStatus = "ALL_OUT";
        break;
      }
      
      currentState = declarationEngine.checkDeclaration(currentState);
      if (currentState.inningsStatus === "DECLARED") {
        break;
      }
    }
    
    currentState.overs++;
    currentState = newBallEngine.checkNewBall(currentState);
    
    return currentState;
  }
  
  public startNextInnings(state: TestMatchState): TestMatchState {
    let currentState = { ...state };
    
    if (currentState.inningsNumber === 2 && currentState.inningsStatus === "ALL_OUT") {
      currentState = followOnEngine.checkFollowOn(currentState);
    }
    
    currentState.inningsNumber++;
    currentState.score = 0;
    currentState.wickets = 0;
    currentState.overs = 0;
    currentState.balls = 0;
    currentState.inningsStatus = "IN_PROGRESS";
    currentState.ball = { inningsBallAge: 0, oversSinceNewBall: 0, isNewBall: true };
    
    // Swap teams
    const temp = currentState.currentBattingTeam;
    currentState.currentBattingTeam = currentState.currentBowlingTeam;
    currentState.currentBowlingTeam = temp;
    
    if (currentState.inningsNumber === 4) {
       currentState.target = Math.abs(currentState.team1Score - currentState.team2Score) + 1;
    }
    
    return currentState;
  }
}

export const testInningsEngine = new TestInningsEngine();
