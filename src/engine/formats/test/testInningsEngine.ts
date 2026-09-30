import { TestMatchState } from './testTypes';
import { TEST_RULES } from './testRules';
import { followOnEngine } from './followOnEngine';
import { declarationEngine } from './declarationEngine';
import { newBallEngine } from './newBallEngine';
import { pitchDeteriorationEngine } from './pitchDeteriorationEngine';
import { ballAgeEngine } from './ballAgeEngine';
import { testDeliveryEngine } from './TestDeliveryEngine';
import { TestMatchContext, BattingIntent } from './testTypes';

export class TestInningsEngine {
  public simulateOver(state: TestMatchState): TestMatchState {
    let currentState = { ...state };
    
    // Simulate 6 valid deliveries
    let overString = "";
    for (let ball = 1; ball <= 6; ball++) {
      currentState.balls++;
      
      const batterMock = {
          id: "batter_mock",
          technique: 85, aggression: 70, ballsFaced: currentState.balls
      };
      const bowlerMock = {
          id: "bowler_mock",
          bowlingRating: 85
      };

      const requiredRuns = currentState.target ? currentState.target - currentState.score : undefined;
      const requiredOvers = currentState.target ? (currentState.timeRemaining / 6) : undefined;

      const matchContext: TestMatchContext = {
          day: currentState.day,
          session: currentState.session,
          innings: currentState.inningsNumber,
          score: currentState.score,
          wickets: currentState.wickets,
          overs: currentState.overs,
          balls: currentState.balls,
          batterBallsFaced: batterMock.ballsFaced,
          batterSettledness: Math.min(100, batterMock.ballsFaced),
          ballAge: currentState.ball.inningsBallAge,
          pitchCondition: currentState.pitch.seam,
          pitchDeterioration: currentState.pitch.deterioration,
          bowlerSpellOvers: 2,
          bowlerFatigue: 10,
          batterFatigue: 5,
          batterConcentration: Math.min(100, batterMock.ballsFaced * 2),
          requiredRuns,
          requiredOvers,
          battingIntent: "NORMAL" // Will be derived properly in the actual flow or updated dynamically
      };

      const outcome = testDeliveryEngine.simulateDelivery(matchContext, batterMock, bowlerMock);

      if (outcome.isWicket) {
        currentState.wickets++;
        overString += "W ";
      } else {
        currentState.score += outcome.runs + (outcome.extras || 0);
        overString += `${outcome.runs} `;
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
    
    console.log(`Over ${currentState.overs + 1}: ${overString.trim()} => Score: ${currentState.score}/${currentState.wickets}`);
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
