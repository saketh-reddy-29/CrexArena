import { describe, it, expect } from 'vitest';
import { AICaptainEngine } from '../engine/ai/AICaptainEngine';
import { BatterDecisionEngine } from '../engine/ai/BatterDecisionEngine';
import { getFieldingPhase } from '../engine/fielding/FieldingRestrictionEngine';
import { PitchType } from '../types/match';
import { Player } from '../types/common';

const pacer: Player = {
  id: 'pacer-1', name: 'Jasprit Bumrah', role: 'Bowler', nationality: 'Indian',
  rating: 95, baseAbility: 95, form: 90, bowlingStyle: 'Right-arm fast',
  stats: { batting: 10, bowling: 95, fielding: 75 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
} as any;

const spinner: Player = {
  id: 'spinner-1', name: 'Rashid Khan', role: 'Bowler', nationality: 'Indian',
  rating: 92, baseAbility: 92, form: 88, bowlingStyle: 'Right-arm leg spin',
  stats: { batting: 35, bowling: 92, fielding: 80 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
} as any;

const batter: Player = {
  id: 'bat-1', name: 'Shubman Gill', role: 'Batsman', nationality: 'Indian',
  rating: 90, baseAbility: 90, form: 85, temperament: 88,
  stats: { batting: 90, bowling: 10, fielding: 85 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
} as any;

describe('§2: Phase boundaries resolve from the rules layer (single source of truth)', () => {
  it('classifies the 16th T20 over as DEATH and the 15th as MIDDLE, per getFieldingPhase', () => {
    expect(getFieldingPhase('T20', 6).key).toBe('POWERPLAY');
    expect(getFieldingPhase('T20', 7).key).toBe('MIDDLE');
    expect(getFieldingPhase('T20', 15).key).toBe('MIDDLE');
    expect(getFieldingPhase('T20', 16).key).toBe('DEATH');
  });

  it('AI captain switches to the death field from the 16th over (no 17th-over hardcode)', () => {
    const decide = (balls: number) =>
      AICaptainEngine.decideCaptainAction({
        format: 'T20',
        teamId: 'IND',
        inningsState: { score: 120, wickets: 2, balls, recentBalls: ['4', '6', '1'] },
        availableBowlers: [pacer, spinner],
        currentBowler: pacer,
        striker: batter,
        decisionTrigger: 'BOUNDARY_CLUSTER',
      });

    // 15 completed overs (balls 90-95) => 16th over being bowled => death overs.
    expect(decide(91).fieldPresetKey).toBe('DEATH_YORKER_SHIELD');
    // 14 completed overs (balls 84-89) => 15th over => still middle overs.
    expect(decide(85).fieldPresetKey).toBe('MIDDLE_SQUEEZE');
  });

  it('batter intent agrees with the fielding engine phase at the death boundary', () => {
    const state = BatterDecisionEngine.createInitialBatterState('bat-1', 'inn-1', batter);
    state.settledness = 75;
    state.ballsFaced = 22;

    const intent = (balls: number) =>
      BatterDecisionEngine.selectBattingIntent(state, {
        format: 'T20',
        batter,
        bowler: pacer,
        inningsState: { score: 120, wickets: 3, balls },
      });

    expect(intent(91)).toBe('ACCELERATE');      // 16th over => death overs
    expect(intent(85)).toBe('ROTATE_STRIKE');   // 15th over => middle overs
  });
});
