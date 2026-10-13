import { describe, it, expect } from 'vitest';
import { AICaptainEngine } from '../engine/ai/AICaptainEngine';
import { BowlingPlanEngine } from '../engine/ai/BowlingPlanEngine';
import { PitchType } from '../types/match';
import { Player } from '../types/common';

const mockPacer: Player = {
  id: 'pacer-1',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  nationality: 'Indian',
  rating: 95,
  baseAbility: 95,
  form: 90,
  bowlingStyle: 'Right-arm fast',
  stats: { batting: 10, bowling: 95, fielding: 75 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

const mockSpinner: Player = {
  id: 'spinner-1',
  name: 'Rashid Khan',
  role: 'Bowler',
  nationality: 'Afghan',
  rating: 92,
  baseAbility: 92,
  form: 88,
  bowlingStyle: 'Right-arm leg spin',
  stats: { batting: 35, bowling: 92, fielding: 80 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

const mockStriker: Player = {
  id: 'bat-1',
  name: 'Virat Kohli',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 92,
  baseAbility: 92,
  form: 85,
  stats: { batting: 92, bowling: 10, fielding: 85 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

describe('BowlingPlanEngine', () => {
  it('selects YORKER or WIDE_YORKER for death overs', () => {
    const plan = BowlingPlanEngine.selectBowlingPlan(mockPacer, mockStriker, {
      format: 'T20',
      overs: 18,
      balls: 108,
      wickets: 4,
      pitch: PitchType.BALANCED,
    });

    expect(['YORKER', 'WIDE_YORKER']).toContain(plan.planType);
    expect(plan.length).toBe('YORKER');
    expect(plan.summary.length).toBeGreaterThan(10);
  });

  it('selects SPIN_ATTACK for spinners attacking new batters', () => {
    const plan = BowlingPlanEngine.selectBowlingPlan(mockSpinner, mockStriker, {
      format: 'T20',
      overs: 8,
      balls: 48,
      wickets: 2,
      pitch: PitchType.SPIN,
      strikerBalls: 2,
    });

    expect(plan.planType).toBe('SPIN_ATTACK');
    expect(plan.targetScoringZones).toContain('SLIP');
  });
});

describe('AICaptainEngine — Tactical Decisions', () => {
  it('detects boundary clusters and recommends defensive field adjustments', () => {
    const decision = AICaptainEngine.decideCaptainAction({
      format: 'T20',
      teamId: 'IND',
      inningsState: {
        score: 110,
        wickets: 2,
        balls: 74,
        recentBalls: ['4', '1', '6', '0', '4'],
      },
      availableBowlers: [mockPacer, mockSpinner],
      currentBowler: mockPacer,
      striker: mockStriker,
      decisionTrigger: 'BOUNDARY_CLUSTER',
    });

    expect(decision.actionType).toBe('CHANGE_FIELD');
    expect(decision.observation).toContain('boundaries');
    expect(decision.tradeOff).toBeDefined();
    expect(decision.confidence).toBeGreaterThan(70);
  });

  it('recommends attacking field on wicket fall', () => {
    const decision = AICaptainEngine.decideCaptainAction({
      format: 'TEST',
      teamId: 'IND',
      inningsState: {
        score: 65,
        wickets: 3,
        balls: 120,
        recentBalls: ['W'],
      },
      availableBowlers: [mockPacer, mockSpinner],
      currentBowler: mockPacer,
      striker: mockStriker,
      decisionTrigger: 'WICKET_FALL',
    });

    expect(decision.actionType).toBe('CHANGE_FIELD');
    expect(decision.fieldPresetKey).toBe('ATTACKING_PACE');
    expect(decision.reasoning).toContain('close catchers');
  });

  it('rotates bowler at over end to eligible candidate', () => {
    const decision = AICaptainEngine.decideCaptainAction({
      format: 'T20',
      teamId: 'IND',
      inningsState: {
        score: 45,
        wickets: 1,
        balls: 36, // 6.0 overs
        recentBalls: ['0', '1', '1', '0', '4', '1'],
      },
      availableBowlers: [mockPacer, mockSpinner],
      currentBowler: mockPacer,
      previousOverBowlerId: mockPacer.id,
      striker: mockStriker,
      decisionTrigger: 'OVER_END',
    });

    expect(decision.actionType).toBe('CHANGE_BOWLER');
    expect(decision.selectedBowlerId).toBe(mockSpinner.id);
    expect(decision.selectedBowlerName).toBe('Rashid Khan');
    expect(decision.reasoning).toContain('Rashid Khan');
  });
});

