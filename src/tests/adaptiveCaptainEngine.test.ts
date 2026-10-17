import { describe, it, expect } from 'vitest';
import { Player } from '../types/common';
import { PitchType, WeatherCondition } from '../types/match';
import { ArenaFormat } from '../engine/models/ArenaState';
import { BowlerFieldStrategyEngine } from '../engine/strategy/BowlerFieldStrategyEngine';
import {
  AdaptiveCaptainEngine,
  analyzeFieldCoverage,
  buildDeliveryModel,
  classifyBatterArchetype,
  classifyZone,
  computePressureScore,
  getBatterZonePreference,
  isLeftHandedBatter,
  neutralDeliveryModel,
  recommendFieldPreset,
  selectStrategicSetup,
  SETUP_PRESET_KEY,
  zoneAngleDeg,
  WAGON_ZONES,
} from '../engine/ai/AdaptiveCaptainEngine';

function mkPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'role' | 'stats'>): Player {
  return {
    nationality: 'Indian',
    rating: 85,
    basePrice: 0,
    baseAbility: 85,
    form: 80,
    careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
    ...overrides,
  };
}

const finisher = mkPlayer({ id: 'fin', name: 'Heinrich Klaasen', role: 'Batsman', stats: { batting: 88, bowling: 10, fielding: 80 }, aggression: 94, temperament: 60, battingStyle: 'Right-hand bat' });
const anchor = mkPlayer({ id: 'anc', name: 'Virat Kohli', role: 'Batsman', stats: { batting: 94, bowling: 10, fielding: 88 }, aggression: 66, temperament: 92, battingStyle: 'Right-hand bat' });
const tailender = mkPlayer({ id: 'tail', name: 'Jasprit Bumrah', role: 'Bowler', stats: { batting: 22, bowling: 95, fielding: 70 }, aggression: 30, temperament: 40, battingStyle: 'Right-hand bat' });
const lefty = mkPlayer({ id: 'lft', name: 'Rishabh Pant', role: 'Batsman', stats: { batting: 86, bowling: 10, fielding: 78 }, aggression: 92, temperament: 62, battingStyle: 'Left-hand bat' });

function fieldFor(presetKey: string, striker: Player, format: ArenaFormat = 'T20') {
  return BowlerFieldStrategyEngine.generateFieldConfiguration({
    format,
    bowler: mkPlayer({ id: 'b', name: 'Bowler', role: 'Bowler', stats: { batting: 20, bowling: 80, fielding: 70 }, bowlingStyle: 'Right-arm Fast' }),
    striker,
    nonStriker: anchor,
    overs: 10,
    balls: 60,
    wickets: 2,
    runs: 80,
    pitch: PitchType.BALANCED,
    weather: WeatherCondition.SUNNY,
    manualPresetKey: presetKey,
  });
}

describe('AdaptiveCaptainEngine — field-aware tactical model', () => {
  it('classifies ground angles into the correct wagon-wheel zones', () => {
    expect(classifyZone(zoneAngleDeg(235, 75, false))).toBe('LONG_OFF');
    expect(classifyZone(zoneAngleDeg(170, 285, false))).toBe('COVER');
    expect(classifyZone(zoneAngleDeg(155, 395, false))).toBe('POINT_SQUARE');
    expect(classifyZone(zoneAngleDeg(425, 285, false))).toBe('MID_WICKET_COW');
    expect(classifyZone(zoneAngleDeg(440, 405, false))).toBe('SQUARE_LEG');
    expect(classifyZone(zoneAngleDeg(145, 495, false))).toBe('THIRD_MAN_GULLY');
  });

  it('mirrors zone classification for a left-hander', () => {
    // A cover position for a RHB becomes a leg-side arc for a LHB.
    const rhb = zoneAngleDeg(170, 285, false);
    const lhb = zoneAngleDeg(170, 285, true);
    expect(rhb).toBeLessThan(0);
    expect(lhb).toBeGreaterThan(0);
    expect(isLeftHandedBatter(lefty)).toBe(true);
    expect(isLeftHandedBatter(anchor)).toBe(false);
  });

  it('detects deep/ring/catcher coverage in a boundary-shield field', () => {
    const field = fieldFor('DEATH_YORKER_SHIELD', finisher);
    const coverage = analyzeFieldCoverage(field, false);
    expect(coverage.length).toBe(WAGON_ZONES.length);
    // Death shield places several sweepers back on the rope.
    const deep = coverage.filter((c) => c.deepCovered).length;
    expect(deep).toBeGreaterThanOrEqual(2);
  });

  it('invites boundaries when the field is empty and suppresses them when the batter is covered', () => {
    const open = buildDeliveryModel({
      format: 'T20', field: null, bowler: null, striker: finisher, overs: 10, wickets: 2,
    });
    // Empty field → every favoured arc is open → boundaries should be easier.
    expect(open.boundarySuppression).toBeGreaterThan(1);

    const covered = fieldFor('DEATH_YORKER_SHIELD', finisher);
    const coveredModel = buildDeliveryModel({
      format: 'T20', field: covered, bowler: null, striker: finisher, overs: 18, wickets: 2,
    });
    expect(coveredModel.boundarySuppression).toBeLessThan(open.boundarySuppression);
  });

  it('is fully deterministic — identical inputs produce identical models', () => {
    const field = fieldFor('SPIN_TRAP_WEB', finisher);
    const a = buildDeliveryModel({ format: 'ODI', field, bowler: null, striker: finisher, overs: 20, wickets: 3, requiredRate: 6.1 });
    const b = buildDeliveryModel({ format: 'ODI', field, bowler: null, striker: finisher, overs: 20, wickets: 3, requiredRate: 6.1 });
    expect(a).toEqual(b);
  });

  it('keeps every multiplier inside its bounded, centred-on-1 window across archetypes & formats', () => {
    const formats: ArenaFormat[] = ['T20', 'ODI', 'TEST', 'IPL'];
    const batters = [finisher, anchor, tailender, lefty];
    const presets = Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS);
    for (const format of formats) {
      for (const batter of batters) {
        for (const preset of presets) {
          const field = fieldFor(preset, batter, format);
          const m = buildDeliveryModel({ format, field, bowler: null, striker: batter, overs: 30, wickets: 4, requiredRate: 7 });
          expect(m.boundarySuppression).toBeGreaterThanOrEqual(0.72);
          expect(m.boundarySuppression).toBeLessThanOrEqual(1.22);
          expect(m.rotationSuppression).toBeGreaterThanOrEqual(0.82);
          expect(m.rotationSuppression).toBeLessThanOrEqual(1.14);
          expect(m.wicketOpportunity).toBeGreaterThanOrEqual(0.90);
          expect(m.wicketOpportunity).toBeLessThanOrEqual(1.12);
        }
      }
    }
  });

  it('never guarantees a wicket or survival through the wicket-opportunity factor', () => {
    // Even the most catcher-loaded field stays well below a guaranteed wicket.
    const field = fieldFor('ATTACKING_SLIP_CORDON', anchor);
    const m = buildDeliveryModel({ format: 'TEST', field, bowler: null, striker: anchor, overs: 3, wickets: 0 });
    expect(m.wicketOpportunity).toBeLessThanOrEqual(1.12);
    expect(m.wicketOpportunity).toBeGreaterThanOrEqual(0.90);
  });

  it('scales field influence by format (Test > ODI > T20)', () => {
    const t20 = buildDeliveryModel({ format: 'T20', field: null, bowler: null, striker: finisher, overs: 10, wickets: 2 });
    const odi = buildDeliveryModel({ format: 'ODI', field: null, bowler: null, striker: finisher, overs: 25, wickets: 2 });
    const test = buildDeliveryModel({ format: 'TEST', field: null, bowler: null, striker: finisher, overs: 40, wickets: 2 });
    expect(test.boundarySuppression).toBeGreaterThan(odi.boundarySuppression);
    expect(odi.boundarySuppression).toBeGreaterThan(t20.boundarySuppression);
  });

  it('produces opposite ladder preferences for a finisher vs an anchor', () => {
    const fin = getBatterZonePreference(finisher);
    const anc = getBatterZonePreference(anchor);
    expect(fin.MID_WICKET_COW).toBeGreaterThan(anc.MID_WICKET_COW);
    expect(anc.COVER).toBeGreaterThan(fin.COVER);
    expect(classifyBatterArchetype(finisher)).toBe('finisher');
    expect(classifyBatterArchetype(anchor)).toBe('anchor');
    expect(classifyBatterArchetype(tailender)).toBe('tail');
  });
});

describe('AdaptiveCaptainEngine — reversible pressure', () => {
  it('rises with dots, wickets and a climbing required rate', () => {
    const calm = computePressureScore({ format: 'T20', overs: 10, wickets: 1, requiredRate: 8, consecutiveDots: 0, recentOutcomes: ['1', '2', '1'] });
    const hot = computePressureScore({ format: 'T20', overs: 17, wickets: 5, requiredRate: 13, consecutiveDots: 4, recentOutcomes: ['0', '0', '0', 'W', '0'] });
    expect(hot).toBeGreaterThan(calm);
    expect(hot).toBeLessThanOrEqual(1);
    expect(calm).toBeGreaterThanOrEqual(0);
  });

  it('is reversible — a boundary relieves pressure immediately', () => {
    const tense = computePressureScore({ format: 'ODI', overs: 42, wickets: 4, requiredRate: 11, consecutiveDots: 3, recentOutcomes: ['0', '0', '0'] });
    const relieved = computePressureScore({ format: 'ODI', overs: 42, wickets: 4, requiredRate: 11, consecutiveDots: 0, recentOutcomes: ['0', '0', '0', '4', '6'] });
    expect(relieved).toBeLessThan(tense);
  });

  it('does not treat balls-since-wicket as a wicket multiplier (pressure is event-based, not clock-based)', () => {
    const longWicketless = computePressureScore({ format: 'TEST', overs: 60, wickets: 2, recentOutcomes: ['1', '1', '0', '2', '1', '1'] });
    const sameButWicket = computePressureScore({ format: 'TEST', overs: 60, wickets: 2, recentOutcomes: ['1', '1', '0', '2', '1', 'W'] });
    // Only genuine events (a wicket) move it; elapsed balls do not.
    expect(sameButWicket).toBeGreaterThanOrEqual(longWicketless);
  });
});

describe('AdaptiveCaptainEngine — batter-aware field recommendation', () => {
  it('returns a legal, deterministic preset that protects the batter scoring arcs', () => {
    const legal = Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS);
    const a = recommendFieldPreset({ format: 'T20', striker: finisher, overs: 16, legalPresets: legal });
    const b = recommendFieldPreset({ format: 'T20', striker: finisher, overs: 16, legalPresets: legal });
    expect(legal).toContain(a.presetKey);
    expect(a.presetKey).toBe(b.presetKey);
    expect(a.reason.toLowerCase()).toContain('arc');
  });

  it('chooses a boundary-first preset for a leg-side finisher over a slip cordon', () => {
    const legal = Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS);
    const rec = recommendFieldPreset({
      format: 'T20', striker: finisher, overs: 18,
      recentBoundaryZones: ['MID_WICKET_COW', 'LONG_ON'],
      legalPresets: legal,
    });
    expect(rec.presetKey).not.toBe('ATTACKING_SLIP_CORDON');
  });
});

describe('AdaptiveCaptainEngine — neutral model', () => {
  it('is a true no-op so legacy call sites are unaffected', () => {
    const n = neutralDeliveryModel();
    expect(n.boundarySuppression).toBe(1);
    expect(n.rotationSuppression).toBe(1);
    expect(n.wicketOpportunity).toBe(1);
    expect(n.pressureScore).toBe(0);
  });
});

describe('AdaptiveCaptainEngine — public API surface', () => {
  it('exposes the engine class facade', () => {
    expect(typeof AdaptiveCaptainEngine.buildDeliveryModel).toBe('function');
    expect(typeof AdaptiveCaptainEngine.recommendFieldPreset).toBe('function');
    expect(typeof AdaptiveCaptainEngine.computePressureScore).toBe('function');
    expect(typeof AdaptiveCaptainEngine.analyzeFieldCoverage).toBe('function');
    expect(typeof AdaptiveCaptainEngine.selectStrategicSetup).toBe('function');
  });
});

describe('AdaptiveCaptainEngine — Strategic Setup selection (Attack / Contain / Death)', () => {
  it('attacks in the T20 powerplay and defends the rope at the death', () => {
    const pp = selectStrategicSetup({ format: 'T20', over: 2, striker: anchor, strikerBalls: 30 });
    expect(pp.phase).toBe('POWERPLAY');
    expect(pp.setup).toBe('ATTACKING');
    expect(pp.presetKey).toBe(SETUP_PRESET_KEY.ATTACKING);

    const death = selectStrategicSetup({ format: 'T20', over: 18, striker: finisher, strikerBalls: 25 });
    expect(death.phase).toBe('DEATH');
    expect(death.setup).toBe('DEATH');
    expect(death.presetKey).toBe(SETUP_PRESET_KEY.DEATH);
  });

  it('contains through the ODI middle overs and switches to death at over 41', () => {
    expect(selectStrategicSetup({ format: 'ODI', over: 25, striker: anchor, strikerBalls: 60 }).setup).toBe('CONTAINMENT');
    expect(selectStrategicSetup({ format: 'ODI', over: 44, striker: finisher, strikerBalls: 40 }).setup).toBe('DEATH');
  });

  it('has no limited-overs death phase in Test cricket (patient, format-specific)', () => {
    const early = selectStrategicSetup({ format: 'TEST', over: 3, striker: anchor, strikerBalls: 12 });
    const late = selectStrategicSetup({ format: 'TEST', over: 60, striker: anchor, strikerBalls: 180 });
    expect(early.phase).toBe('TEST');
    expect(early.setup).toBe('ATTACKING');
    expect(late.setup).toBe('CONTAINMENT');
    expect([early.setup, late.setup]).not.toContain('DEATH');
  });

  it('attacks a brand-new batter and a tailender even in the middle overs', () => {
    expect(selectStrategicSetup({ format: 'T20', over: 10, striker: anchor, strikerBalls: 2 }).setup).toBe('ATTACKING');
    expect(selectStrategicSetup({ format: 'T20', over: 10, striker: tailender, strikerBalls: 30 }).setup).toBe('ATTACKING');
  });

  it('reacts to genuine events: boundary cluster pulls sweepers back, wicket attacks the newcomer', () => {
    const cluster = selectStrategicSetup({ format: 'T20', over: 10, striker: anchor, strikerBalls: 20, trigger: 'BOUNDARY_CLUSTER' });
    expect(cluster.setup).toBe('CONTAINMENT');
    const wicket = selectStrategicSetup({ format: 'T20', over: 10, striker: anchor, strikerBalls: 0, trigger: 'WICKET_FALL' });
    expect(wicket.setup).toBe('ATTACKING');
  });

  it('realises a spinner containment plan with the spin web, and is deterministic', () => {
    const spin = selectStrategicSetup({ format: 'ODI', over: 25, striker: anchor, strikerBalls: 40, bowlerIsSpin: true });
    expect(spin.setup).toBe('CONTAINMENT');
    expect(spin.presetKey).toBe('SPIN_TRAP_WEB');
    const a = selectStrategicSetup({ format: 'ODI', over: 25, striker: anchor, strikerBalls: 40 });
    const b = selectStrategicSetup({ format: 'ODI', over: 25, striker: anchor, strikerBalls: 40 });
    expect(a).toEqual(b);
  });

  it('always returns a preset key that exists in the field engine', () => {
    for (const format of ['T20', 'IPL', 'ODI', 'TEST'] as ArenaFormat[]) {
      for (const over of [1, 5, 12, 20, 35, 48]) {
        const d = selectStrategicSetup({ format, over, striker: finisher, strikerBalls: 20 });
        expect(Object.keys(BowlerFieldStrategyEngine.PRESET_OVERLAYS)).toContain(d.presetKey);
      }
    }
  });
});
