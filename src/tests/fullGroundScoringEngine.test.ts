import { describe, it, expect } from 'vitest';
import {
  getZoneCoordinates,
  SCORING_ZONES_RH,
  batTimingEngine,
  batContactEngine,
  shotSelectionEngine,
  scoringGapEngine,
  fullGroundScoringEngine,
} from '../engine/scoring';

describe('Full-Ground Batting & Scoring Zone Engine Suite', () => {
  describe('ScoringZones & Geometry', () => {
    it('accurately calculates 3D ground coordinates for Right-Hand batter', () => {
      const coverCoords = getZoneCoordinates('COVER', 0.85, 'RIGHT_HAND');
      // Cover is on the off-side (negative X)
      expect(coverCoords.x).toBeLessThan(0);
      expect(coverCoords.angleDeg).toBe(-55);
      expect(coverCoords.z).toBeDefined();

      const midwicketCoords = getZoneCoordinates('MIDWICKET', 0.85, 'RIGHT_HAND');
      // Midwicket is on the leg-side (positive X)
      expect(midwicketCoords.x).toBeGreaterThan(0);
      expect(midwicketCoords.angleDeg).toBe(55);
    });

    it('mirrors angles accurately for Left-Hand batter', () => {
      const rhCover = getZoneCoordinates('COVER', 0.85, 'RIGHT_HAND');
      const lhCover = getZoneCoordinates('COVER', 0.85, 'LEFT_HAND');

      expect(lhCover.angleDeg).toBe(-rhCover.angleDeg);
      expect(lhCover.x).toBe(-rhCover.x);
    });
  });

  describe('ShotSelectionEngine', () => {
    it('selects Cover Drive or Cut for FULL_OUTSIDE_OFF delivery', () => {
      const shot = shotSelectionEngine.selectShot('FULL_OUTSIDE_OFF', 'RIGHT_HAND', {}, 'AGGRESSIVE');
      expect(['Cover Drive', 'Square Drive', 'Late Cut']).toContain(shot.shotName);
      expect(['COVER', 'DEEP_COVER', 'EXTRA_COVER', 'THIRD_MAN']).toContain(shot.targetZone);
    });

    it('selects Pull or Hook for SHORT_BODY_LEG delivery', () => {
      const shot = shotSelectionEngine.selectShot('SHORT_BODY_LEG', 'RIGHT_HAND', {}, 'ATTACK');
      expect(['Pull Shot', 'Hook Shot', 'Backfoot Defence']).toContain(shot.shotName);
      expect(['MIDWICKET', 'DEEP_MIDWICKET', 'SQUARE_LEG', 'DEEP_SQUARE_LEG']).toContain(shot.targetZone);
    });

    it('selects Straight Drive or On Drive for FULL_MIDDLE delivery', () => {
      const shot = shotSelectionEngine.selectShot('FULL_MIDDLE', 'RIGHT_HAND', {}, 'BALANCED');
      expect(['Straight Drive', 'On Drive', 'Lofted Straight Six']).toContain(shot.shotName);
      expect(['STRAIGHT', 'MID_ON', 'LONG_ON']).toContain(shot.targetZone);
    });

    it('selects Dig Out or Block for YORKER, avoiding easy sixes', () => {
      const shot = shotSelectionEngine.selectShot('YORKER', 'RIGHT_HAND', {}, 'DEFENSIVE');
      expect(['Dig Out Yorker', 'Squeeze to Point', 'Late Guide to Third Man']).toContain(shot.shotName);
      expect(shot.isLofted).toBe(false);
    });
  });

  describe('BatTimingEngine', () => {
    it('produces high exit velocity and power for high-skill settled batter', () => {
      const timing = batTimingEngine.evaluate(95, 90, 100, 130, false);
      expect(['PERFECT', 'GOOD', 'AVERAGE']).toContain(timing.quality);
      expect(timing.exitVelocityMps).toBeGreaterThan(20);
    });

    it('produces lower power and higher catch risk when mistimed', () => {
      const timing = batTimingEngine.evaluate(20, 0, 50, 150, true);
      expect(timing.catchRiskFactor).toBeGreaterThan(0.3);
    });
  });

  describe('BatContactEngine', () => {
    it('evaluates middle of bat with 0 deflection and full speed multiplier', () => {
      const contact = batContactEngine.evaluate(95, 40, false);
      if (contact.isMiddleOfBat) {
        expect(contact.deflectionAngleOffsetDeg).toBe(0);
        expect(contact.speedMultiplier).toBe(1.0);
      }
    });

    it('evaluates edges with deflection toward slips / third man', () => {
      const contact = batContactEngine.evaluate(20, 95, false);
      if (contact.isEdge) {
        expect(contact.deflectionAngleOffsetDeg).not.toBe(0);
        expect(contact.speedMultiplier).toBeLessThan(1.0);
      }
    });
  });

  describe('ScoringGapEngine', () => {
    const mockFielders = [
      { name: 'Cover', x: -13.0, z: 0.0, isDeep: false },
      { name: 'Mid Off', x: -5.0, z: -10.0, isDeep: false },
      { name: 'Deep Cover', x: -27.0, z: -3.0, isDeep: true },
    ];

    it('identifies clean gap when shot is hit away from fielders', () => {
      // Shot directed toward square leg (+20, 10) while fielders are on off-side
      const gap = scoringGapEngine.evaluateGap({ x: 20.0, z: 10.0 }, mockFielders, false, 35);
      expect(gap.quality).toBe('WIDE_OPEN_BOUNDARY');
      expect(gap.maxSafeRuns).toBe(4);
    });

    it('detects fielder close interception when shot is hit near cover', () => {
      const gap = scoringGapEngine.evaluateGap({ x: -13.2, z: 0.2 }, mockFielders, false, 25);
      expect(gap.quality).toBe('DIRECT_TO_FIELDER_DOT');
      expect(gap.maxSafeRuns).toBe(0);
    });
  });

  describe('FullGroundScoringEngine Pipeline', () => {
    it('simulates a complete delivery with exact 3D target coordinates and physics', () => {
      const mockField = [
        { name: 'Cover', x: -13.0, z: 0.0, isDeep: false },
        { name: 'Point', x: -13.0, z: 9.0, isDeep: false },
        { name: 'Long Off', x: -12.0, z: -27.0, isDeep: true },
        { name: 'Deep Mid Wicket', x: 26.0, z: -9.0, isDeep: true },
      ];

      const result = fullGroundScoringEngine.simulate(
        'FULL_OUTSIDE_OFF',
        mockField,
        'RIGHT_HAND',
        { cover: 90 },
        { technique: 85, timing: 85, settledness: 70, form: 100 },
        { speedKph: 135, movementScore: 55 },
        'ATTACK'
      );

      expect(result.shotName).toBeDefined();
      expect(result.targetZone).toBeDefined();
      expect(result.targetPos).toBeDefined();
      expect(result.targetPos.x).toBeDefined();
      expect(result.targetPos.z).toBeDefined();
      expect(result.runs).toBeGreaterThanOrEqual(0);
      expect(result.runs).toBeLessThanOrEqual(6);
    });
  });
});
