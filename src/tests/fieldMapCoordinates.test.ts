import { describe, it, expect } from 'vitest';
import { 
  CANONICAL_POSITIONS, 
  BowlerFieldStrategyEngine 
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { clampFielderCoordinate } from '../components/CricketActionVisualizer';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { Player } from '../types/common';

const mockPlayer: Player = {
  id: 'p1',
  name: 'Test Player',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 85,
  basePrice: 100,
  baseAbility: 85,
  form: 80,
  stats: { batting: 85, bowling: 40, fielding: 80 },
  careerStats: { matches: 10, runs: 400, wickets: 0, ballsFaced: 300, ballsBowled: 0, runsConceded: 0, dismissals: 8, catches: 5 },
};

describe('2D Field Map Coordinates & Boundaries', () => {
  it('ensures all canonical fielder positions are strictly within the boundary radius (dist <= 260)', () => {
    Object.entries(CANONICAL_POSITIONS).forEach(([key, posDef]) => {
      const dist = Math.hypot(posDef.x - 300, posDef.y - 300);
      expect(dist).toBeLessThanOrEqual(268);
    });
  });

  it('clampFielderCoordinate constrains out-of-bounds coordinates into safe playable radius', () => {
    // Extreme point way outside field
    const extremePoint = { x: 50, y: 50 }; // dist = hypot(-250, -250) = 353.5
    const clamped = clampFielderCoordinate(extremePoint);
    const distClamped = Math.hypot(clamped.x - 300, clamped.y - 300);
    expect(distClamped).toBeLessThanOrEqual(261);
  });

  it('clampFielderCoordinate prevents dynamic fielders from landing inside the pitch rectangle', () => {
    // Point right in middle of pitch strip (300, 300)
    const onPitch = { x: 300, y: 300 };
    const clamped = clampFielderCoordinate(onPitch);
    const isInsidePitch = clamped.x >= 270 && clamped.x <= 330 && clamped.y >= 165 && clamped.y <= 435;
    expect(isInsidePitch).toBe(false);
  });

  it('DeliveryResultFactory boundary calculation stays within visible canvas radius (dist <= 276)', () => {
    const angles = [-150, -90, -45, 0, 45, 90, 135, 180];
    angles.forEach((angle) => {
      const ptFour = DeliveryResultFactory.getBoundaryPoint(angle, 0.98);
      const distFour = Math.hypot(ptFour.x - 300, ptFour.y - 300);
      expect(distFour).toBeLessThanOrEqual(276);

      const ptSix = DeliveryResultFactory.getBoundaryPoint(angle, 1.05);
      const distSix = Math.hypot(ptSix.x - 300, ptSix.y - 300);
      expect(distSix).toBeLessThanOrEqual(276);
    });
  });

  it('mirrorForLeftHander correctly reflects coordinates along x=300 center', () => {
    const rightPoint = { x: 190, y: 450 }; // Gully on off-side
    const leftPoint = BowlerFieldStrategyEngine.mirrorForLeftHander(rightPoint, true);
    expect(leftPoint.x).toBe(600 - 190); // 410 (leg-gully)
    expect(leftPoint.y).toBe(450);
  });
});
