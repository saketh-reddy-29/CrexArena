import { CricketEngine } from "../core/cricketEngine";
import { Player, Team } from "../core/types";
import { BowlerProfile } from "../ai/bowlingSelectionAI";

// Dummy Teams
const teamA: Team = { id: "IND", name: "India", abbreviation: "IND" };
const teamB: Team = { id: "AUS", name: "Australia", abbreviation: "AUS" };

// Dummy Players
const batter1: Player = {
  id: "P1", name: "Virat Kohli", battingRating: 95, bowlingRating: 20, 
  fatigue: 0, form: 90, isLeftHandedBat: false, bowlingStyle: "Medium"
};
const batter2: Player = {
  id: "P2", name: "Rohit Sharma", battingRating: 92, bowlingRating: 15, 
  fatigue: 0, form: 85, isLeftHandedBat: false, bowlingStyle: "Off Spin"
};
const bowler1: Player = {
  id: "P3", name: "Pat Cummins", battingRating: 40, bowlingRating: 96, 
  fatigue: 0, form: 95, isLeftHandedBat: false, bowlingStyle: "Fast"
};

const bowlerProfile: BowlerProfile = {
  playerId: bowler1.id, bowlingRating: 96,
  pace: 95, swing: 85, seam: 90, spin: 0, accuracy: 92,
  powerplay: 90, middleOvers: 85, death: 90,
  againstLeftHander: 90, againstRightHander: 92,
  wicketTaking: 95, economy: 85, fatigue: 0,
  oversBowled: 0, oversRemaining: 20
};

// Initialize Engine
const engine = new CricketEngine("TEST");
const context = engine.initContext(teamA, teamB, batter1, batter2, bowler1);

console.log("=========================================");
console.log(`Starting ${engine.rules.format} Match: ${teamA.name} vs ${teamB.name}`);
console.log("=========================================\n");

// Simulate 5 Overs
const totalBallsToSimulate = 5 * 6;

for (let i = 1; i <= totalBallsToSimulate; i++) {
  const overNumber = Math.floor(context.ball / 6);
  const ballInOver = context.ball % 6 + 1;
  
  const outcome = engine.simulateDelivery(context, [bowlerProfile]);
  
  // Basic Commentary String
  let commentary = `${context.over}.${context.ball} - ${context.bowler.name} to ${context.striker.name}: `;
  if (outcome === "WICKET") {
    commentary += `OUT! Brilliant delivery!`;
  } else if (outcome === "4") {
    commentary += `FOUR! Smashing shot through the covers.`;
  } else if (outcome === "6") {
    commentary += `SIX! Massive hit into the stands!`;
  } else if (outcome === "0") {
    commentary += `Dot ball. Defended solidly.`;
  } else {
    commentary += `${outcome} run(s).`;
  }
  
  console.log(commentary);
  
  // Rotate strike (simplified logic, usually you need to handle strike rotation properly)
  if (outcome === "1" || outcome === "3" || (context.ball === 0 && (outcome === "0" || outcome === "2" || outcome === "4" || outcome === "6"))) {
     const temp = context.striker;
     context.striker = context.nonStriker;
     context.nonStriker = temp;
  }

  // Check all out
  if (context.wickets >= 10) {
      console.log("\nALL OUT!");
      break;
  }
}

console.log("\n=========================================");
console.log(`End of Session Score: ${teamA.abbreviation} ${context.score}/${context.wickets}`);
console.log(`Overs: ${context.over}.${context.ball}`);
console.log(`Run Rate: ${context.currentRunRate.toFixed(2)}`);
console.log(`Pitch Deterioration: ${context.pitch.deterioration.toFixed(2)}%`);
console.log("=========================================");
