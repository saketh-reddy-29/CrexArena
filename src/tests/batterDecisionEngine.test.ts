import { describe, it, expect } from 'vitest';
import { BatterDecisionEngine, BatterInningsState } from '../engine/ai/BatterDecisionEngine';
import { Player } from '../types/common';

const mockBatter: Player = {
  id: 'bat-1',
  name: 'Virat Kohli',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 92,
  baseAbility: 92,
  form: 85,
  temperament: 90,
  stats: { batting: 92, bowling: 10, fielding: 85 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

const mockBowler: Player = {
  id: 'bowl-1',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  nationality: 'Indian',
  rating: 95,
  baseAbility: 95,
  form: 90,
  stats: { batting: 10, bowling: 95, fielding: 70 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
};

describe('BatterDecisionEngine — Settledness & Intent', () => {
  it('initializes new batter with bounded, non-zero settledness', () => {
    const state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', mockBatter);
    expect(state.ballsFaced).toBe(0);
    expect(state.runsScored).toBe(0);
    expect(state.settledness).toBeGreaterThanOrEqual(10);
    expect(state.settledness).toBeLessThanOrEqual(25);
    expect(state.currentIntent).toBe('SETTLING');
  });

  it('progresses settledness smoothly over 30 deliveries without arbitrary spikes', () => {
    let state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', mockBatter);
    const initialSettledness = state.settledness;

    for (let i = 0; i < 30; i++) {
      state = BatterDecisionEngine.updateBatterStateAfterDelivery(state, {
        runs: i % 3 === 0 ? 1 : 0,
        isWicket: false,
      });
    }

    expect(state.ballsFaced).toBe(30);
    expect(state.settledness).toBeGreaterThan(initialSettledness + 20);
    expect(state.settledness).toBeLessThanOrEqual(95); // bounded plateau
  });

  it('respects manual user override intent strictly', () => {
    const state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', mockBatter);
    const context = {
      format: 'T20',
      batter: mockBatter,
      bowler: mockBowler,
      inningsState: { score: 180, wickets: 2, balls: 110, target: 190 },
      userOverrideIntent: 'DEFENSIVE' as const,
    };

    const intent = BatterDecisionEngine.selectBattingIntent(state, context);
    expect(intent).toBe('DEFENSIVE');
  });

  it('selects ACCELERATE in T20 death overs with wickets in hand', () => {
    let state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', mockBatter);
    state.settledness = 75;
    state.ballsFaced = 22;

    const context = {
      format: 'T20',
      batter: mockBatter,
      bowler: mockBowler,
      inningsState: { score: 145, wickets: 3, balls: 102 }, // 17th over
    };

    const intent = BatterDecisionEngine.selectBattingIntent(state, context);
    expect(intent).toBe('ACCELERATE');
  });

  it('selects DEFENSIVE / SETTLING in Test cricket against new ball', () => {
    const state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', mockBatter);
    const context = {
      format: 'TEST',
      batter: mockBatter,
      bowler: mockBowler,
      inningsState: { score: 12, wickets: 1, balls: 24 }, // 4th over
      ballAgeOvers: 4,
    };

    const intent = BatterDecisionEngine.selectBattingIntent(state, context);
    expect(['DEFENSIVE', 'SETTLING']).toContain(intent);
  });
});

