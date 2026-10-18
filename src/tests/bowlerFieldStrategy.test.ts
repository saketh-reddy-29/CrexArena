import { describe, it, expect } from 'vitest';
import { 
  BowlerFieldStrategyEngine, 
  CANONICAL_POSITIONS 
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { PitchType, WeatherCondition } from '../types/match';
import { Player } from '../types/common';

const mockBowlerFast: Player = {
  id: 'b_bumrah',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Fast',
  stats: { bowling: 95 },
  rating: 94,
} as any;

const mockBowlerSpin: Player = {
  id: 'b_ashwin',
  name: 'Ravichandran Ashwin',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Off-break',
  stats: { bowling: 92 },
  rating: 91,
} as any;

const mockStrikerRight: Player = {
  id: 'bat_virat',
  name: 'Virat Kohli',
  role: 'Batsman',
  battingHand: 'Right',
  stats: { batting: 96 },
  rating: 95,
} as any;

const mockStrikerLeft: Player = {
  id: 'bat_pant',
  name: 'Rishabh Pant',
  role: 'Batsman',
  battingHand: 'Left',
  stats: { batting: 89 },
  rating: 88,
} as any;

describe('BowlerFieldStrategyEngine - Format Engine Verification', () => {
  // ── 1. T20 Engine Tests ──
  describe('T20 Engine Phases', () => {
    it('generates compliant T20 Powerplay field (Overs 0-5) with max 2 outside circle', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'T20',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 2,
        balls: 3,
        wickets: 0,
        runs: 18,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.format).toBe('T20');
      expect(config.phase).toContain('Powerplay');
      expect(config.maxOutsideCircle).toBe(2);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(2);
      expect(config.isCompliant).toBe(true);
      expect(config.fielders.length).toBe(11); // Exactly 11 fielders: Bowler + Keeper + 9 outfielders
      expect(config.fielders.some(f => f.positionKey === 'BOWLER')).toBe(true);
      expect(config.fielders.some(f => f.positionKey === 'WICKETKEEPER')).toBe(true);
    });

    it('generates compliant T20 Middle overs field (Overs 6-15) with max 5 outside circle', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'T20',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 10,
        balls: 2,
        wickets: 2,
        runs: 82,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.phase).toContain('Middle Overs');
      expect(config.maxOutsideCircle).toBe(5);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(5);
      expect(config.isCompliant).toBe(true);
    });

    it('generates T20 Death overs field (Overs 16-20) with boundary protection shield', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'T20',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 18,
        balls: 4,
        wickets: 5,
        runs: 165,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.phase).toContain('Death Overs');
      expect(config.name).toContain('Death Yorker Shield');
      expect(config.bowlingPlan.length).toBe('YORKER');
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(5);
    });
  });

  // ── 2. ODI Engine Tests ──
  describe('ODI Engine Phases', () => {
    it('generates compliant ODI Powerplay 1 field (Overs 0-9) with max 2 outside circle and slip cordon', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'ODI',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 4,
        balls: 1,
        wickets: 1,
        runs: 22,
        pitch: PitchType.PACE,
        weather: WeatherCondition.CLOUDY,
      });

      expect(config.format).toBe('ODI');
      expect(config.phase).toContain('Powerplay 1');
      expect(config.maxOutsideCircle).toBe(2);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(2);
      expect(config.isCompliant).toBe(true);
      // Catchers should be present in early overs
      const catchingFielders = config.fielders.filter(f => f.isCatching);
      expect(catchingFielders.length).toBeGreaterThanOrEqual(1);
    });

    it('generates compliant ODI Middle overs field (Overs 10-39) with max 4 outside circle', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'ODI',
        bowler: mockBowlerSpin,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 25,
        balls: 0,
        wickets: 3,
        runs: 130,
        pitch: PitchType.SPIN,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.phase).toContain('Middle Overs');
      expect(config.maxOutsideCircle).toBe(4);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(4);
      expect(config.isCompliant).toBe(true);
    });

    it('generates compliant ODI Death overs field (Overs 40-49) with max 5 outside circle', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'ODI',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 45,
        balls: 3,
        wickets: 6,
        runs: 280,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.phase).toContain('Death Overs');
      expect(config.maxOutsideCircle).toBe(5);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(5);
      expect(config.isCompliant).toBe(true);
    });
  });

  // ── 3. Test Engine Tests ──
  describe('Test Engine Tactics', () => {
    it('generates Test new-ball attacking slip cordon with close catchers', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'TEST',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 4,
        balls: 2,
        wickets: 0,
        runs: 12,
        pitch: PitchType.PACE,
        weather: WeatherCondition.CLOUDY,
        testDaySession: { day: 1, session: 'Morning' },
        ballAgeOvers: 4,
      });

      expect(config.format).toBe('TEST');
      expect(config.name).toContain('Slip Cordon');
      expect(config.bowlingPlan.intent).toBe('WICKET_TAKING');
      // Slip cordon should be densely packed (slips + gully)
      const slipsAndGully = config.fielders.filter(f => 
        f.positionName.includes('Slip') || f.positionName.includes('Gully')
      );
      expect(slipsAndGully.length).toBeGreaterThanOrEqual(3);
    });

    it('generates Test spin bat-pad trap on turning/slow pitch with close catchers', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'TEST',
        bowler: mockBowlerSpin,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 55,
        balls: 0,
        wickets: 4,
        runs: 180,
        pitch: PitchType.SPIN,
        weather: WeatherCondition.SUNNY,
        testDaySession: { day: 4, session: 'Afternoon' },
        ballAgeOvers: 55,
      });

      expect(config.name).toContain('Bat-Pad Trap');
      expect(config.phase).toContain('Spin Trap');
      const closeCatchers = config.fielders.filter(f => 
        f.positionName.includes('Short Leg') || 
        f.positionName.includes('Silly Point') || 
        f.positionName.includes('Leg Slip') ||
        f.positionName.includes('Slip')
      );
      expect(closeCatchers.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── 4. Left-Handed Batter Mirroring ──
  describe('Left-Handed Batter Mirroring', () => {
    it('mirrors slip cordon across the stumps axis (x=300) for left-handed batters', () => {
      const configRight = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'TEST',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 5,
        balls: 0,
        wickets: 0,
        runs: 15,
        pitch: PitchType.PACE,
        weather: WeatherCondition.SUNNY,
      });

      const configLeft = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'TEST',
        bowler: mockBowlerFast,
        striker: mockStrikerLeft,
        nonStriker: null,
        overs: 5,
        balls: 0,
        wickets: 0,
        runs: 15,
        pitch: PitchType.PACE,
        weather: WeatherCondition.SUNNY,
      });

      const slipRight = configRight.fielders.find(f => f.positionName.includes('1st Slip'));
      const slipLeft = configLeft.fielders.find(f => f.positionName.includes('1st Slip'));

      expect(slipRight).toBeDefined();
      expect(slipLeft).toBeDefined();

      if (slipRight && slipLeft) {
        // Right hander 1st slip is on off-side (x < 300)
        expect(slipRight.targetPos.x).toBeLessThan(300);
        // Left hander 1st slip is mirrored to x > 300
        expect(slipLeft.targetPos.x).toBeGreaterThan(300);
        // Sum of x coordinates equals 600
        expect(Math.round(slipRight.targetPos.x + slipLeft.targetPos.x)).toBe(600);
      }
    });
  });

  // ── 5. Recalculation Triggers ──
  describe('Recalculation Triggers', () => {
    it('correctly triggers field recalculation on bowler change or over completion', () => {
      expect(BowlerFieldStrategyEngine.shouldRecalculateField(
        null, 0, 0, 'b1', 'b1', false, false, false
      )).toBe(true);

      expect(BowlerFieldStrategyEngine.shouldRecalculateField(
        {} as any, 1.0, 0.5, 'b1', 'b2', false, false, false
      )).toBe(true); // Bowler change

      expect(BowlerFieldStrategyEngine.shouldRecalculateField(
        {} as any, 2.0, 1.0, 'b1', 'b1', false, false, false
      )).toBe(true); // Over completed

      expect(BowlerFieldStrategyEngine.shouldRecalculateField(
        {} as any, 1.2, 1.1, 'b1', 'b1', true, false, false
      )).toBe(true); // Wicket fell

      expect(BowlerFieldStrategyEngine.shouldRecalculateField(
        {} as any, 1.3, 1.2, 'b1', 'b1', false, false, false
      )).toBe(false); // Normal dot or single does not churn all fielders
    });
  });

  // ── 6. Boundary Constraint Verification ──
  describe('Ground Geometry & Safety', () => {
    it('verifies all canonical and assigned positions remain within boundary radius (R=268)', () => {
      Object.values(CANONICAL_POSITIONS).forEach((pos) => {
        const distFromCenter = Math.hypot(pos.x - 300, pos.y - 300);
        expect(distFromCenter).toBeLessThanOrEqual(268);
      });
    });

    it('computes 8 angular scoring zones with risk analysis', () => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: 'T20',
        bowler: mockBowlerFast,
        striker: mockStrikerRight,
        nonStriker: null,
        overs: 8,
        balls: 0,
        wickets: 1,
        runs: 60,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
      });

      expect(config.scoringZones.length).toBe(8);
      config.scoringZones.forEach(z => {
        expect(['COVERED', 'OPEN']).toContain(z.protection);
        expect(['LOW', 'MEDIUM', 'HIGH']).toContain(z.riskLevel);
      });
    });
  });
});
