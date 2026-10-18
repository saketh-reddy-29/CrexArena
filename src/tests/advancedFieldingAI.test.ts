import { describe, it, expect } from 'vitest';
import {
  BowlerFieldStrategyEngine,
  type FieldConfiguration,
} from '../engine/strategy/BowlerFieldStrategyEngine';
import {
  validateField,
  getFieldingPhase,
  getFieldingRestrictions,
  getLegSideLimit,
  scaleRestrictionsForTotalOvers,
} from '../engine/fielding/FieldingRestrictionEngine';
import { getRules } from '../engine/rules/RulesEngine';
import { getIplRulesForSeason } from '../engine/rules/ipl/iplRules';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { PitchType, WeatherCondition } from '../types/match';
import type { Player } from '../types/common';

const fastBowler: Player = {
  id: 'b_fast',
  name: 'Pace Ace',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Fast',
  stats: { bowling: 93 },
  rating: 92,
} as any;

const spinner: Player = {
  id: 'b_spin',
  name: 'Spin King',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Off-break',
  stats: { bowling: 90 },
  rating: 89,
} as any;

const rhb: Player = {
  id: 'bat_rhb',
  name: 'Right Hander',
  role: 'Batsman',
  battingHand: 'Right',
  stats: { batting: 88 },
  rating: 87,
} as any;

const baseInput = {
  format: 'T20' as const,
  striker: rhb,
  nonStriker: null,
  overs: 10,
  balls: 0,
  wickets: 1,
  runs: 70,
  pitch: PitchType.BALANCED,
  weather: WeatherCondition.SUNNY,
};

describe('Rule scaling & season overrides', () => {
  it('exposes the Law 28.3 leg-side cap (5) for every format', () => {
    expect(getLegSideLimit('T20')).toBe(5);
    expect(getLegSideLimit('ODI')).toBe(5);
    expect(getLegSideLimit('TEST')).toBe(5);
    expect(getLegSideLimit('IPL')).toBe(5);
  });

  it('returns format rules for the requested season', () => {
    expect(getRules('T20').maxLegSideFielders).toBe(5);
    expect(getRules('IPL', 2035).maxLegSideFielders).toBe(5);
    expect(getIplRulesForSeason(2035).maxLegSideFielders).toBe(5);
  });

  it('rescales restriction windows for a reduced-overs innings', () => {
    const phase = getFieldingPhase('T20', 2, undefined, 10);
    expect(phase.key).toBe('POWERPLAY');
    expect(phase.maxOutsideCircle).toBe(2);

    const middle = getFieldingPhase('T20', 5, undefined, 10);
    expect(middle.key).toBe('MIDDLE');
    expect(middle.maxOutsideCircle).toBe(5);

    const death = getFieldingPhase('T20', 10, undefined, 10);
    expect(death.key).toBe('DEATH');

    const scaled = scaleRestrictionsForTotalOvers(getFieldingRestrictions('T20'), 20, 10);
    expect(scaled[0].startOver).toBe(1);
    expect(scaled[0].endOver).toBe(3);
  });
});

describe('Leg-side enforcement (Law 28.3)', () => {
  const make = (legCount: number) => {
    const fielders: any[] = [];
    for (let i = 0; i < 11; i += 1) {
      const onLeg = i < legCount;
      fielders.push({
        id: `f${i}`,
        name: `Fielder ${i}`,
        role: 'Batsman',
        x: onLeg ? 340 : 260,
        y: 300,
      });
    }
    return fielders;
  };

  it('rejects a formation with 6 fielders on the leg side', () => {
    const res = validateField({ format: 'T20', over: 10, fielders: make(6), options: { enforcePlayerCount: false } });
    expect(res.valid).toBe(false);
    expect(res.violations.some((v) => v.code === 'TOO_MANY_LEG_SIDE')).toBe(true);
  });

  it('accepts a formation with exactly 5 leg-side fielders', () => {
    const res = validateField({ format: 'T20', over: 10, fielders: make(5), options: { enforcePlayerCount: false } });
    expect(res.valid).toBe(true);
    expect(res.legSideCount).toBe(5);
    expect(res.legSideLimit).toBe(5);
  });

  it('never generates a field breaching the leg-side cap in any format', () => {
    for (const format of ['T20', 'ODI', 'TEST'] as const) {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        ...baseInput,
        format,
        bowler: format === 'TEST' ? spinner : fastBowler,
      });
      expect(config.legSideCount).toBeLessThanOrEqual(5);
      expect(config.isCompliant).toBe(true);
      expect(config.legSideLimit).toBe(5);
    }
  });
});

describe('Two-fielder movement budget', () => {
  it('reports no movement and no limitation without a previous configuration', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({ ...baseInput, bowler: fastBowler });
    expect(config.movementLimited).toBe(false);
    expect(config.changedFielders.length).toBe(0);
  });

  it('caps each update at two moved fielders and holds the rest', () => {
    const baseline = BowlerFieldStrategyEngine.generateFieldConfiguration({ ...baseInput, bowler: fastBowler });
    const next = BowlerFieldStrategyEngine.generateFieldConfiguration({
      ...baseInput,
      bowler: fastBowler,
      previousConfig: baseline,
      manualPresetKey: 'ATTACKING_SLIP_CORDON',
    });

    expect(next.changedFielders.length).toBeLessThanOrEqual(2);
    expect(next.movementLimited).toBe(true);

    const movedIds = new Set(next.changedFielders.map((c) => c.playerId));
    for (const f of next.fielders) {
      if (movedIds.has(f.id)) continue;
      const prev = baseline.fielders.find((p) => p.id === f.id);
      expect(f.targetPos).toEqual(prev?.targetPos);
    }
    expect(movedIds.size).toBeGreaterThan(0);
  });

  it('applies the movement limit with hot-zone context without breaching legality', () => {
    const baseline = BowlerFieldStrategyEngine.generateFieldConfiguration({ ...baseInput, bowler: spinner });
    const next = BowlerFieldStrategyEngine.generateFieldConfiguration({
      ...baseInput,
      bowler: spinner,
      previousConfig: baseline,
      hotZones: ['MID_WICKET_COW'],
      manualPresetKey: 'ATTACKING_SLIP_CORDON',
    });
    expect(next.changedFielders.length).toBeLessThanOrEqual(2);
    expect(next.actualOutsideCircle).toBeLessThanOrEqual(next.maxOutsideCircle);
    expect(next.legSideCount).toBeLessThanOrEqual(5);
  });
});

describe('Delivery-time field validation snapshot', () => {
  const players = {
    striker: rhb,
    nonStriker: { ...rhb, id: 'bat_rhb2', name: 'Other End' } as Player,
    bowler: fastBowler,
  };

  it('attaches a valid fieldValidation for a legal configuration', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({ ...baseInput, bowler: fastBowler });
    const result = DeliveryResultFactory.createDeliveryResult({
      ...players,
      currentBalls: 60,
      currentWickets: 1,
      requiredRate: 8,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
      fieldConfiguration: config,
      totalOvers: 20,
    });
    expect(result.fieldValidation).toBeDefined();
    expect(result.fieldValidation?.valid).toBe(true);
  });

  it('flags an illegal formation passing through the pipeline', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({ ...baseInput, bowler: fastBowler });
    const illegal: FieldConfiguration = {
      ...config,
      fielders: config.fielders.map((f) => ({
        ...f,
        role: 'Batsman',
        isOutsideCircle: false,
        targetPos: { x: 350, y: 300 },
      })),
    };
    const result = DeliveryResultFactory.createDeliveryResult({
      ...players,
      currentBalls: 30,
      currentWickets: 1,
      requiredRate: 8,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
      fieldConfiguration: illegal,
      totalOvers: 20,
    });
    expect(result.fieldValidation?.valid).toBe(false);
    expect(result.fieldValidation?.violations.some((v) => v.code === 'TOO_MANY_LEG_SIDE')).toBe(true);
  });
});
