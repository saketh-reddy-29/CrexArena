import { describe, it, expect } from 'vitest';
import { MatchEngine } from '../lib/matchEngine';
import { PitchType, WeatherCondition } from '../types/match';
import { Player } from '../types/common';

import { calculateEffectiveRating } from '../lib/ratingEngine';

const mockBatter: Player = {
  id: "batter-1",
  name: "Virat Kohli",
  role: "Batsman",
  nationality: "Indian",
  rating: 92,
  baseAbility: 92,
  form: 85,
  basePrice: 0,
  intendedTeamId: "IND",
  stats: { batting: 92, bowling: 10, fielding: 85 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

const mockBowler: Player = {
  id: "bowler-1",
  name: "Jasprit Bumrah",
  role: "Bowler",
  nationality: "Indian",
  rating: 95,
  baseAbility: 95,
  form: 90,
  basePrice: 0,
  intendedTeamId: "IND",
  stats: { batting: 10, bowling: 95, fielding: 70 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

describe("Engine Integrity and Safety", () => {
  it("does not produce NaN for calculated effective ratings", () => {
    const batEff = calculateEffectiveRating(mockBatter, 'T20');
    const bowlEff = calculateEffectiveRating(mockBowler, 'T20');
    
    expect(Number.isFinite(batEff.batting)).toBe(true);
    expect(Number.isFinite(bowlEff.bowling)).toBe(true);
  });

  it("simulateBall does not return NaN outcomes", () => {
    const result = MatchEngine.simulateBall(
      mockBatter, mockBowler, 10, 2, 8.5, PitchType.BALANCED, WeatherCondition.CLEAR,
      { runs: 10, balls: 5, dots: 1, boundaries: 2, sixes: 0 },
      { overs: 1, balls: 0, runsConceded: 5, wickets: 0, dots: 3, lastOverRuns: 5 },
      [], false, 0, 'T20'
    );
    expect(result).toBeDefined();
    expect(Number.isFinite(result.runs)).toBe(true);
    expect(result.isWicket !== undefined).toBe(true);
  });
});

describe("Statistical Engine Calibration", () => {
  it("produces a natural distribution of outcomes over 10,000 deliveries", () => {
    let wickets = 0;
    let runs = 0;
    let dots = 0;
    let boundaries = 0;

    for (let i = 0; i < 10000; i++) {
      const result = MatchEngine.simulateBall(
        mockBatter, mockBowler, Math.random() * 20, 2, 8.5, PitchType.BALANCED, WeatherCondition.CLEAR,
        { runs: 10, balls: 5, dots: 1, boundaries: 2, sixes: 0 },
        { overs: 1, balls: 0, runsConceded: 5, wickets: 0, dots: 3, lastOverRuns: 5 },
        [], false, 0, 'T20'
      );

      if (result.isWicket && !result.isExtra) {
        wickets++;
      }
      if (result.runs === 0 && !result.isExtra) {
        dots++;
      }
      if (result.runs === 4 || result.runs === 6) {
        boundaries++;
      }
      runs += result.runs;
    }

    const wicketRate = wickets / 10000;
    console.log({
      wickets,
      wicketRate,
      runs,
      dots,
      boundaries
    });

    // We want realistic wicket probabilities (2% to 15%)
    expect(wickets).toBeGreaterThan(100);
    expect(wickets).toBeLessThan(1500); 
    
    // Average run rate should be somewhat realistic (e.g. 6 to 10 an over -> 1 to 1.6 runs per ball)
    expect(runs).toBeGreaterThan(5000);
    expect(runs).toBeLessThan(20000);
  });
});

// Mock teams for full match simulations
const teamA = {
    id: "IND", name: "India", shortName: "IND", color: "#000", logoUrl: "",
    squad: [mockBatter.id, mockBowler.id, "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11"]
};

describe("Full Match Stability", () => {
  // We simulate 100 matches to ensure no infinite loops or crashes happen
  it("100 match simulation stability across formats", () => {
    // Generate dummy players for a full 11-man squad
    const fullSquadA: Player[] = Array.from({length: 11}).map((_, i) => ({
      ...mockBatter,
      id: `A-${i}`,
      name: `Player A${i}`,
      role: i < 6 ? 'Batsman' : (i < 8 ? 'All-rounder' : 'Bowler')
    }));
    const fullSquadB: Player[] = Array.from({length: 11}).map((_, i) => ({
      ...mockBowler,
      id: `B-${i}`,
      name: `Player B${i}`,
      role: i < 6 ? 'Batsman' : (i < 8 ? 'All-rounder' : 'Bowler')
    }));

    const players = [...fullSquadA, ...fullSquadB];
    const formats = ['T20', 'ODI'];

    for (const format of formats) {
        let completed = 0;
        for (let i = 0; i < 100; i++) {
            // Note: Since MatchEngine doesn't have a single "simulateMatch" function that loops 
            // automatically (the loop is in React state), we will manually drive the engine loop here
            // just to ensure it doesn't crash.
            let innings = MatchEngine.createEmptyInnings('IND', 'AUS');
            const maxBalls = MatchEngine.getOversPerMatch(format) * 6;
            
            while (innings.balls < maxBalls && innings.wickets < 10) {
               const ball = MatchEngine.simulateBall(
                   fullSquadA[innings.wickets], 
                   fullSquadB[8], // Just a fixed bowler for the test loop
                   innings.overs, innings.wickets, 6.0, PitchType.BALANCED, WeatherCondition.CLEAR,
                   { runs: 0, balls: 0, dots: 0, boundaries: 0, sixes: 0 },
                   { overs: 0, balls: 0, runsConceded: 0, wickets: 0, dots: 0, lastOverRuns: 0 },
                   [], false, 0, format
               );
               if (ball.isWicket) innings.wickets++;
               if (ball.isLegal) innings.balls++;
               innings.runs += ball.runs;
            }
            
            // Validate innings state
            expect(Number.isFinite(innings.runs)).toBe(true);
            expect(Number.isFinite(innings.wickets)).toBe(true);
            expect(innings.wickets).toBeGreaterThanOrEqual(0);
            expect(innings.wickets).toBeLessThanOrEqual(10);
            
            completed++;
        }
        expect(completed).toBe(100);
    }
  });
});
