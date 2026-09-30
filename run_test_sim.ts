import { testInningsEngine } from './src/engine/formats/test/testInningsEngine';
import { TestMatchState, TestSession } from './src/engine/formats/test/testTypes';
import { TEST_RULES } from './src/engine/formats/test/testRules';

// Initialize a mock match state
let matchState: TestMatchState = {
  day: 1,
  session: TestSession.MORNING,
  inningsNumber: 1,
  inningsStatus: "IN_PROGRESS",
  score: 0,
  wickets: 0,
  overs: 0,
  balls: 0,
  timeRemaining: 5 * 6 * 2 * 60,
  oversToday: 0,
  weather: { condition: "SUNNY", lightLevel: 100 },
  pitch: { pace: 80, bounce: 80, seam: 80, swing: 75, spin: 40, deterioration: 0, roughness: 0 },
  ball: { inningsBallAge: 0, oversSinceNewBall: 0, isNewBall: true },
  result: "IN_PROGRESS",
  team1Score: 0,
  team2Score: 0,
  team1Name: "India",
  team2Name: "Australia",
  currentBattingTeam: "India",
  currentBowlingTeam: "Australia"
};

console.log("Starting Test Match: India vs Australia");
console.log("---------------------------------------");

for (let i = 1; i <= 10; i++) {
  const previousScore = matchState.score;
  const previousWickets = matchState.wickets;

  // Simulate one over
  matchState = testInningsEngine.simulateOver(matchState);
  
  const runsInOver = matchState.score - previousScore;
  const wicketsInOver = matchState.wickets - previousWickets;
  
  console.log(`Over ${matchState.overs}: ${runsInOver} runs, ${wicketsInOver} wickets | Score: ${matchState.score}/${matchState.wickets}`);
  
  if (matchState.inningsStatus === "ALL_OUT") {
      console.log("ALL OUT!");
      break;
  }
}

console.log("---------------------------------------");
console.log(`End of 10 Overs. Total Score: ${matchState.score}/${matchState.wickets}`);
