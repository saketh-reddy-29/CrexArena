import { describe, it, expect } from 'vitest';
import {
  runRateEngine,
  scoreAccelerationEngine,
  partnershipEngine,
  battingRiskEngine,
  bowlerStrategyEngine,
  fieldStrategyEngine,
  captainStrategyEngine,
} from '../engine/strategy';

describe('Dynamic Match Strategy Engine Suite', () => {
  describe('RunRateEngine', () => {
    it('calculates accurate CRR and dynamic projections', () => {
      const res = runRateEngine.calculate('T20', 10, 0, 85, 2, 20);
      expect(res.currentRunRate).toBe(8.5);
      expect(res.projectedScore).toBeGreaterThanOrEqual(160);
      expect(res.wicketsRemaining).toBe(8);
      expect(res.ballsRemaining).toBe(60);
    });

    it('calculates required run rate in 2nd innings chase', () => {
      const res = runRateEngine.calculate('T20', 15, 0, 120, 3, 20, 180, 2);
      expect(res.runsRequired).toBe(60);
      expect(res.ballsRemaining).toBe(30);
      expect(res.requiredRunRate).toBe(12.0);
      expect(res.accelerationRequired).toBe('EXTREME');
    });
  });

  describe('ScoreAccelerationEngine', () => {
    it('triggers MAXIMUM_ATTACK in T20 death overs with wickets in hand', () => {
      const metrics = runRateEngine.calculate('T20', 17, 0, 160, 3, 20);
      const dec = scoreAccelerationEngine.evaluate('T20', 17, 3, metrics, 80);
      expect(dec.state).toBe('MAXIMUM_ATTACK');
      expect(dec.boundaryAggressionScore).toBeGreaterThanOrEqual(90);
    });

    it('triggers SURVIVE / REBUILD in ODI during an early collapse', () => {
      const metrics = runRateEngine.calculate('ODI', 12, 0, 45, 6, 50); // 45/6
      const dec = scoreAccelerationEngine.evaluate('ODI', 12, 6, metrics, 15);
      expect(dec.state).toBe('SURVIVE');
      expect(dec.wicketPreservationScore).toBeGreaterThanOrEqual(90);
    });

    it('triggers ROTATE during normal ODI middle overs (overs 11-35)', () => {
      const metrics = runRateEngine.calculate('ODI', 22, 0, 110, 2, 50);
      const dec = scoreAccelerationEngine.evaluate('ODI', 22, 2, metrics, 50);
      expect(dec.state).toBe('ROTATE');
      expect(dec.recommendedStrokeType).toBe('ROTATE_SINGLES');
    });
  });

  describe('PartnershipEngine', () => {
    it('detects established and dominant partnerships with milestone triggers', () => {
      const p50 = partnershipEngine.evaluate(52, 60, 'ODI');
      expect(p50.status).toBe('ESTABLISHED');
      expect(p50.milestoneTrigger).toBe(50);
      expect(p50.batterConfidenceBoost).toBe(12);

      const p100 = partnershipEngine.evaluate(105, 110, 'ODI');
      expect(p100.status).toBe('DOMINANT');
      expect(p100.milestoneTrigger).toBe(100);
      expect(p100.bowlerUrgencyScore).toBe(95);
    });
  });

  describe('BattingRiskEngine', () => {
    it('scales risk based on format, wickets down, and acceleration state', () => {
      const testRisk = battingRiskEngine.calculateRisk('TEST', 10, 1, 'DEFEND', 10);
      const t20Risk = battingRiskEngine.calculateRisk('T20', 18, 3, 'MAXIMUM_ATTACK', 80);

      expect(testRisk.riskLevel).toBeLessThan(0.20);
      expect(testRisk.recommendedPatience).toBe('EXTREME');

      expect(t20Risk.riskLevel).toBeGreaterThan(0.70);
      expect(t20Risk.boundaryRewardFactor).toBeGreaterThan(1.5);
    });
  });

  describe('BowlerStrategyEngine', () => {
    it('detects boundary pressure and adapts to slower balls or yorkers in death overs', () => {
      const res = bowlerStrategyEngine.evaluate('T20', 18, 4, 'Fast', [4, 6, 4], false, 20);
      expect(res.boundaryPressureDetected).toBe(true);
      expect(res.mode).toBe('DEATH_CONTAINMENT');
      expect(['SLOWER_BALL', 'YORKER']).toContain(res.recommendedTactic);
    });

    it('attacks stumps with outswing against a new batter', () => {
      const res = bowlerStrategyEngine.evaluate('TEST', 5, 2, 'Fast', [0, 0, 0], true, 0);
      expect(res.mode).toBe('WICKET_ATTACK');
      expect(res.recommendedTactic).toBe('OUTSWING');
    });
  });

  describe('FieldStrategyEngine', () => {
    it('generates Powerplay field with max 2 deep fielders', () => {
      const field = fieldStrategyEngine.evaluate('ODI', 5, 1, 4.5);
      expect(field.preset).toBe('POWERPLAY_ATTACK');
      expect(field.maxDeepAllowed).toBe(2);
      expect(field.positions.length).toBe(9);
    });

    it('generates Death overs 5-man boundary protection field for overs 41-50 in ODI', () => {
      const field = fieldStrategyEngine.evaluate('ODI', 45, 4, 6.2);
      expect(field.preset).toBe('DEATH_FIELD');
      expect(field.maxDeepAllowed).toBe(5);
      expect(field.deepFieldersCount).toBe(5);
    });

    it('generates Attacking Slip Cordon for Test match early overs', () => {
      const field = fieldStrategyEngine.evaluate('TEST', 4, 1, 2.1);
      expect(field.preset).toBe('ATTACKING');
      expect(field.positions.some((p) => p.name.includes('Slip'))).toBe(true);
    });
  });

  describe('CaptainStrategyEngine', () => {
    it('synthesizes complete match strategy in real time', () => {
      const strategy = captainStrategyEngine.evaluateDelivery(
        'ODI',
        25,
        3,
        130,
        2,
        50,
        null,
        1,
        { ballsFaced: 40, form: 90 },
        { bowlingStyle: 'Fast', rating: 80 },
        65,
        75,
        [1, 0, 1],
        'NONE'
      );

      expect(strategy.runRateMetrics.currentRunRate).toBeGreaterThan(0);
      expect(strategy.acceleration.state).toBeDefined();
      expect(strategy.partnership.status).toBe('ESTABLISHED');
      expect(strategy.battingRisk.riskLevel).toBeDefined();
      expect(strategy.bowlerStrategy.recommendedTactic).toBeDefined();
      expect(strategy.fieldLayout.preset).toBeDefined();
    });
  });
});
