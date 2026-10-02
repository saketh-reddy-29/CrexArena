import { describe, it, expect } from 'vitest';
import {
  FormatStrategyEngine,
  T20StrategyEngine,
  ODIStrategyEngine,
  TestStrategyEngine,
  formatStrategyEngine,
} from '../engine/formats/FormatStrategyEngine';

describe('FormatStrategyEngine', () => {
  describe('T20StrategyEngine', () => {
    const t20 = new T20StrategyEngine();

    it('exhibits high run and boundary values with aggressive intent', () => {
      const decision = t20.evaluate({
        format: 'T20',
        innings: 1,
        balls: 24,
        overs: 4,
        runs: 36,
        wickets: 0,
        batter: { ballsFaced: 12, rating: 80 },
        bowler: { rating: 75 },
      });

      expect(decision.runValue).toBeGreaterThanOrEqual(90);
      expect(decision.boundaryValue).toBeGreaterThanOrEqual(90);
      expect(decision.riskTolerance).toBeGreaterThanOrEqual(0.60);
      expect(decision.battingIntent).toBe('AGGRESSIVE');
    });

    it('adapts to collapse by shifting to BUILDING intent when early wickets fall', () => {
      const decision = t20.evaluate({
        format: 'T20',
        innings: 1,
        balls: 30,
        overs: 5,
        runs: 22,
        wickets: 7, // 22/7 collapse
        batter: { ballsFaced: 5, rating: 70 },
        bowler: { rating: 80 },
      });

      expect(decision.battingIntent).toBe('BUILDING');
      expect(decision.riskTolerance).toBeLessThan(0.50);
      expect(decision.wicketValue).toBeGreaterThanOrEqual(80);
    });

    it('triggers ALL_OUT_ATTACK in death overs', () => {
      const decision = t20.evaluate({
        format: 'T20',
        innings: 1,
        balls: 108,
        overs: 18,
        runs: 165,
        wickets: 4,
        batter: { ballsFaced: 20, rating: 85 },
        bowler: { rating: 80 },
      });

      expect(decision.battingIntent).toBe('ALL_OUT_ATTACK');
      expect(decision.riskTolerance).toBeGreaterThanOrEqual(0.80);
      expect(decision.bowlingIntent).toBe('DEATH_EXECUTION');
    });
  });

  describe('ODIStrategyEngine', () => {
    const odi = new ODIStrategyEngine();

    it('prioritizes wicket preservation and partnership building during middle overs', () => {
      const decision = odi.evaluate({
        format: 'ODI',
        innings: 1,
        balls: 120,
        overs: 20,
        runs: 95,
        wickets: 2,
        batter: { ballsFaced: 35, rating: 80 },
        bowler: { rating: 75 },
      });

      expect(decision.wicketValue).toBeGreaterThanOrEqual(80);
      expect(decision.partnershipValue).toBeGreaterThanOrEqual(85);
      expect(decision.battingIntent).toBe('ROTATE');
      expect(decision.riskTolerance).toBeLessThanOrEqual(0.45);
      expect(decision.bowlingIntent).toBe('DOT_BALL_PRESSURE');
    });

    it('accelerates in final overs 41-50', () => {
      const decision = odi.evaluate({
        format: 'ODI',
        innings: 1,
        balls: 270,
        overs: 45,
        runs: 250,
        wickets: 4,
        batter: { ballsFaced: 40, rating: 85 },
        bowler: { rating: 80 },
      });

      expect(decision.battingIntent).toBe('ALL_OUT_ATTACK');
      expect(decision.riskTolerance).toBeGreaterThanOrEqual(0.70);
      expect(decision.bowlingIntent).toBe('DEATH_EXECUTION');
    });
  });

  describe('TestStrategyEngine', () => {
    const testEngine = new TestStrategyEngine();

    it('enforces SURVIVAL intent and minimal risk for a new batter (0-5 balls)', () => {
      const decision = testEngine.evaluate({
        format: 'TEST',
        innings: 1,
        balls: 60,
        overs: 10,
        runs: 25,
        wickets: 1,
        batter: { ballsFaced: 2, rating: 85 },
        bowler: { rating: 85 },
      });

      expect(decision.battingIntent).toBe('SURVIVAL');
      expect(decision.riskTolerance).toBeLessThan(0.15);
      expect(decision.wicketValue).toBeGreaterThanOrEqual(95);
      expect(decision.settledness).toBeLessThan(15);
      // High dot probability in survival phase
      const dotWeight = decision.baseRunWeights.find((o) => o.runs === 0)?.weight || 0;
      expect(dotWeight).toBeGreaterThanOrEqual(80);
    });

    it('rewards settled batter (50+ balls) with higher confidence and building intent', () => {
      const decision = testEngine.evaluate({
        format: 'TEST',
        innings: 1,
        balls: 300,
        overs: 50,
        runs: 160,
        wickets: 2,
        batter: { ballsFaced: 65, rating: 85 },
        bowler: { rating: 80 },
      });

      expect(decision.settledness).toBeGreaterThanOrEqual(80);
      expect(decision.battingIntent).toBe('BUILDING');
      expect(decision.baseWicketProbability).toBeLessThan(0.035);
    });
  });

  describe('Master FormatStrategyEngine routing', () => {
    it('correctly routes to T20, ODI, and Test strategy engines', () => {
      const t20Res = formatStrategyEngine.evaluate({ format: 'T20', innings: 1, balls: 10, overs: 1, runs: 12, wickets: 0, batter: {}, bowler: {} });
      const odiRes = formatStrategyEngine.evaluate({ format: 'ODI', innings: 1, balls: 10, overs: 1, runs: 5, wickets: 0, batter: {}, bowler: {} });
      const testRes = formatStrategyEngine.evaluate({ format: 'TEST', innings: 1, balls: 10, overs: 1, runs: 2, wickets: 0, batter: {}, bowler: {} });

      expect(t20Res.boundaryValue).toBeGreaterThan(testRes.boundaryValue);
      expect(testRes.wicketValue).toBeGreaterThan(t20Res.wicketValue);
      expect(odiRes.partnershipValue).toBeGreaterThan(t20Res.partnershipValue);
    });
  });
});
