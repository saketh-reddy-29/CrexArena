import { describe, expect, it } from 'vitest';
import { CRICKET_ARENA_ACTIONS, getCricketArenaPose } from '../lib/cricketArenaAnimations';

describe('cricket arena rigged actions', () => {
  it('produces complete finite poses for every migrated action across its timeline', () => {
    CRICKET_ARENA_ACTIONS.forEach((action) => {
      [0, 0.25, 0.5, 0.75, 1].forEach((progress) => {
        const pose = getCricketArenaPose(action, progress, 1.2);
        expect(Object.values(pose).every(Number.isFinite), `${action} at ${progress}`).toBe(true);
      });
    });
  });

  it('keeps the original shot selection distinct for sweeps and lofted shots', () => {
    expect(getCricketArenaPose('reverseSweep', 0.5, 0).ba).toBeLessThan(0);
    expect(getCricketArenaPose('lofted', 0.5, 0).by).toBeGreaterThan(1);
  });
});
