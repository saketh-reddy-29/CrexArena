import { ODIMatchPlaybackController } from './src/engine/formats/odi/ODIMatchPlaybackController';
import { TestMatchPlaybackController } from './src/engine/formats/test/TestMatchPlaybackController';
import { Player } from './src/types/common';

const createSquad = (teamPrefix: string, teamName: string): Player[] => {
  const names = teamPrefix === 'ind'
    ? ['Rohit Sharma', 'Shubman Gill', 'Virat Kohli', 'Shreyas Iyer', 'KL Rahul', 'Hardik Pandya', 'Ravindra Jadeja', 'Kuldeep Yadav', 'Jasprit Bumrah', 'Mohammed Shami', 'Mohammed Siraj']
    : ['Travis Head', 'David Warner', 'Mitchell Marsh', 'Steven Smith', 'Marnus Labuschagne', 'Glenn Maxwell', 'Alex Carey', 'Pat Cummins', 'Mitchell Starc', 'Adam Zampa', 'Josh Hazlewood'];

  return names.map((name, i) => ({
    id: `${teamPrefix}-p${i + 1}`,
    name,
    role: i < 5 ? 'BATTER' : i < 7 ? 'ALL_ROUNDER' : i === 6 ? 'WICKETKEEPER' : 'BOWLER',
    rating: 85 + (i % 8),
    technique: 84 + (i % 8),
    aggression: 60 + (i % 25),
    bowlingRating: i >= 5 ? 88 : 40,
    bowlingStyle: i === 7 ? 'Left-arm Wrist Spin' : i === 9 ? 'Right-arm Leg Spin' : i === 6 ? 'Left-arm Orthodox' : 'Right-arm Fast',
    nationality: teamPrefix === 'ind' ? 'Indian' : 'Overseas',
    basePrice: 20000000,
    stats: {
      matches: 120,
      runs: 4500,
      wickets: 110,
      strikeRate: 92.5,
      economy: 4.9,
      average: 48.0,
      bowlingAverage: 24.5,
    },
  }));
};

async function runODIMatch() {
  console.log('\n====================================================================');
  console.log('🏏 SIMULATING FULL 50-OVER ODI MATCH: INDIA vs AUSTRALIA');
  console.log('====================================================================\n');

  const indSquad = createSquad('ind', 'India');
  const ausSquad = createSquad('aus', 'Australia');

  const team1 = { id: 'team-ind', name: 'India', shortName: 'IND', squad: indSquad };
  const team2 = { id: 'team-aus', name: 'Australia', shortName: 'AUS', squad: ausSquad };

  const odiController = new ODIMatchPlaybackController('odi-sim-1', team1, team2, team1.id);
  odiController.setFastSimulating(true);

  // Run ball by ball through both innings
  let ballCount = 0;
  while (!odiController.isMatchFinished() && ballCount < 600) {
    const delivery = await odiController.playNextBallManual();
    ballCount++;
    if (!delivery) break;

    // Print key moments & highlights
    if (delivery.wicket || delivery.runs >= 4 || delivery.ball === 6) {
      const summary = odiController.getSummary();
      const inn = summary.innings[summary.currentInningsIndex];
      const tag = delivery.wicket ? '💥 WICKET' : delivery.runs === 6 ? '🚀 SIX' : delivery.runs === 4 ? '✨ FOUR' : '📌 OVER';
      console.log(`[${delivery.phase.padEnd(12)}] Inn ${inn.inningsNumber} | Over ${delivery.ballDisplay.padEnd(5)} | ${delivery.striker.name.padEnd(15)} vs ${delivery.bowler.name.padEnd(15)} => ${tag.padEnd(10)} | Score: ${inn.score}/${inn.wickets}`);
    }
  }

  const finalSummary = odiController.getSummary();
  console.log('\n--------------------------------------------------------------------');
  console.log(`🏁 ODI MATCH RESULT: ${finalSummary.resultDescription}`);
  console.log('--------------------------------------------------------------------');

  finalSummary.innings.forEach((inn, idx) => {
    console.log(`\n📊 INNINGS ${idx + 1}: ${inn.battingTeamName} — ${inn.score}/${inn.wickets} (${inn.overs}.${inn.balls} ov)`);
    console.log('--------------------------------------------------------------------');
    console.log('BATTERS:');
    Object.values(inn.batters)
      .filter(b => b.balls > 0)
      .forEach(b => {
        console.log(`  ${b.name.padEnd(20)} ${b.runs.toString().padStart(3)} (${b.balls.toString().padStart(3)}b) ${b.fours}x4 ${b.sixes}x6  SR: ${b.strikeRate.toFixed(1)}  [${b.dismissalInfo}]`);
      });

    console.log('\nBOWLERS:');
    Object.values(inn.bowlers)
      .filter(bw => bw.balls > 0)
      .forEach(bw => {
        console.log(`  ${bw.name.padEnd(20)} ${bw.overs.toString().padStart(4)} ov  ${bw.maidens}m  ${bw.runs}r  ${bw.wickets}w  Econ: ${bw.economy.toFixed(2)}`);
      });

    if (inn.fallOfWickets.length > 0) {
      console.log('\nFALL OF WICKETS:');
      console.log('  ' + inn.fallOfWickets.map(f => `${f.wicketNumber}-${f.score} (${f.batterName}, ${f.over} ov)`).join(' | '));
    }
  });
}

async function runTestMatch() {
  console.log('\n\n====================================================================');
  console.log('🏏 SIMULATING FULL TEST MATCH: INDIA vs AUSTRALIA');
  console.log('====================================================================\n');

  const indSquad = createSquad('ind', 'India');
  const ausSquad = createSquad('aus', 'Australia');

  const team1 = { id: 'team-ind', name: 'India', shortName: 'IND', squad: indSquad };
  const team2 = { id: 'team-aus', name: 'Australia', shortName: 'AUS', squad: ausSquad };

  const testController = new TestMatchPlaybackController('test-sim-1', team1, team2, team1.id);
  testController.setFastSimulating(true);

  let deliveryCount = 0;
  while (!testController.isMatchFinished() && deliveryCount < 2700) { // Max ~450 overs
    const delivery = await testController.playNextBallManual();
    deliveryCount++;
    if (!delivery) break;

    // Log key deliveries
    if (delivery.wicket || delivery.runs === 4 || delivery.ball === 6) {
      const summary = testController.getSummary();
      const inn = summary.innings[summary.currentInningsIndex];
      const tag = delivery.wicket ? '💥 WICKET' : delivery.runs === 4 ? '✨ FOUR' : '📌 OVER';
      if (delivery.wicket || inn.legalBalls % 60 === 0) {
        console.log(`[Day ${summary.day} ${summary.session.padEnd(9)}] Inn ${summary.currentInningsIndex + 1} | Over ${delivery.ballDisplay.padEnd(5)} | ${delivery.striker.name.padEnd(15)} vs ${delivery.bowler.name.padEnd(15)} => ${tag.padEnd(10)} | Score: ${inn.score}/${inn.wickets}`);
      }
    }
  }

  const finalSummary = testController.getSummary();
  console.log('\n--------------------------------------------------------------------');
  console.log(`🏁 TEST MATCH RESULT: ${finalSummary.resultDescription}`);
  console.log('--------------------------------------------------------------------');

  finalSummary.innings.forEach((inn, idx) => {
    if (inn.legalBalls === 0 && inn.score === 0 && idx >= 2) return;
    console.log(`\n📊 INNINGS ${idx + 1}: ${inn.battingTeamName} — ${inn.score}/${inn.wickets} (${inn.overs}.${inn.balls} ov) [${inn.statusText}]`);
    console.log('--------------------------------------------------------------------');
    console.log('TOP BATTERS:');
    Object.values(inn.batters)
      .filter(b => b.balls > 0)
      .sort((a, b) => b.runs - a.runs)
      .slice(0, 5)
      .forEach(b => {
        console.log(`  ${b.name.padEnd(20)} ${b.runs.toString().padStart(3)} (${b.balls.toString().padStart(3)}b) ${b.fours}x4 ${b.sixes}x6  SR: ${b.strikeRate.toFixed(1)}  [${b.dismissalInfo}]`);
      });

    console.log('TOP BOWLERS:');
    Object.values(inn.bowlers)
      .filter(bw => bw.balls > 0)
      .sort((a, b) => b.wickets - a.wickets)
      .slice(0, 4)
      .forEach(bw => {
        console.log(`  ${bw.name.padEnd(20)} ${bw.overs.toString().padStart(4)} ov  ${bw.maidens}m  ${bw.runs}r  ${bw.wickets}w  Econ: ${bw.economy.toFixed(2)}`);
      });

    if (inn.fallOfWickets.length > 0) {
      console.log('FALL OF WICKETS:');
      console.log('  ' + inn.fallOfWickets.map(f => `${f.wicketNumber}-${f.score} (${f.batterName}, ${f.over} ov)`).join(' | '));
    }
  });
}

async function main() {
  await runODIMatch();
  await runTestMatch();
}

main().catch(console.error);
