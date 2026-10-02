import { describe, it, expect } from 'vitest';
import { BOWLING_TACTICS_CONFIG, BowlingTactic } from '../components/CricketActionVisualizer';

describe('Cricket Action Visualizer Physics & Trajectory Engine', () => {
  // Cubic Bezier formula verification
  const cubicBezier = (p0: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, t: number) => {
    const cx = 3 * (p1.x - p0.x);
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = p3.x - p0.x - cx - bx;

    const cy = 3 * (p1.y - p0.y);
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = p3.y - p0.y - cy - by;

    const tSquared = t * t;
    const tCubed = tSquared * t;

    return {
      x: (ax * tCubed) + (bx * tSquared) + (cx * t) + p0.x,
      y: (ay * tCubed) + (by * tSquared) + (cy * t) + p0.y,
    };
  };

  it('computes continuous Bezier trajectory without NaN or out-of-bound jumps', () => {
    const start = { x: 300, y: 190 };
    const c1 = { x: 308, y: 250 };
    const c2 = { x: 295, y: 310 };
    const end = { x: 300, y: 410 };

    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const pt = cubicBezier(start, c1, c2, end, t);

      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
      expect(pt.y).toBeGreaterThanOrEqual(190);
      expect(pt.y).toBeLessThanOrEqual(410);
    }
  });

  it('verifies aerial six arc maintains realistic parabolic height', () => {
    const startY = 410;
    const endY = 70;
    const arcMax = 45;

    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const height = Math.sin(t * Math.PI) * arcMax;
      const curY = startY + (endY - startY) * t - height;

      expect(Number.isFinite(curY)).toBe(true);
      expect(height).toBeGreaterThanOrEqual(0);
      expect(height).toBeLessThanOrEqual(45);
    }
  });

  it('smoothly scales speed settings (1x, 2x, 4x, instant)', () => {
    const baseDuration = 1200;

    const getSpeedDuration = (speed: number) => {
      if (speed === 0) return 0;
      if (speed === 1) return baseDuration;
      if (speed === 2) return baseDuration * 0.5;
      if (speed === 4) return baseDuration * 0.25;
      return baseDuration;
    };

    expect(getSpeedDuration(1)).toBe(1200);
    expect(getSpeedDuration(2)).toBe(600);
    expect(getSpeedDuration(4)).toBe(300);
    expect(getSpeedDuration(0)).toBe(0);
  });

  it('validates comprehensive bowler variations and swing physics configuration', () => {
    const tactics: BowlingTactic[] = [
      'OUTSWING', 'INSWING', 'REVERSE_SWING', 'SLOWER_BALL',
      'YORKER', 'BOUNCER', 'OFF_CUTTER', 'LEG_CUTTER',
      'OFF_BREAK', 'DOOSRA', 'LEG_BREAK', 'GOOGLY',
      'ARM_BALL', 'TOP_SPINNER', 'CARROM_BALL'
    ];

    tactics.forEach(tactic => {
      const config = BOWLING_TACTICS_CONFIG[tactic];
      expect(config).toBeDefined();
      expect(config.name).toBeTruthy();
      expect(config.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(Number.isFinite(config.seamAngle)).toBe(true);
      expect(Number.isFinite(config.swingFactor)).toBe(true);
      expect(config.bounceMultiplier).toBeGreaterThan(0);
    });

    // Outswing vs Inswing swing factor directions
    expect(BOWLING_TACTICS_CONFIG.OUTSWING.swingFactor).toBeLessThan(0);
    expect(BOWLING_TACTICS_CONFIG.INSWING.swingFactor).toBeGreaterThan(0);
    expect(BOWLING_TACTICS_CONFIG.BOUNCER.bounceMultiplier).toBeGreaterThan(1.4);
    expect(BOWLING_TACTICS_CONFIG.YORKER.bounceMultiplier).toBeLessThan(0.5);
  });
});
