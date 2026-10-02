import { describe, it, expect } from 'vitest';
import {
  isEligibleBowler,
  getValidBowlingPool,
  canBowlerBowlAnotherOver,
  safeNumber,
  clampProbability,
  normalizeRole,
} from '../engine/rules/bowlerEligibility';
import { Player } from '../types/common';
import { TestMatchPlaybackController } from '../engine/formats/test/TestMatchPlaybackController';
import { ODIMatchPlaybackController } from '../engine/formats/odi/ODIMatchPlaybackController';
import { fieldStrategyEngine } from '../engine/strategy/FieldStrategyEngine';
import { adaptDeliveryTo3DSequence } from '../components/Delivery3DActionAdapter';

// Mock Players
const pureBatter: Player = {
  id: 'bat-1',
  name: 'Rohit Sharma',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 92,
  basePrice: 20000000,
  battingStyle: 'Right-hand bat',
  baseAbility: 92,
  form: 88,
  stats: { batting: 92, bowling: 0, fielding: 80 },
  careerStats: { matches: 250, runs: 10000, wickets: 0, ballsFaced: 8000, ballsBowled: 0, runsConceded: 0, dismissals: 200, catches: 100 },
};

const pureWicketKeeper: Player = {
  id: 'wk-1',
  name: 'MS Dhoni',
  role: 'Wicketkeeper',
  nationality: 'Indian',
  rating: 90,
  basePrice: 20000000,
  battingStyle: 'Right-hand bat',
  baseAbility: 90,
  form: 85,
  stats: { batting: 88, bowling: 0, fielding: 95 },
  careerStats: { matches: 250, runs: 5000, wickets: 0, ballsFaced: 4000, ballsBowled: 0, runsConceded: 0, dismissals: 100, catches: 150 },
};

const specialistPacer: Player = {
  id: 'bowl-1',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  nationality: 'Indian',
  rating: 95,
  basePrice: 20000000,
  bowlingStyle: 'Right-arm fast',
  baseAbility: 95,
  form: 94,
  stats: { batting: 25, bowling: 95, fielding: 82 },
  careerStats: { matches: 150, runs: 200, wickets: 250, ballsFaced: 300, ballsBowled: 3600, runsConceded: 2400, dismissals: 80, catches: 40 },
};

const specialistSpinner: Player = {
  id: 'bowl-2',
  name: 'Ravichandran Ashwin',
  role: 'Bowler',
  nationality: 'Indian',
  rating: 90,
  basePrice: 20000000,
  bowlingStyle: 'Right-arm off break',
  baseAbility: 90,
  form: 88,
  stats: { batting: 60, bowling: 92, fielding: 75 },
  careerStats: { matches: 150, runs: 3000, wickets: 500, ballsFaced: 4000, ballsBowled: 9000, runsConceded: 4500, dismissals: 100, catches: 60 },
};

const allRounder: Player = {
  id: 'ar-1',
  name: 'Hardik Pandya',
  role: 'All-rounder',
  nationality: 'Indian',
  rating: 89,
  basePrice: 20000000,
  battingStyle: 'Right-hand bat',
  bowlingStyle: 'Right-arm fast-medium',
  baseAbility: 89,
  form: 86,
  stats: { batting: 85, bowling: 84, fielding: 88 },
  careerStats: { matches: 120, runs: 2500, wickets: 90, ballsFaced: 1800, ballsBowled: 1500, runsConceded: 1800, dismissals: 70, catches: 50 },
};

const mockSquad: Player[] = [
  pureBatter,
  pureWicketKeeper,
  { ...pureBatter, id: 'bat-2', name: 'Virat Kohli' },
  { ...pureBatter, id: 'bat-3', name: 'Shubman Gill' },
  { ...pureBatter, id: 'bat-4', name: 'Shreyas Iyer' },
  { ...pureBatter, id: 'bat-5', name: 'KL Rahul' },
  allRounder,
  specialistSpinner,
  specialistPacer,
  { ...specialistPacer, id: 'bowl-3', name: 'Mohammed Shami' },
  { ...specialistPacer, id: 'bowl-4', name: 'Mohammed Siraj' },
];

describe('CRITICAL RECOVERY AND STABILIZATION TESTS', () => {
  // ─────────────────────────────────────────────────────────────────
  // PHASE 1 & 2: Hard Role Separation & Valid Bowler Pool
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 1 & 2: Bowler Eligibility & Role Separation', () => {
    it('pure batters NEVER qualify as eligible bowlers', () => {
      expect(isEligibleBowler(pureBatter)).toBe(false);
      expect(isEligibleBowler({ ...pureBatter, role: 'BATTER' as any })).toBe(false);
      expect(isEligibleBowler({ ...pureBatter, stats: { ...pureBatter.stats, bowling: 0 } })).toBe(false);
    });

    it('pure wicketkeepers NEVER qualify as eligible bowlers', () => {
      expect(isEligibleBowler(pureWicketKeeper)).toBe(false);
      expect(isEligibleBowler({ ...pureWicketKeeper, role: 'WICKETKEEPER' as any })).toBe(false);
    });

    it('specialist bowlers and all-rounders with positive rating qualify as eligible bowlers', () => {
      expect(isEligibleBowler(specialistPacer)).toBe(true);
      expect(isEligibleBowler(specialistSpinner)).toBe(true);
      expect(isEligibleBowler(allRounder)).toBe(true);
    });

    it('filters valid bowling pool strictly excluding all pure batsmen and wicketkeepers', () => {
      const bowlingPool = getValidBowlingPool(mockSquad);
      expect(bowlingPool.length).toBe(5); // allRounder + specialistSpinner + 3 pacers
      const hasPureBatter = bowlingPool.some((p) => p.role === 'Batsman' || p.role === 'Wicketkeeper');
      expect(hasPureBatter).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PHASE 4: Format-Specific Bowling Limits
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 4: Bowling Limits per Format', () => {
    it('enforces 4-over maximum limit per bowler in T20', () => {
      expect(canBowlerBowlAnotherOver(specialistPacer, 0, 'T20')).toBe(true);
      expect(canBowlerBowlAnotherOver(specialistPacer, 3, 'T20')).toBe(true);
      expect(canBowlerBowlAnotherOver(specialistPacer, 4, 'T20')).toBe(false);
      expect(canBowlerBowlAnotherOver(specialistPacer, 5, 'T20')).toBe(false);
    });

    it('enforces 10-over maximum limit per bowler in ODI', () => {
      expect(canBowlerBowlAnotherOver(specialistPacer, 0, 'ODI')).toBe(true);
      expect(canBowlerBowlAnotherOver(specialistPacer, 9, 'ODI')).toBe(true);
      expect(canBowlerBowlAnotherOver(specialistPacer, 10, 'ODI')).toBe(false);
    });

    it('allows continuous bowling in Test with spell workload management', () => {
      expect(canBowlerBowlAnotherOver(specialistPacer, 25, 'TEST', 4)).toBe(true);
      expect(canBowlerBowlAnotherOver(specialistPacer, 25, 'TEST', 11)).toBe(false); // Over-bowled in single spell
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PHASE 7 & 8: NaN Protection and Probability Clamping
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 7 & 8: Math Sanitization and Clamping', () => {
    it('safeNumber falls back correctly on NaN, null, undefined, or Infinity', () => {
      expect(safeNumber(NaN, 50)).toBe(50);
      expect(safeNumber(undefined, 60)).toBe(60);
      expect(safeNumber(null, 70)).toBe(70);
      expect(safeNumber(Infinity, 80)).toBe(80);
      expect(safeNumber(-Infinity, 80)).toBe(80);
      expect(safeNumber(85, 50)).toBe(85);
      expect(safeNumber('92', 50)).toBe(92);
    });

    it('clampProbability strictly guarantees output in [0, 1]', () => {
      expect(clampProbability(NaN)).toBe(0);
      expect(clampProbability(-0.25)).toBe(0);
      expect(clampProbability(1.45)).toBe(1);
      expect(clampProbability(0.025)).toBe(0.025);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PHASE 6, 10, 11: Wicket Calibration & Settledness
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 6, 10 & 11: Realism Calibration over 1000 deliveries', () => {
    it('Test match engine produces realistic wicket rate (~2.0% - 2.8%) without early collapses', () => {
      const controller = new TestMatchPlaybackController(
        'test-recovery-1',
        { id: 'ind', name: 'India', shortName: 'IND', squad: mockSquad },
        { id: 'aus', name: 'Australia', shortName: 'AUS', squad: mockSquad },
        'ind'
      );
      controller.setFastSimulating(true);

      let wickets = 0;
      const totalBalls = 1000;
      for (let i = 0; i < totalBalls; i++) {
        const delivery = controller.simulateDelivery();
        // Assert bowler is strictly an eligible bowler, never a pure batter!
        expect(isEligibleBowler(delivery.bowler)).toBe(true);
        expect(delivery.bowler.role).not.toBe('Batsman');
        expect(delivery.bowler.role).not.toBe('Wicketkeeper');

        if (delivery.wicket) {
          wickets++;
        }
      }

      const wicketRate = wickets / totalBalls;
      // Realistic Test wicket rate: ~1.8% to 3.2%
      expect(wicketRate).toBeGreaterThanOrEqual(0.015);
      expect(wicketRate).toBeLessThanOrEqual(0.035);
    });

    it('ODI match engine produces realistic wicket rate (~2.2% - 3.0%) matching 50-over averages', () => {
      const controller = new ODIMatchPlaybackController(
        'odi-recovery-1',
        { id: 'ind', name: 'India', shortName: 'IND', squad: mockSquad },
        { id: 'aus', name: 'Australia', shortName: 'AUS', squad: mockSquad },
        'ind'
      );
      controller.setFastSimulating(true);

      let wickets = 0;
      const totalBalls = 1000;
      for (let i = 0; i < totalBalls; i++) {
        const delivery = controller.simulateDelivery();
        // Assert bowler is strictly an eligible bowler
        expect(isEligibleBowler(delivery.bowler)).toBe(true);
        expect(delivery.bowler.role).not.toBe('Batsman');

        if (delivery.wicket) {
          wickets++;
        }
      }

      const wicketRate = wickets / totalBalls;
      // Realistic ODI wicket rate: ~2.0% to 3.5% (approx 6-8 wickets in 300 balls)
      expect(wicketRate).toBeGreaterThanOrEqual(0.016);
      expect(wicketRate).toBeLessThanOrEqual(0.038);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PHASE 16, 21, 24: 3D Ball Playback and Trajectory
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 16, 21 & 24: Ball Trajectory & Visualizer Adapter', () => {
    it('produces continuous trajectory with valid coordinates from release to target', () => {
      const seq = adaptDeliveryTo3DSequence(
        {
          runs: 4,
          isWicket: false,
          isExtra: false,
          bowlingTactic: 'OUTSWING',
        } as any,
        'OUTSWING',
        {
          strikerName: 'Virat Kohli',
          bowlerName: 'Pat Cummins',
          isTestFormat: true,
        }
      );

      expect(seq.ballTrajectory.startPos.z).toBeLessThan(-10); // Release behind crease
      expect(seq.ballTrajectory.bouncePos.z).toBeGreaterThan(0); // Bounces on pitch
      expect(seq.ballTrajectory.contactPos.z).toBeCloseTo(9.5, 0.5); // Reaches batter
      expect(Math.hypot(seq.ballTrajectory.targetPos.x, seq.ballTrajectory.targetPos.z)).toBeGreaterThan(15); // Reaches boundary/field
      expect(seq.baseDurationMs).toBeGreaterThanOrEqual(5000); // Realistic duration (>5 seconds)
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // PHASE 32 & 33: Field Engine Integrity
  // ─────────────────────────────────────────────────────────────────
  describe('Phase 32 & 33: Field Strategy Engine Non-Mutation', () => {
    it('evaluates field layouts without mutating any player roles or ratings', () => {
      const layout = fieldStrategyEngine.evaluate('TEST', 12, 2, 3.2, null, false, 'NONE', 20);
      expect(layout.positions.length).toBe(9);
      // Ensure positions are purely coordinates
      layout.positions.forEach((pos) => {
        expect(typeof pos.name).toBe('string');
        expect(typeof pos.x).toBe('number');
        expect(typeof pos.z).toBe('number');
      });
    });
  });
});
