import { describe, it, expect } from 'vitest';
import { BowlerFieldStrategyEngine } from '../engine/strategy/BowlerFieldStrategyEngine';
import { validateField } from '../engine/fielding/FieldingRestrictionEngine';
import { restoreFieldState, serializeFieldState } from '../engine/fielding/fieldPersistence';
import { PitchType, WeatherCondition } from '../types/match';
import { Player } from '../types/common';

const fastBowler: Player = {
  id: 'b_bumrah',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Fast',
  rating: 94,
  stats: { bowling: 95, fielding: 88 },
} as any;

const testSquad: Player[] = [
  fastBowler,
  { id: 'p_rohit', name: 'Rohit Sharma', role: 'Batsman', rating: 92, stats: { fielding: 86 } } as any,
  { id: 'p_surya', name: 'Suryakumar Yadav', role: 'Batsman', rating: 91, stats: { fielding: 89 } } as any,
  { id: 'p_hardik', name: 'Hardik Pandya', role: 'All-rounder', rating: 90, stats: { fielding: 91 } } as any,
  { id: 'p_rinku', name: 'Rinku Singh', role: 'Batsman', rating: 86, stats: { fielding: 90 } } as any,
  { id: 'p_axar', name: 'Axar Patel', role: 'All-rounder', rating: 88, stats: { fielding: 88 } } as any,
  { id: 'p_jadeja', name: 'Ravindra Jadeja', role: 'All-rounder', rating: 93, stats: { fielding: 98 } } as any,
  { id: 'p_shami', name: 'Mohammed Shami', role: 'Bowler', rating: 89, stats: { fielding: 80 } } as any,
  { id: 'p_arshdeep', name: 'Arshdeep Singh', role: 'Bowler', rating: 87, stats: { fielding: 82 } } as any,
  { id: 'p_siraj', name: 'Mohammed Siraj', role: 'Bowler', rating: 88, stats: { fielding: 84 } } as any,
  { id: 'p_wk', name: 'Rishabh Pant', role: 'Wicketkeeper', rating: 90, stats: { fielding: 90 } } as any,
];

function generatedConfig() {
  return BowlerFieldStrategyEngine.generateFieldConfiguration({
    format: 'T20',
    bowler: fastBowler,
    striker: testSquad[1],
    nonStriker: null,
    overs: 3,
    balls: 2,
    wickets: 0,
    runs: 25,
    pitch: PitchType.BALANCED,
    weather: WeatherCondition.SUNNY,
    fieldingSquad: testSquad,
    manualPresetKey: 'BALANCED_RING',
  });
}

describe('Section 9: Field formation persistence & resumption', () => {
  it('serializes the active formation and preset for persistence', () => {
    const config = generatedConfig();
    const state = serializeFieldState({ fieldPresetKey: 'BALANCED_RING', liveFieldConfiguration: config });
    expect(state.fieldPresetKey).toBe('BALANCED_RING');
    expect(state.liveFieldConfiguration).toBe(config);
  });

  it('normalizes missing/undefined fields to null', () => {
    const state = serializeFieldState({ fieldPresetKey: undefined as any, liveFieldConfiguration: undefined as any });
    expect(state).toEqual({ fieldPresetKey: null, liveFieldConfiguration: null });
  });

  it('refuses to restore a formation belonging to a different match', () => {
    const source = { currentMatchId: 'match_a', fieldPresetKey: 'BALANCED_RING', liveFieldConfiguration: generatedConfig() };
    expect(restoreFieldState(source, 'match_b')).toBeNull();
    expect(restoreFieldState(source, null)).toBeNull();
    expect(restoreFieldState(null, 'match_a')).toBeNull();
    expect(restoreFieldState(undefined, 'match_a')).toBeNull();
  });

  it('restores field state for the active match', () => {
    const config = generatedConfig();
    const restored = restoreFieldState(
      { currentMatchId: 'match_a', fieldPresetKey: 'BALANCED_RING', liveFieldConfiguration: config },
      'match_a',
    );
    expect(restored).not.toBeNull();
    expect(restored!.fieldPresetKey).toBe('BALANCED_RING');
    expect(restored!.liveFieldConfiguration).toBe(config);
  });

  it('sanitizes corrupt persisted values without throwing', () => {
    const restored = restoreFieldState(
      { currentMatchId: 'match_a', fieldPresetKey: 42, liveFieldConfiguration: 'not-a-config' },
      'match_a',
    );
    expect(restored).toEqual({ fieldPresetKey: null, liveFieldConfiguration: null });
  });

  it('survives a JSON persist round-trip and restores the SAME legal formation (no regeneration)', () => {
    const original = generatedConfig();
    const persisted = serializeFieldState({ fieldPresetKey: 'BALANCED_RING', liveFieldConfiguration: original });

    // Simulate the store writing to (and reading from) localStorage.
    const rehydrated = JSON.parse(JSON.stringify({ currentMatchId: 'match_a', ...persisted }));

    const restored = restoreFieldState(rehydrated, 'match_a')!;
    expect(restored.fieldPresetKey).toBe('BALANCED_RING');
    expect(restored.liveFieldConfiguration).not.toBeNull();

    // Every fielder and coordinate is identical to what was saved.
    const savedField = restored.liveFieldConfiguration!;
    expect(savedField.fielders.length).toBe(original.fielders.length);
    original.fielders.forEach((f, i) => {
      const g = savedField.fielders[i];
      expect(g.id).toBe(f.id);
      expect(g.positionKey).toBe(f.positionKey);
      expect(g.targetPos).toEqual(f.targetPos);
      expect(g.isOutsideCircle).toBe(f.isOutsideCircle);
    });

    // The restored formation is still legal at the resumption over.
    const res = validateField({
      format: 'T20',
      over: 4,
      fielders: savedField.fielders.map((f) => ({
        id: f.id,
        name: f.name,
        role: f.role,
        x: f.targetPos.x,
        y: f.targetPos.y,
        isOutsideCircle: f.isOutsideCircle,
      })),
      options: {
        expectedPlayerCount: 11,
        requireBowler: true,
        requireWicketkeeper: true,
        enforceBounds: true,
        enforcePitchClearance: true,
      },
    });
    expect(res.valid).toBe(true);
    expect(res.violations.length).toBe(0);
  });
});
