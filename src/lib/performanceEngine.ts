import { Player } from '../types/common';
import { PlayerMatchStats } from '../types/match';
import { ArenaFormat } from '../stores/useGameStore';

export interface PerformanceDelta {
  baseAbilityChange: number;
  formChange: number;
  newForm: number;
  newBaseAbility: number;
  updatedCareerStats: Player['careerStats'];
}

/**
 * The core engine that calculates how much a player's stats change after a match.
 * It uses very small increments (0.05 to 0.30) for realism, preventing sudden spikes.
 */
export function calculatePostMatchPerformance(
  player: Player,
  scorecard: PlayerMatchStats,
  format: ArenaFormat
): PerformanceDelta {
  
  let performanceScore = 50; // 0-100 scale

  // 1. Calculate Batting Performance
  if (scorecard.isOut || scorecard.runs > 0 || scorecard.balls > 0) {
    let batScore = 50;
    
    // Format-specific expectations
    let expectedRuns = 30;
    let expectedSR = 130;
    
    if (format === 'T20' || format === 'IPL') {
      expectedRuns = 25;
      expectedSR = 140;
    } else if (format === 'ODI') {
      expectedRuns = 40;
      expectedSR = 90;
    } else if (format === 'TEST') {
      expectedRuns = 50;
      expectedSR = 50;
    }

    const runsDelta = scorecard.runs - expectedRuns;
    const actualSR = scorecard.balls > 0 ? (scorecard.runs / scorecard.balls) * 100 : 0;
    const srDelta = actualSR - expectedSR;

    // Weight runs heavily, SR moderately
    batScore += (runsDelta * 0.8);
    
    // T20/IPL values SR more than TEST
    if (format !== 'TEST') {
      batScore += (srDelta * 0.2);
    }

    // Boundary bonus
    batScore += ((scorecard.fours * 2) + (scorecard.sixes * 4));
    
    performanceScore = batScore;
  }

  // 2. Calculate Bowling Performance
  if (scorecard.overs > 0) {
    let bowlScore = 50;
    
    let expectedEcon = 8.0;
    let expectedWickets = 1.5;
    
    if (format === 'T20' || format === 'IPL') {
      expectedEcon = 8.5;
      expectedWickets = 1.2;
    } else if (format === 'ODI') {
      expectedEcon = 5.5;
      expectedWickets = 1.5;
    } else if (format === 'TEST') {
      expectedEcon = 3.2;
      expectedWickets = 2.5;
    }

    const wicketsDelta = scorecard.wickets - expectedWickets;
    const actualEcon = scorecard.runsConceded / scorecard.overs;
    const econDelta = expectedEcon - actualEcon; // positive is good

    bowlScore += (wicketsDelta * 15);
    bowlScore += (econDelta * 5); // 1 run less than expected = +5 points

    // If they batted and bowled, average them, but weight bowling higher for bowlers
    if (scorecard.balls > 0) {
      if (player.role === 'All-rounder') {
        performanceScore = (performanceScore + bowlScore) / 2;
      } else if (player.role === 'Bowler') {
        performanceScore = (performanceScore * 0.2) + (bowlScore * 0.8);
      } else {
        performanceScore = (performanceScore * 0.8) + (bowlScore * 0.2);
      }
    } else {
      performanceScore = bowlScore;
    }
  }

  // Clamp performance score
  performanceScore = Math.max(0, Math.min(100, performanceScore));

  // 3. Map Performance to Rating Changes (Small increments)
  let baseAbilityChange = 0;
  let formChange = 0;

  if (performanceScore > 90) {        // Exceptional
    baseAbilityChange = 0.30;
    formChange = 8;
  } else if (performanceScore > 75) { // Excellent
    baseAbilityChange = 0.20;
    formChange = 5;
  } else if (performanceScore > 60) { // Good
    baseAbilityChange = 0.10;
    formChange = 3;
  } else if (performanceScore > 40) { // Normal
    baseAbilityChange = 0.00;
    formChange = -1;
  } else if (performanceScore > 25) { // Below Average
    baseAbilityChange = -0.05;
    formChange = -3;
  } else if (performanceScore > 10) { // Poor
    baseAbilityChange = -0.10;
    formChange = -5;
  } else {                            // Very Poor
    baseAbilityChange = -0.15;
    formChange = -8;
  }

  // 4. Update Stats safely (Floor and Ceiling)
  const currentBase = player.baseAbility || player.rating;
  const currentForm = player.form || 85;

  let newBaseAbility = currentBase + baseAbilityChange;
  let newForm = currentForm + formChange;

  // Limits
  newBaseAbility = Math.max(50, Math.min(99.9, newBaseAbility));
  newForm = Math.max(0, Math.min(100, newForm));

  // 5. Update Career Stats (Only increase)
  const oldCareer = player.careerStats || {
    matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0
  };

  const updatedCareerStats = {
    matches: oldCareer.matches + 1,
    runs: oldCareer.runs + (scorecard.runs || 0),
    wickets: oldCareer.wickets + (scorecard.wickets || 0),
    ballsFaced: oldCareer.ballsFaced + (scorecard.balls || 0),
    ballsBowled: oldCareer.ballsBowled + Math.floor(scorecard.overs) * 6 + ((scorecard.overs % 1) * 10), // e.g. 4.2 overs = 26 balls
    runsConceded: oldCareer.runsConceded + (scorecard.runsConceded || 0),
    dismissals: oldCareer.dismissals + (scorecard.isOut ? 1 : 0),
    catches: oldCareer.catches + 0, // Mock for now, match engine needs to track catches
  };

  return {
    baseAbilityChange,
    formChange,
    newForm,
    newBaseAbility,
    updatedCareerStats
  };
}
