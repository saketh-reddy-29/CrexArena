import { describe, it, expect } from 'vitest';
import { 
  getMatchFormatConfig, 
  T20_FORMAT_CONFIG, 
  ODI_FORMAT_CONFIG, 
  TEST_FORMAT_CONFIG 
} from '../engine/config/MatchFormatConfig';
import { MatchEngine } from '../lib/matchEngine';

describe('MatchFormatConfig Centralized Engine Rules', () => {
  it('correctly configures T20 format rules', () => {
    const config = getMatchFormatConfig('T20');
    expect(config.oversPerInnings).toBe(20);
    expect(config.maxInnings).toBe(2);
    expect(config.maxOversPerBowler).toBe(4);
    expect(config.minBowlersRequired).toBe(5);
    expect(config.drsReviewsPerInnings).toBe(2);
    expect(config.baseWicketProbability).toBe(0.028);
    expect(config.powerplayPhases.length).toBe(3);
    expect(config.powerplayPhases[0].maxOutsideCircle).toBe(2);
    expect(config.powerplayPhases[1].maxOutsideCircle).toBe(5);
    expect(config.powerplayPhases[2].maxOutsideCircle).toBe(5);
  });

  it('correctly configures ODI format rules', () => {
    const config = getMatchFormatConfig('ODI');
    expect(config.oversPerInnings).toBe(50);
    expect(config.maxInnings).toBe(2);
    expect(config.maxOversPerBowler).toBe(10);
    expect(config.minBowlersRequired).toBe(5);
    expect(config.drsReviewsPerInnings).toBe(2);
    expect(config.baseWicketProbability).toBe(0.022);
    expect(config.powerplayPhases.length).toBe(3);
    expect(config.powerplayPhases[0].maxOutsideCircle).toBe(2);
    expect(config.powerplayPhases[1].maxOutsideCircle).toBe(4);
    expect(config.powerplayPhases[2].maxOutsideCircle).toBe(5);
  });

  it('correctly configures TEST format rules', () => {
    const config = getMatchFormatConfig('TEST');
    expect(config.oversPerInnings).toBe(Infinity);
    expect(config.maxInnings).toBe(4);
    expect(config.maxOversPerBowler).toBe(Infinity);
    expect(config.drsReviewsPerInnings).toBe(3);
    expect(config.drsResetOvers).toBe(80);
    expect(config.followOnLeadRequirement).toBe(200);
    expect(config.declarationAllowed).toBe(true);
    expect(config.baseWicketProbability).toBe(0.016);
    expect(config.baseRunDistribution.dot).toBeGreaterThan(60);
  });

  it('delegates MatchEngine helper methods to format config', () => {
    expect(MatchEngine.getOversPerMatch('T20')).toBe(20);
    expect(MatchEngine.getOversPerMatch('ODI')).toBe(50);
    expect(MatchEngine.getOversPerMatch('TEST')).toBe(Infinity);

    expect(MatchEngine.getMaxOversPerBowler('T20')).toBe(4);
    expect(MatchEngine.getMaxOversPerBowler('ODI')).toBe(10);
    expect(MatchEngine.getMaxOversPerBowler('TEST')).toBe(Infinity);
  });
});
