import { describe, it, expect, beforeEach } from 'vitest';
import {
  BatterScoringMemory,
  calculateBatterRelativeAngle,
  getCanonicalZoneFromPoint,
  getCanonicalZoneFromAngle,
  mapZoneStringToCanonical,
  HistoricalDeliveryRecord,
} from '../engine/analytics/BatterScoringMemory';
import {
  BowlerFieldStrategyEngine,
  CANONICAL_POSITIONS,
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { AdaptiveCaptainEngine } from '../engine/ai/AdaptiveCaptainEngine';
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

const mockBatterRight: Player = {
  id: 'bat_virat',
  name: 'Virat Kohli',
  role: 'Batsman',
  battingHand: 'Right',
  stats: { batting: 96 },
  rating: 95,
} as any;

const mockBatterLeft: Player = {
  id: 'bat_pant',
  name: 'Rishabh Pant',
  role: 'Batsman',
  battingHand: 'Left',
  stats: { batting: 89 },
  rating: 88,
} as any;

const mockNewBatter: Player = {
  id: 'bat_rookie',
  name: 'Rookie Batter',
  role: 'Batsman',
  battingHand: 'Right',
  stats: { batting: 75 },
  rating: 74,
} as any;

describe('Intelligent Field Placement Engine with Batter Scoring-Zone Analytics', () => {
  beforeEach(() => {
    BatterScoringMemory.clearMemory();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Batter with strong deep-midwicket scoring history receives
  // appropriate field adjustment (e.g. DEEP_MID_WICKET stationed).
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 1: Batter with strong leg-side/midwicket history gets deep midwicket plugged', () => {
    // Record 10 deliveries where batter smashes boundaries to COW_CORNER / MID_WICKET
    for (let i = 0; i < 10; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_leg_${i}`,
        matchId: 'match_1',
        inningsId: 'inn_1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'T20',
        over: 8,
        ballInOver: i % 6,
        phase: 'Middle Overs',
        shotType: 'PULL_SHOT',
        targetZone: 'MID_WICKET_COW',
        canonicalZoneId: 'COW_CORNER',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    const profile = BatterScoringMemory.getBatterProfile(mockBatterRight.id, { format: 'T20', bowlingType: 'PACE' });
    expect(profile.sampleSizeConfidence).not.toBe('INSUFFICIENT');
    expect(profile.topBoundaryZones[0]).toBe('COW_CORNER');

    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      nonStriker: null,
      overs: 8,
      balls: 2,
      wickets: 2,
      runs: 65,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
    });

    // Deep midwicket should be placed and reflected in tacticalIntent
    const hasDeepMidwicket = config.fielders.some(
      f => f.positionKey === 'DEEP_MID_WICKET' || f.positionKey === 'COW_CORNER'
    );
    expect(hasDeepMidwicket).toBe(true);
    expect(config.tacticalIntent.toLowerCase()).toContain('midwicket');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Batter who scores heavily through cover receives a different
  // tactical field (deep cover / cover plugged).
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 2: Batter who scores heavily through cover gets deep cover deployed', () => {
    // Record 12 deliveries where batter scores heavily through COVER
    for (let i = 0; i < 12; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_cov_${i}`,
        matchId: 'match_2',
        inningsId: 'inn_1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'T20',
        over: 9,
        ballInOver: i % 6,
        phase: 'Middle Overs',
        shotType: 'COVER_DRIVE',
        targetZone: 'COVER',
        canonicalZoneId: 'COVER',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    const profile = BatterScoringMemory.getBatterProfile(mockBatterRight.id, { format: 'T20', bowlingType: 'PACE' });
    expect(profile.topBoundaryZones[0]).toBe('COVER');

    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      nonStriker: null,
      overs: 9,
      balls: 3,
      wickets: 1,
      runs: 75,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
    });

    const hasCoverProtection = config.fielders.some(
      f => f.positionKey === 'DEEP_COVER' || f.positionKey === 'COVER'
    );
    expect(hasCoverProtection).toBe(true);
    expect(config.tacticalIntent.toLowerCase()).toContain('cover');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Right-handed and left-handed batters are analysed with correctly
  // oriented zones.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 3: Right-handed and left-handed batters have correctly mirrored angles & coordinates', () => {
    // Point on physical left side of ground (x = 180, y = 350)
    // For RHB: this is off-side (negative angle, point/cover area)
    const angleRight = calculateBatterRelativeAngle({ x: 180, y: 350 }, false);
    const zoneRight = getCanonicalZoneFromPoint({ x: 180, y: 350 }, false);
    expect(angleRight).toBeLessThan(0);
    expect(zoneRight).toBe('COVER_POINT');

    // For LHB: the same coordinate is on the leg-side (positive angle, midwicket / cow corner area)
    const angleLeft = calculateBatterRelativeAngle({ x: 180, y: 350 }, true);
    const zoneLeft = getCanonicalZoneFromPoint({ x: 180, y: 350 }, true);
    expect(angleLeft).toBeGreaterThan(0);
    expect(zoneLeft).toBe('COW_CORNER');

    // Mirroring of field positions for LHB
    const pointPos = CANONICAL_POSITIONS.POINT; // RHB off-side (x=165)
    const mirroredPoint = BowlerFieldStrategyEngine.mirrorForLeftHander(pointPos, true);
    expect(mirroredPoint.x).toBe(600 - pointPos.x); // Mirrored to leg-side (435)
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Pace and spin profiles differ when supported by historical evidence.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 4: Pace and spin profiles isolate distinct scoring tendencies for the same batter', () => {
    // Batter smashes PACE through POINT
    for (let i = 0; i < 8; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_p_${i}`,
        matchId: 'm1',
        inningsId: 'i1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'ODI',
        over: 5,
        ballInOver: i % 6,
        phase: 'Powerplay 1',
        shotType: 'CUT',
        targetZone: 'POINT',
        canonicalZoneId: 'POINT',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    // Batter scores against SPIN through COW_CORNER
    for (let i = 0; i < 8; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_s_${i}`,
        matchId: 'm1',
        inningsId: 'i1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerSpin.id,
        bowlerName: mockBowlerSpin.name,
        bowlingType: 'SPIN',
        batterHand: 'Right',
        format: 'ODI',
        over: 15,
        ballInOver: i % 6,
        phase: 'Middle Overs (PP2)',
        shotType: 'SLOG_SWEEP',
        targetZone: 'MID_WICKET_COW',
        canonicalZoneId: 'COW_CORNER',
        batterRuns: 6,
        extraRuns: 0,
        totalRuns: 6,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    const paceProfile = BatterScoringMemory.getBatterProfile(mockBatterRight.id, { bowlingType: 'PACE' });
    const spinProfile = BatterScoringMemory.getBatterProfile(mockBatterRight.id, { bowlingType: 'SPIN' });

    expect(paceProfile.topBoundaryZones[0]).toBe('POINT');
    expect(spinProfile.topBoundaryZones[0]).toBe('COW_CORNER');
    expect(paceProfile.zones.POINT.boundaryCount).toBe(8);
    expect(spinProfile.zones.POINT.boundaryCount).toBe(0);
    expect(spinProfile.zones.COW_CORNER.boundaryCount).toBe(8);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: T20, ODI, and Test use their own format-specific tactics.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 5: Generates distinct format-specific field tactics for T20, ODI, and Test', () => {
    const t20Death = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      overs: 18,
      balls: 2,
      wickets: 4,
      runs: 165,
    });
    expect(t20Death.format).toBe('T20');
    expect(t20Death.phase).toContain('Death Overs');
    expect(t20Death.actualOutsideCircle).toBeLessThanOrEqual(5);

    const odiPP = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'ODI',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      overs: 4,
      balls: 3,
      wickets: 1,
      runs: 22,
    });
    expect(odiPP.format).toBe('ODI');
    expect(odiPP.phase).toContain('Powerplay 1');
    expect(odiPP.actualOutsideCircle).toBeLessThanOrEqual(2);

    const testMatch = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'TEST',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      overs: 2,
      balls: 1,
      wickets: 0,
      runs: 4,
    });
    expect(testMatch.format).toBe('TEST');
    // Test match new ball seamer should feature slips / close catchers
    const hasSlips = testMatch.fielders.some(f => f.positionKey.includes('SLIP') || f.positionKey === 'GULLY');
    expect(hasSlips).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Fielding restrictions are always satisfied.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 6: All legal fielding restrictions (circle limit, leg side <= 5, behind square leg <= 2) are satisfied', () => {
    const formats: Array<'T20' | 'ODI' | 'TEST'> = ['T20', 'ODI', 'TEST'];

    formats.forEach(fmt => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: fmt,
        bowler: mockBowlerFast,
        striker: mockBatterRight,
        overs: 1,
        balls: 2,
        wickets: 0,
        runs: 5,
      });

      expect(config.fielders.length).toBe(11);
      expect(config.actualOutsideCircle).toBeLessThanOrEqual(config.maxOutsideCircle);
      expect(config.legSideCount).toBeLessThanOrEqual(config.legSideLimit);
      expect(config.isCompliant).toBe(true);

      // Verify no more than 2 behind square on leg side
      const behindSquareLeg = config.fielders.filter(
        f => f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER' && f.targetPos.x > 300 && f.targetPos.y > 410
      );
      expect(behindSquareLeg.length).toBeLessThanOrEqual(2);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: No more than two fielders move in one tactical update.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 7: Enforces strict movement limit of at most 2 fielders relocating between configurations', () => {
    const initialConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      overs: 6,
      balls: 1,
      wickets: 1,
      runs: 45,
    });

    // Request a change in situation to Death overs (which would normally shift 4-5 fielders)
    const nextConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      previousConfig: initialConfig,
      overs: 16,
      balls: 1,
      wickets: 4,
      runs: 140,
      maxFielderMoves: 2,
    });

    expect(nextConfig.changedFielders.length).toBeLessThanOrEqual(2);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: All other fielders retain their positions; bowler and keeper anchor.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 8: Bowler and Wicketkeeper are strictly anchored, and unmoved fielders retain coordinates', () => {
    const initialConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      overs: 7,
      balls: 1,
      wickets: 1,
      runs: 52,
    });

    const nextConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockBatterRight,
      previousConfig: initialConfig,
      overs: 8,
      balls: 1,
      wickets: 1,
      runs: 58,
      maxFielderMoves: 2,
    });

    const initBowler = initialConfig.fielders.find(f => f.positionKey === 'BOWLER')!;
    const nextBowler = nextConfig.fielders.find(f => f.positionKey === 'BOWLER')!;
    expect(nextBowler.targetPos).toEqual(initBowler.targetPos);

    const initKeeper = initialConfig.fielders.find(f => f.positionKey === 'WICKETKEEPER')!;
    const nextKeeper = nextConfig.fielders.find(f => f.positionKey === 'WICKETKEEPER')!;
    expect(nextKeeper.targetPos).toEqual(initKeeper.targetPos);

    // Changed fielders list should exactly identify the moved fielders
    const changedIds = new Set(nextConfig.changedFielders.map(c => c.playerId));
    for (const f of nextConfig.fielders) {
      if (!changedIds.has(f.id) && f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER') {
        const prev = initialConfig.fielders.find(p => p.id === f.id);
        if (prev) {
          expect(f.targetPos.x).toBeCloseTo(prev.targetPos.x, 1);
          expect(f.targetPos.y).toBeCloseTo(prev.targetPos.y, 1);
        }
      }
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 9: A new batter receives their own profile, not the previous batter's.
  // ───────────────────────────────────────────────────────────────────────────
  it("Scenario 9: New batter receives their own independent profile, not previous batter's", () => {
    // Record strong cover profile for Batter 1
    for (let i = 0; i < 10; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_b1_${i}`,
        matchId: 'm1',
        inningsId: 'i1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'T20',
        over: 3,
        ballInOver: i % 6,
        phase: 'Powerplay',
        shotType: 'DRIVE',
        targetZone: 'COVER',
        canonicalZoneId: 'COVER',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    const profile1 = BatterScoringMemory.getBatterProfile(mockBatterRight.id);
    const profileNew = BatterScoringMemory.getBatterProfile(mockNewBatter.id);

    expect(profile1.totalBalls).toBe(10);
    expect(profileNew.totalBalls).toBe(0);
    expect(profileNew.sampleSizeConfidence).toBe('INSUFFICIENT');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 10: Batters without sufficient history receive a reasonable default formation.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 10: Batters with insufficient history receive standard tactical default formation', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: mockBowlerFast,
      striker: mockNewBatter,
      overs: 7,
      balls: 2,
      wickets: 1,
      runs: 48,
    });

    expect(config.batterProfile?.sampleSizeConfidence).toBe('INSUFFICIENT');
    expect(config.tacticalIntent).toContain('standard template deployed');
    expect(config.fielders.length).toBe(11);
    expect(config.isCompliant).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 11: Actual scoring outcomes update analytics accurately.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 11: Actual delivery outcomes update runs, dots, boundaries, dismissals accurately', () => {
    const d1: HistoricalDeliveryRecord = {
      id: 'd1',
      matchId: 'm1',
      inningsId: 'i1',
      batterId: mockBatterRight.id,
      batterName: mockBatterRight.name,
      bowlerId: mockBowlerFast.id,
      bowlerName: mockBowlerFast.name,
      bowlingType: 'PACE',
      batterHand: 'Right',
      format: 'T20',
      over: 1,
      ballInOver: 1,
      phase: 'Powerplay',
      shotType: 'OFF_DRIVE',
      targetZone: 'COVER',
      canonicalZoneId: 'COVER',
      batterRuns: 4,
      extraRuns: 0,
      totalRuns: 4,
      isBoundary: true,
      isWicket: false,
      timestamp: Date.now(),
    };

    const d2: HistoricalDeliveryRecord = {
      id: 'd2',
      matchId: 'm1',
      inningsId: 'i1',
      batterId: mockBatterRight.id,
      batterName: mockBatterRight.name,
      bowlerId: mockBowlerFast.id,
      bowlerName: mockBowlerFast.name,
      bowlingType: 'PACE',
      batterHand: 'Right',
      format: 'T20',
      over: 1,
      ballInOver: 2,
      phase: 'Powerplay',
      shotType: 'DEFENSIVE',
      targetZone: 'POINT',
      canonicalZoneId: 'POINT',
      batterRuns: 0,
      extraRuns: 0,
      totalRuns: 0,
      isBoundary: false,
      isWicket: false,
      timestamp: Date.now(),
    };

    const d3: HistoricalDeliveryRecord = {
      id: 'd3',
      matchId: 'm1',
      inningsId: 'i1',
      batterId: mockBatterRight.id,
      batterName: mockBatterRight.name,
      bowlerId: mockBowlerFast.id,
      bowlerName: mockBowlerFast.name,
      bowlingType: 'PACE',
      batterHand: 'Right',
      format: 'T20',
      over: 1,
      ballInOver: 3,
      phase: 'Powerplay',
      shotType: 'EDGE',
      targetZone: 'FINE_THIRD_MAN',
      canonicalZoneId: 'FINE_THIRD_MAN',
      batterRuns: 0,
      extraRuns: 0,
      totalRuns: 0,
      isBoundary: false,
      isWicket: true,
      dismissalType: 'Caught Behind',
      timestamp: Date.now(),
    };

    BatterScoringMemory.recordDelivery(d1);
    BatterScoringMemory.recordDelivery(d2);
    BatterScoringMemory.recordDelivery(d3);

    const profile = BatterScoringMemory.getBatterProfile(mockBatterRight.id);
    expect(profile.totalBalls).toBe(3);
    expect(profile.totalRuns).toBe(4);
    expect(profile.totalBoundaries).toBe(1);
    expect(profile.totalDots).toBe(1);
    expect(profile.totalDismissals).toBe(1);
    expect(profile.zones.COVER.runsScored).toBe(4);
    expect(profile.zones.POINT.dotCount).toBe(1);
    expect(profile.zones.FINE_THIRD_MAN.dismissalCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 12: Reopening a completed match does not duplicate historical records.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 12: Idempotent match ingestion prevents duplicate historical records', () => {
    const records: HistoricalDeliveryRecord[] = [
      {
        id: 'rec_1',
        matchId: 'fixture_final_1',
        inningsId: 'inn_1',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'IPL',
        over: 1,
        ballInOver: 1,
        phase: 'Powerplay',
        shotType: 'COVER_DRIVE',
        targetZone: 'COVER',
        canonicalZoneId: 'COVER',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now(),
      },
    ];

    const firstIngest = BatterScoringMemory.recordMatchInnings('fixture_final_1', 'inn_1', records);
    expect(firstIngest).toBe(true);
    expect(BatterScoringMemory.getDeliveryCount()).toBe(1);

    // Reopen/re-record identical match innings
    const secondIngest = BatterScoringMemory.recordMatchInnings('fixture_final_1', 'inn_1', records);
    expect(secondIngest).toBe(false);
    expect(BatterScoringMemory.getDeliveryCount()).toBe(1); // Still exactly 1, no duplicate
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 13: Field positions affect actual simulation and not just display.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 13: Field positions and historical scoring profiles affect captain tactical calculations', () => {
    // Record multiple boundaries to COW_CORNER
    for (let i = 0; i < 15; i++) {
      BatterScoringMemory.recordDelivery({
        id: `del_eff_${i}`,
        matchId: 'm_eff',
        inningsId: 'i_eff',
        batterId: mockBatterRight.id,
        batterName: mockBatterRight.name,
        bowlerId: mockBowlerFast.id,
        bowlerName: mockBowlerFast.name,
        bowlingType: 'PACE',
        batterHand: 'Right',
        format: 'T20',
        over: 10,
        ballInOver: i % 6,
        phase: 'Middle Overs',
        shotType: 'PULL',
        targetZone: 'MID_WICKET_COW',
        canonicalZoneId: 'COW_CORNER',
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        isBoundary: true,
        isWicket: false,
        timestamp: Date.now() - i * 1000,
      });
    }

    // AdaptiveCaptainEngine should observe elevated preference for COW_CORNER (MID_WICKET_COW) zone
    const weights = AdaptiveCaptainEngine.getBatterZonePreference(mockBatterRight, 'T20');
    expect(weights.MID_WICKET_COW).toBeGreaterThan(weights.THIRD_MAN_GULLY);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 14: Refreshing or reopening the application preserves historical profiles.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 14: Export and import restores historical profiles across sessions', () => {
    BatterScoringMemory.recordDelivery({
      id: 'd_persist_1',
      matchId: 'm_p',
      inningsId: 'i_p',
      batterId: mockBatterRight.id,
      batterName: mockBatterRight.name,
      bowlerId: mockBowlerFast.id,
      bowlerName: mockBowlerFast.name,
      bowlingType: 'PACE',
      batterHand: 'Right',
      format: 'T20',
      over: 12,
      ballInOver: 3,
      phase: 'Middle Overs',
      shotType: 'DRIVE',
      targetZone: 'EXTRA_COVER',
      canonicalZoneId: 'EXTRA_COVER',
      batterRuns: 6,
      extraRuns: 0,
      totalRuns: 6,
      isBoundary: true,
      isWicket: false,
      timestamp: Date.now(),
    });

    const exported = BatterScoringMemory.exportData();
    expect(typeof exported).toBe('string');

    // Simulate clearing memory on refresh / app reload
    BatterScoringMemory.clearMemory();
    expect(BatterScoringMemory.getDeliveryCount()).toBe(0);

    // Re-import saved state
    BatterScoringMemory.importData(exported);
    expect(BatterScoringMemory.getDeliveryCount()).toBe(1);

    const profile = BatterScoringMemory.getBatterProfile(mockBatterRight.id);
    expect(profile.zones.EXTRA_COVER.runsScored).toBe(6);
    expect(profile.zones.EXTRA_COVER.boundaryCount).toBe(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // SCENARIO 15: Existing delivery lifecycle and DeliveryResultFactory integration.
  // ───────────────────────────────────────────────────────────────────────────
  it('Scenario 15: DeliveryResultFactory integrates seamlessly, assigning canonicalZoneId & recording to memory', () => {
    const delivery = DeliveryResultFactory.createDeliveryResult({
      striker: mockBatterRight,
      nonStriker: mockNewBatter,
      bowler: mockBowlerFast,
      currentBalls: 7,
      currentWickets: 1,
      requiredRate: 8.5,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
    });

    expect(delivery.canonicalZoneId).toBeDefined();
    expect(delivery.canonicalZoneId).not.toBe('UNKNOWN');

    // Verify delivery was recorded into BatterScoringMemory
    const profile = BatterScoringMemory.getBatterProfile(mockBatterRight.id);
    expect(profile.totalBalls).toBeGreaterThanOrEqual(1);
  });
});
