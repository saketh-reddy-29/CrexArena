import { describe, it, expect } from 'vitest';
import {
  getFieldingPhase,
  getFieldingRestrictions,
  getRestrictionSummary,
  isFieldLegal,
  isOutsideCircle,
  overFromBalls,
  validateField,
  FielderPosition,
  BOUNDARY_RADIUS,
  INNER_CIRCLE,
  MAX_FIELDING_SIDE,
} from '../engine/fielding/FieldingRestrictionEngine';
import { iplRules } from '../engine/rules/ipl/iplRules';

function mkFielder(id: string, x: number, y: number, role?: string): FielderPosition {
  return { id, name: `P${id}`, x, y, role };
}

// Positions that are unambiguously inside / outside the 30-yard ellipse.
const INSIDE_A = mkFielder('in_a', 200, 300, 'Batsman');
const INSIDE_B = mkFielder('in_b', 400, 300, 'Batsman');
const INSIDE_C = mkFielder('in_c', 300, 250, 'Batsman');
const INSIDE_D = mkFielder('in_d', 300, 350, 'Batsman');
const OUTSIDE_A = mkFielder('out_a', 90, 300, 'Batsman');
const OUTSIDE_B = mkFielder('out_b', 510, 300, 'Batsman');
const OUTSIDE_C = mkFielder('out_c', 300, 90, 'Batsman');
const OUTSIDE_D = mkFielder('out_d', 300, 510, 'Batsman');
const OUTSIDE_E = mkFielder('out_e', 120, 120, 'Batsman');
const OUTSIDE_F = mkFielder('out_f', 480, 120, 'Batsman');

const KEEPER = mkFielder('wk', 300, 260, 'Wicketkeeper');
const BOWLER = mkFielder('bowl', 300, 200, 'Bowler');

/** Builds a full field: keeper + bowler + the outside fielders + enough inside
 *  fielders to reach `total` players (default 11). */
function buildField(outside: FielderPosition[], total = 11): FielderPosition[] {
  const all = [KEEPER, BOWLER, ...outside];
  const pool = [INSIDE_A, INSIDE_B, INSIDE_C, INSIDE_D];
  const fillers: FielderPosition[] = [];
  let i = 0;
  while (all.length + fillers.length < total) {
    const p = pool[i % pool.length];
    fillers.push(mkFielder(`inside_${i}`, p.x, p.y, 'Batsman'));
    i++;
  }
  return [...all, ...fillers];
}

describe('FieldingRestrictionEngine — circle geometry', () => {
  it('matches the visualizer inner-circle ellipse (rx=160, ry=190)', () => {
    expect(INNER_CIRCLE.rx).toBe(160);
    expect(INNER_CIRCLE.ry).toBe(190);
    expect(isOutsideCircle(300, 300)).toBe(false); // centre
    expect(isOutsideCircle(200, 300)).toBe(false); // 100 units left, inside
    expect(isOutsideCircle(300, 200)).toBe(false); // 100 units up, inside (rx/ry differ)
  });

  it('classifies points outside the 30-yard ellipse correctly', () => {
    expect(isOutsideCircle(90, 300)).toBe(true);
    expect(isOutsideCircle(300, 510)).toBe(true);
    expect(isOutsideCircle(300, 260)).toBe(false); // keeper ring
    expect(isOutsideCircle(120, 120)).toBe(true);
  });

  it('converts ball counts to 1-indexed overs', () => {
    expect(overFromBalls(0)).toBe(1);
    expect(overFromBalls(5)).toBe(1);
    expect(overFromBalls(6)).toBe(2);
    expect(overFromBalls(120)).toBe(21);
  });
});

describe('FieldingRestrictionEngine — phase resolution', () => {
  it('T20 powerplay is overs 1-6 with a 2-outside limit', () => {
    const p = getFieldingPhase('T20', 1);
    expect(p.key).toBe('POWERPLAY');
    expect(p.maxOutsideCircle).toBe(2);
    expect(p.restricted).toBe(true);
  });

  it('recalculates at the T20 phase boundary (over 6 vs 7)', () => {
    expect(getFieldingPhase('T20', 6).maxOutsideCircle).toBe(2);
    expect(getFieldingPhase('T20', 7).maxOutsideCircle).toBe(5);
    expect(getFieldingPhase('T20', 7).key).toBe('MIDDLE');
    expect(getFieldingPhase('T20', 20).maxOutsideCircle).toBe(5);
  });

  it('ODI phases: 1-10 => 2, 11-40 => 4, 41-50 => 5', () => {
    expect(getFieldingPhase('ODI', 1).maxOutsideCircle).toBe(2);
    expect(getFieldingPhase('ODI', 10).maxOutsideCircle).toBe(2);
    expect(getFieldingPhase('ODI', 11).maxOutsideCircle).toBe(4);
    expect(getFieldingPhase('ODI', 40).maxOutsideCircle).toBe(4);
    expect(getFieldingPhase('ODI', 41).maxOutsideCircle).toBe(5);
    expect(getFieldingPhase('ODI', 50).maxOutsideCircle).toBe(5);
  });

  it('Test cricket has no limited-overs circle restriction', () => {
    const p = getFieldingPhase('TEST', 10);
    expect(p.restricted).toBe(false);
    expect(getFieldingPhase('TEST', 80).restricted).toBe(false);
  });

  it('IPL inherits the T20 restriction table', () => {
    const t20 = getFieldingRestrictions('T20');
    const ipl = getFieldingRestrictions('IPL');
    expect(ipl).toEqual(t20);
    expect(iplRules.format).toBe('IPL');
  });
});

describe('FieldingRestrictionEngine — validation', () => {
  it('T20 powerplay with exactly 2 outside is VALID', () => {
    const field = buildField([OUTSIDE_A, OUTSIDE_B], 11);
    const res = validateField({ format: 'T20', over: 1, fielders: field });
    expect(res.valid).toBe(true);
    expect(res.outsideCircleCount).toBe(2);
    expect(res.maxOutsideCircle).toBe(2);
  });

  it('T20 powerplay with 3 outside is REJECTED with a corrective message', () => {
    const field = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C], 11);
    const res = validateField({ format: 'T20', over: 1, fielders: field });
    expect(res.valid).toBe(false);
    expect(res.outsideCircleCount).toBe(3);
    const v = res.violations.find((x) => x.code === 'TOO_MANY_OUTSIDE');
    expect(v).toBeDefined();
    expect(res.message).toContain('maximum 2');
    expect(res.message).toContain('Move 1 fielder inside');
    expect(v?.fielderIds?.length).toBe(3);
  });

  it('T20 middle/death overs with 5 outside is VALID, 6 outside is REJECTED', () => {
    const five = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D, OUTSIDE_E], 11);
    const six = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D, OUTSIDE_E, OUTSIDE_F], 11);
    expect(validateField({ format: 'T20', over: 10, fielders: five }).valid).toBe(true);
    const res6 = validateField({ format: 'T20', over: 10, fielders: six });
    expect(res6.valid).toBe(false);
    expect(res6.outsideCircleCount).toBe(6);
  });

  it('ODI enforces 2 / 4 / 5 outside across its three phases', () => {
    const four = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D], 11);
    const five = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D, OUTSIDE_E], 11);
    // Overs 1-10: only 2 allowed -> 4 outside rejected
    expect(validateField({ format: 'ODI', over: 5, fielders: four }).valid).toBe(false);
    // Overs 11-40: 4 allowed
    expect(validateField({ format: 'ODI', over: 20, fielders: four }).valid).toBe(true);
    // Overs 41-50: 5 allowed, 6 rejected
    expect(validateField({ format: 'ODI', over: 45, fielders: five }).valid).toBe(true);
    expect(validateField({ format: 'ODI', over: 45, fielders: buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D, OUTSIDE_E, OUTSIDE_F], 11) }).valid).toBe(false);
  });

  it('Test cricket permits many deep fielders (no powerplay restriction)', () => {
    const field = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D, OUTSIDE_E, OUTSIDE_F], 11);
    const res = validateField({ format: 'TEST', over: 10, fielders: field });
    expect(res.valid).toBe(true);
    expect(res.phase.restricted).toBe(false);
  });

  it('rejects a wrong player count with an explicit message', () => {
    const res = validateField({ format: 'T20', over: 1, fielders: [KEEPER, BOWLER, OUTSIDE_A] });
    expect(res.valid).toBe(false);
    const v = res.violations.find((x) => x.code === 'INVALID_PLAYER_COUNT');
    expect(v).toBeDefined();
    expect(v?.message).toContain(`exactly ${MAX_FIELDING_SIDE} active players`);
  });

  it('accepts an invalid drag/preset only as a rejected draft (never silent)', () => {
    // Simulate a user dragging a fielder from the ring to deep in the powerplay.
    const dragged = buildField([OUTSIDE_A, OUTSIDE_B], 11).map((f) =>
      f.id === 'inside_0' ? { ...f, x: 80, y: 300 } : f
    );
    const res = validateField({ format: 'T20', over: 2, fielders: dragged });
    expect(res.valid).toBe(false);
    expect(res.outsideCircleCount).toBe(3);
    expect(res.outsideFielderIds).toContain('inside_0');
    expect(res.message).toMatch(/Move \d+ fielder/);
  });

  it('honours competition-specific overrides', () => {
    const strict = [{ startOver: 1, endOver: 20, maxOutsideCircle: 3 }];
    const four = buildField([OUTSIDE_A, OUTSIDE_B, OUTSIDE_C, OUTSIDE_D], 11);
    expect(validateField({ format: 'T20', over: 12, fielders: four }).valid).toBe(true); // default 5
    expect(validateField({ format: 'T20', over: 12, fielders: four, options: { overrides: strict } }).valid).toBe(false);
    expect(getFieldingPhase('T20', 12, strict).maxOutsideCircle).toBe(3);
  });

  it('isFieldLegal mirrors full validation outside-count checks', () => {
    expect(isFieldLegal('T20', 1, 2)).toBe(true);
    expect(isFieldLegal('T20', 1, 3)).toBe(false);
    expect(isFieldLegal('TEST', 10, 9)).toBe(true);
  });
});

describe('FieldingRestrictionEngine — display', () => {
  it('formats the compact circle status badge', () => {
    expect(getRestrictionSummary(getFieldingPhase('T20', 1), 2)).toBe('POWERPLAY · Outside circle: 2/2');
    expect(getRestrictionSummary(getFieldingPhase('ODI', 20), 4)).toBe('MIDDLE OVERS · Outside circle: 4/4');
    expect(getRestrictionSummary(getFieldingPhase('TEST', 5), 6)).toBe('TEST · No circle restriction');
  });

  it('boundary radius constant matches the field canvas', () => {
    expect(BOUNDARY_RADIUS).toBe(268);
  });
});
