import { describe, it, expect } from 'vitest';
import { Player } from '../types/common';
import { PitchType, WeatherCondition } from '../types/match';
import { BowlerFieldStrategyEngine } from '../engine/strategy/BowlerFieldStrategyEngine';
import { validateField } from '../engine/fielding/FieldingRestrictionEngine';
import {
  decideBowlingChange,
  chooseLegalFieldPresetKey,
  selectAIBowler,
  presetOutsideCount,
  getEligibleBowlers,
  type BowlingAIInput,
} from '../engine/ai/BowlingAIController';

function makePlayer(
  id: string,
  role: Player['role'],
  opts: { batting?: number; bowling?: number; style?: string; aggression?: number; temperament?: number; form?: number } = {},
): Player {
  return {
    id,
    name: id,
    role,
    nationality: 'Indian',
    rating: opts.batting ?? 70,
    basePrice: 100,
    battingStyle: 'RHB',
    bowlingStyle: opts.style,
    aggression: opts.aggression ?? 50,
    temperament: opts.temperament ?? 50,
    stamina: 80,
    baseAbility: 75,
    form: opts.form ?? 60,
    stats: { batting: opts.batting ?? 60, bowling: opts.bowling ?? 60, fielding: 70 },
    careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
  };
}

const squad: Player[] = [
  makePlayer('wk', 'Wicketkeeper', { batting: 80 }),
  makePlayer('pac1', 'Bowler', { bowling: 90, style: 'Right-arm fast' }),
  makePlayer('pac2', 'Bowler', { bowling: 88, style: 'Right-arm fast-medium' }),
  makePlayer('spin1', 'Bowler', { bowling: 84, style: 'Leg spin' }),
  makePlayer('spin2', 'Bowler', { bowling: 82, style: 'Off spin' }),
  makePlayer('ar1', 'All-rounder', { batting: 78, bowling: 76 }),
  makePlayer('bat1', 'Batsman', { batting: 88 }),
  makePlayer('bat2', 'Batsman', { batting: 85 }),
  makePlayer('bat3', 'Batsman', { batting: 80 }),
  makePlayer('bat4', 'Batsman', { batting: 76 }),
  makePlayer('ar2', 'All-rounder', { batting: 72, bowling: 70 }),
];

function baseInput(over: number, trigger: BowlingAIInput['trigger'], extra: Partial<BowlingAIInput> = {}): BowlingAIInput {
  return {
    format: 'T20',
    over,
    balls: (over - 1) * 6,
    wickets: 1,
    runs: 40,
    fieldingSquad: squad,
    bowlerStats: {},
    previousOverBowlerId: null,
    striker: makePlayer('striker', 'Batsman', { batting: 82 }),
    nonStriker: makePlayer('ns', 'Batsman', { batting: 78 }),
    pitch: PitchType.BALANCED,
    weather: WeatherCondition.SUNNY,
    trigger,
    ...extra,
  };
}

describe('BowlingAIController — autonomous bowling & fielding', () => {
  it('always returns a field preset that is legal for the format + phase', () => {
    // Death field requested in the powerplay (max 2 outside) must fall back.
    const key = chooseLegalFieldPresetKey('DEATH_YORKER_SHIELD', 'T20', 1);
    expect(Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS)).toContain(key);
    expect(presetOutsideCount(key)).toBeLessThanOrEqual(2);

    // Preferred legal preset is honoured.
    expect(chooseLegalFieldPresetKey('ATTACKING_PACE', 'T20', 1)).toBe('ATTACKING_SLIP_CORDON');
    // Middle overs allow the mapped spin web (3 outside).
    expect(chooseLegalFieldPresetKey('SPIN_WEB', 'T20', 10)).toBe('SPIN_TRAP_WEB');
  });

  it('validates every generated field against the restriction engine', () => {
    const decision = decideBowlingChange(baseInput(1, 'INITIAL'));
    expect(decision.fieldConfiguration).not.toBeNull();
    expect(decision.fieldValid).toBe(true);
    const result = validateField({
      format: 'T20',
      over: 1,
      fielders: decision.fieldConfiguration!.fielders.map((f) => ({
        id: f.id,
        role: f.role,
        x: f.targetPos.x,
        y: f.targetPos.y,
        isOutsideCircle: f.isOutsideCircle,
      })),
      options: { enforcePlayerCount: false },
    });
    expect(result.valid).toBe(true);
  });

  it('never bowls the previous over’s bowler for a new over', () => {
    const bowler = selectAIBowler(baseInput(7, 'OVER_END', { previousOverBowlerId: 'pac1' }));
    expect(bowler).not.toBeNull();
    expect(bowler!.id).not.toBe('pac1');
  });

  it('respects the per-bowler over quota (T20 = 4 overs)', () => {
    const input = baseInput(17, 'OVER_END', {
      bowlerStats: { pac1: { balls: 24, runs: 40, wickets: 2 }, pac2: { balls: 24, runs: 45, wickets: 1 } },
    });
    const eligible = getEligibleBowlers(input);
    expect(eligible.map((p) => p.id)).not.toContain('pac1');
    expect(eligible.map((p) => p.id)).not.toContain('pac2');
    const bowler = selectAIBowler(input);
    expect(bowler!.id).not.toBe('pac1');
    expect(bowler!.id).not.toBe('pac2');
  });

  it('keeps the current bowler and re-plans the field after a wicket', () => {
    const current = squad.find((p) => p.id === 'pac1')!;
    const decision = decideBowlingChange(
      baseInput(9, 'WICKET_FALL', { currentBowler: current, previousFieldPresetKey: 'BALANCED_RING' }),
    );
    expect(decision.changeBowler).toBe(false);
    expect(decision.bowlerId).toBe('pac1');
    expect(decision.fieldValid).toBe(true);
  });

  it('emits a field-change notification when the formation changes', () => {
    const decision = decideBowlingChange(
      baseInput(17, 'BOUNDARY_CLUSTER', {
        currentBowler: squad.find((p) => p.id === 'pac1')!,
        previousFieldPresetKey: 'BALANCED_RING',
      }),
    );
    expect(decision.fieldPresetKey).not.toBe('BALANCED_RING');
    expect(decision.fieldChanged).toBe(true);
    expect(decision.notification).toMatch(/Field adjusted/i);
  });
});
