import { describe, it, expect } from 'vitest';
import {
  BowlerFieldStrategyEngine,
  CANONICAL_POSITIONS,
} from '../engine/strategy/BowlerFieldStrategyEngine';
import {
  validateField,
  autoCorrectField,
  getFieldingPhase,
  isOutsideCircle,
  isBehindSquareLeg,
  countBehindSquareLeg,
  BOUNDARY_RADIUS,
} from '../engine/fielding/FieldingRestrictionEngine';
import {
  evaluateInterception,
} from '../engine/fielding/FieldingInterceptionEngine';
import { BallLifecycleController } from '../engine/fielding/BallLifecycleController';
import { PitchType, WeatherCondition } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';

const fastBowler: Player = {
  id: 'b_bumrah',
  name: 'Jasprit Bumrah',
  role: 'Bowler',
  bowlingStyle: 'Right-arm Fast',
  rating: 94,
  stats: { bowling: 95, fielding: 88 },
} as any;

const spinBowler: Player = {
  id: 'b_kuldeep',
  name: 'Kuldeep Yadav',
  role: 'Bowler',
  bowlingStyle: 'Left-arm Wrist Spin',
  rating: 90,
  stats: { bowling: 92, fielding: 82 },
} as any;

const wicketKeeper: Player = {
  id: 'wk_pant',
  name: 'Rishabh Pant',
  role: 'Wicketkeeper',
  battingHand: 'Left',
  rating: 89,
  stats: { batting: 89, fielding: 92 },
} as any;

const strikerRHB: Player = {
  id: 'bat_virat',
  name: 'Virat Kohli',
  role: 'Batsman',
  battingHand: 'Right',
  rating: 95,
  stats: { batting: 96 },
} as any;

const strikerLHB: Player = {
  id: 'bat_jaiswal',
  name: 'Yashasvi Jaiswal',
  role: 'Batsman',
  battingHand: 'Left',
  rating: 88,
  stats: { batting: 90 },
} as any;

// A complete 11-player squad
const testSquad: Player[] = [
  fastBowler,
  wicketKeeper,
  { id: 'p_rohit', name: 'Rohit Sharma', role: 'Batsman', rating: 92, stats: { fielding: 86 } } as any,
  { id: 'p_surya', name: 'Suryakumar Yadav', role: 'Batsman', rating: 91, stats: { fielding: 89 } } as any,
  { id: 'p_hardik', name: 'Hardik Pandya', role: 'All-rounder', rating: 90, stats: { fielding: 91 } } as any,
  { id: 'p_rinku', name: 'Rinku Singh', role: 'Batsman', rating: 86, stats: { fielding: 90 } } as any,
  { id: 'p_axar', name: 'Axar Patel', role: 'All-rounder', rating: 88, stats: { fielding: 88 } } as any,
  { id: 'p_jadeja', name: 'Ravindra Jadeja', role: 'All-rounder', rating: 93, stats: { fielding: 98 } } as any,
  { id: 'p_shami', name: 'Mohammed Shami', role: 'Bowler', rating: 89, stats: { fielding: 80 } } as any,
  { id: 'p_arshdeep', name: 'Arshdeep Singh', role: 'Bowler', rating: 87, stats: { fielding: 82 } } as any,
  { id: 'p_siraj', name: 'Mohammed Siraj', role: 'Bowler', rating: 88, stats: { fielding: 84 } } as any,
];

describe('Section 1 & 2: Complete 2D Ground & All 11 Fielding Player Positions', () => {
  const formats: ArenaFormat[] = ['T20', 'IPL', 'ODI', 'TEST'];

  it('generates exactly 11 fielding players in every format', () => {
    formats.forEach((format) => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: fastBowler,
        striker: strikerRHB,
        nonStriker: null,
        overs: 5,
        balls: 2,
        wickets: 2,
        runs: 45,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
        fieldingSquad: testSquad,
      });

      expect(config.fielders.length).toBe(11);
    });
  });

  it('always includes exactly one active bowler and one wicketkeeper in the 11 fielders', () => {
    formats.forEach((format) => {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: fastBowler,
        striker: strikerRHB,
        nonStriker: null,
        overs: 3,
        balls: 0,
        wickets: 1,
        runs: 24,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
        fieldingSquad: testSquad,
      });

      const bowlerAssignments = config.fielders.filter((f) => f.positionKey === 'BOWLER');
      const keeperAssignments = config.fielders.filter((f) => f.positionKey === 'WICKETKEEPER');
      const otherOutfielders = config.fielders.filter(
        (f) => f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER'
      );

      expect(bowlerAssignments.length).toBe(1);
      expect(keeperAssignments.length).toBe(1);
      expect(otherOutfielders.length).toBe(9);
      expect(bowlerAssignments[0].id).toBe(fastBowler.id);
      expect(keeperAssignments[0].id).toBe(wicketKeeper.id);
    });
  });

  it('ensures all 11 fielders have unique player IDs with zero duplicates', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 4,
      balls: 1,
      wickets: 0,
      runs: 35,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });

    const ids = config.fielders.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(11);
  });

  it('places bowler and keeper at canonical coordinates', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 1,
      balls: 0,
      wickets: 0,
      runs: 0,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });

    const bowler = config.fielders.find((f) => f.positionKey === 'BOWLER')!;
    const keeper = config.fielders.find((f) => f.positionKey === 'WICKETKEEPER')!;

    // Bowler at bowling crease y=410
    expect(bowler.targetPos.x).toBe(300);
    expect(bowler.targetPos.y).toBe(410);
    expect(bowler.isOutsideCircle).toBe(false);

    // Wicketkeeper behind striker stumps y=140
    expect(keeper.targetPos.x).toBe(300);
    expect(keeper.targetPos.y).toBe(140);
    expect(keeper.isOutsideCircle).toBe(false);
  });
});

describe('Section 3: Format-Specific Formations & Innings Phases', () => {
  it('T20 & IPL enforce powerplay (max 2 outside), middle (max 5), death (max 5)', () => {
    // Overs 0..5: Powerplay
    const ppConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 2,
      balls: 4,
      wickets: 0,
      runs: 22,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(ppConfig.maxOutsideCircle).toBe(2);
    expect(ppConfig.actualOutsideCircle).toBeLessThanOrEqual(2);
    expect(ppConfig.phase).toContain('Powerplay');

    // Overs 6..14: Middle
    const midConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: spinBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 10,
      balls: 2,
      wickets: 2,
      runs: 85,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(midConfig.maxOutsideCircle).toBe(5);
    expect(midConfig.actualOutsideCircle).toBeLessThanOrEqual(5);
    expect(midConfig.phase).toContain('Middle');

    // Overs 15..19: Death
    const deathConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'IPL',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 18,
      balls: 1,
      wickets: 4,
      runs: 168,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(deathConfig.maxOutsideCircle).toBe(5);
    expect(deathConfig.actualOutsideCircle).toBeLessThanOrEqual(5);
    expect(deathConfig.phase).toContain('Death');
  });

  it('ODI enforces PP1 (max 2), PP2 (max 4), and PP3 (max 5)', () => {
    // PP1 (Overs 1-10)
    const pp1 = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'ODI',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 5,
      balls: 0,
      wickets: 1,
      runs: 28,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(pp1.maxOutsideCircle).toBe(2);
    expect(pp1.actualOutsideCircle).toBeLessThanOrEqual(2);

    // PP2 (Overs 11-40)
    const pp2 = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'ODI',
      bowler: spinBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 25,
      balls: 0,
      wickets: 3,
      runs: 130,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(pp2.maxOutsideCircle).toBe(4);
    expect(pp2.actualOutsideCircle).toBeLessThanOrEqual(4);

    // PP3 (Overs 41-50)
    const pp3 = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'ODI',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 44,
      balls: 0,
      wickets: 5,
      runs: 260,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });
    expect(pp3.maxOutsideCircle).toBe(5);
    expect(pp3.actualOutsideCircle).toBeLessThanOrEqual(5);
  });

  it('Test matches have no fielding circle restriction (unrestricted)', () => {
    const testConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'TEST',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 12,
      balls: 0,
      wickets: 2,
      runs: 45,
      pitch: PitchType.GREEN,
      weather: WeatherCondition.OVERCAST,
      fieldingSquad: testSquad,
    });

    // In Test matches, maxOutsideCircle is 9 (all outfielders permitted deep)
    expect(testConfig.maxOutsideCircle).toBe(9);
    // Green pitch new ball has attacking slips and gully
    expect(testConfig.fielders.some((f) => f.positionKey === 'FIRST_SLIP')).toBe(true);
    expect(testConfig.fielders.some((f) => f.positionKey === 'SECOND_SLIP')).toBe(true);
  });
});

describe('Section 5: Central Field Validator & Leg-Side Law 28.3 & 28.4', () => {
  it('enforces Law 28.3: never more than 5 fielders on the leg side', () => {
    for (const format of ['T20', 'IPL', 'ODI', 'TEST'] as const) {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: fastBowler,
        striker: strikerRHB,
        nonStriker: null,
        overs: 8,
        balls: 0,
        wickets: 1,
        runs: 60,
        pitch: PitchType.BALANCED,
        weather: WeatherCondition.SUNNY,
        fieldingSquad: testSquad,
      });

      expect(config.legSideCount).toBeLessThanOrEqual(5);
      expect(config.isCompliant).toBe(true);
    }
  });

  it('enforces Law 28.4: never more than 2 outfielders behind square on the leg side', () => {
    for (const format of ['T20', 'IPL', 'ODI', 'TEST'] as const) {
      const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format,
        bowler: spinBowler,
        striker: strikerRHB,
        nonStriker: null,
        overs: 10,
        balls: 0,
        wickets: 2,
        runs: 75,
        pitch: PitchType.SPIN,
        weather: WeatherCondition.SUNNY,
        fieldingSquad: testSquad,
      });

      const behindSquare = config.fielders.filter(
        (f) =>
          f.positionKey !== 'BOWLER' &&
          f.positionKey !== 'WICKETKEEPER' &&
          f.targetPos.x > 300 &&
          f.targetPos.y < 190
      );
      expect(behindSquare.length).toBeLessThanOrEqual(2);
    }
  });

  it('central validateField approves generated field configurations', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 3,
      balls: 2,
      wickets: 0,
      runs: 25,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });

    const res = validateField({
      format: 'T20',
      over: 4,
      fielders: config.fielders.map((f) => ({
        id: f.id,
        name: f.name,
        role: f.role,
        x: f.targetPos.x,
        y: f.targetPos.y,
        isOutsideCircle: f.isOutsideCircle,
      })),
      options: {
        expectedPlayerCount: 11,
        requireBowler: true,
        requireWicketkeeper: true,
        enforceBounds: true,
        enforcePitchClearance: true,
      },
    });

    expect(res.valid).toBe(true);
    expect(res.totalFielders).toBe(11);
    expect(res.outsideCircleCount).toBeLessThanOrEqual(2);
    expect(res.violations.length).toBe(0);
  });

  it('central autoCorrectField repairs out-of-bounds, circle, and leg-side violations', () => {
    // Contrive an illegal field with 4 outside circle in powerplay, 7 on leg side, and 1 out of bounds
    const illegalField = [
      { id: 'b', name: 'Bowler', role: 'Bowler', x: 300, y: 190 },
      { id: 'wk', name: 'Keeper', role: 'Wicketkeeper', x: 300, y: 460 },
      { id: 'f1', name: 'F1', role: 'Batsman', x: 80, y: 300 }, // outside circle
      { id: 'f2', name: 'F2', role: 'Batsman', x: 520, y: 300 }, // outside circle (leg)
      { id: 'f3', name: 'F3', role: 'Batsman', x: 300, y: 80 }, // outside circle
      { id: 'f4', name: 'F4', role: 'Batsman', x: 300, y: 520 }, // outside circle
      { id: 'f5', name: 'F5', role: 'Batsman', x: 450, y: 450 }, // leg side behind square
      { id: 'f6', name: 'F6', role: 'Batsman', x: 420, y: 460 }, // leg side behind square
      { id: 'f7', name: 'F7', role: 'Batsman', x: 400, y: 470 }, // leg side behind square (3rd behind square!)
      { id: 'f8', name: 'F8', role: 'Batsman', x: 360, y: 350 }, // leg side
      { id: 'f9', name: 'F9', role: 'Batsman', x: 600, y: 600 }, // way out of bounds!
    ];

    const corrected = autoCorrectField({
      format: 'T20',
      over: 1,
      fielders: illegalField,
    });

    const res = validateField({
      format: 'T20',
      over: 1,
      fielders: corrected,
      options: {
        enforcePlayerCount: true,
        enforceBounds: true,
      },
    });

    expect(res.valid).toBe(true);
    expect(res.outsideCircleCount).toBeLessThanOrEqual(2);
    expect(res.legSideCount).toBeLessThanOrEqual(5);
    expect(res.behindSquareLegCount).toBeLessThanOrEqual(2);
  });
});

describe('Section 6: Tactical Movement Limit (At most 2 fielders move)', () => {
  it('moves at most two outfielders on a tactical preset change and holds the rest', () => {
    const initialConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 6,
      balls: 0,
      wickets: 0,
      runs: 48,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });

    // Next delivery applies an aggressive slip cordon preset
    const nextConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 6,
      balls: 1,
      wickets: 1,
      runs: 48,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
      previousConfig: initialConfig,
      manualPresetKey: 'ATTACKING_SLIP_CORDON',
    });

    expect(nextConfig.changedFielders.length).toBeLessThanOrEqual(2);
    expect(nextConfig.movementLimited).toBe(true);

    const movedPlayerIds = new Set(nextConfig.changedFielders.map((c) => c.playerId));
    // Bowler and Keeper must never be among the moved outfielders
    expect(movedPlayerIds.has(fastBowler.id)).toBe(false);
    expect(movedPlayerIds.has(wicketKeeper.id)).toBe(false);

    // Unchanged fielders retain their exact previous target positions
    for (const f of nextConfig.fielders) {
      if (movedPlayerIds.has(f.id)) continue;
      const prev = initialConfig.fielders.find((p) => p.id === f.id);
      expect(f.targetPos.x).toBe(prev?.targetPos.x);
      expect(f.targetPos.y).toBe(prev?.targetPos.y);
    }
  });
});

describe('Section 7 & 8: Fielding Interception & Ball Lifecycle Gating', () => {
  it('evaluates fielder interception using all 11 player coordinates', () => {
    const config = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: 'T20',
      bowler: fastBowler,
      striker: strikerRHB,
      nonStriker: null,
      overs: 12,
      balls: 0,
      wickets: 2,
      runs: 95,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      fieldingSquad: testSquad,
    });

    // Straight drive down the ground toward long-on (x=365, y=525)
    const ballPath = {
      start: { x: 300, y: 410 },
      bounce: { x: 300, y: 270 },
      contact: { x: 300, y: 190 },
      target: { x: 365, y: 525 },
      isAerial: false,
      apexHeight: 0,
    };

    const interception = evaluateInterception({
      ballPath,
      fielders: config.fielders.map((f) => ({
        id: f.id,
        name: f.name,
        x: f.targetPos.x,
        y: f.targetPos.y,
        fieldingRating: f.fieldingRating,
      })),
      rng: () => 0.5,
    });

    expect(interception).toBeDefined();
    expect(interception.fielderId).toBeDefined();
    expect(interception.interceptPoint).toBeDefined();
  });

  it('BallLifecycleController gates the next delivery until ball retrieval completes', () => {
    const controller = new BallLifecycleController();

    // Start in READY state
    expect(controller.canReleaseNextDelivery()).toBe(true);

    // Begin delivery -> DELIVERY_IN_PROGRESS
    expect(controller.beginDelivery()).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(false);

    // Ball released -> BALL_IN_PLAY
    expect(controller.releaseBall()).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(false);

    // Fielder moves to intercept -> FIELDER_INTERCEPTING
    expect(controller.fielderIntercepts('p_jadeja')).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(false);

    // Fielder collects the ball -> BALL_COLLECTED
    expect(controller.collectBall()).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(false);

    // Throw back to bowler -> RETURNING_BALL
    expect(controller.returnBall()).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(false);

    // Bowler collects ball -> BALL_READY
    expect(controller.bowlerReceives()).toBe(true);
    expect(controller.isRetrievalComplete()).toBe(true);

    // Complete delivery and reset -> READY
    expect(controller.completeDelivery()).toBe(true);
    expect(controller.resetForNextDelivery()).toBe(true);
    expect(controller.canReleaseNextDelivery()).toBe(true);
  });
});
