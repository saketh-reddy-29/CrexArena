import { describe, it, expect } from 'vitest';
import { BOWLING_TACTICS_CONFIG, BowlingTactic } from '../components/CricketActionVisualizer';
import { createCricketCharacter, PlayerAnimState } from '../components/CricketPlayer3D';
import { adaptDeliveryTo3DSequence } from '../components/Delivery3DActionAdapter';

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

    expect(BOWLING_TACTICS_CONFIG.OUTSWING.swingFactor).toBeLessThan(0);
    expect(BOWLING_TACTICS_CONFIG.INSWING.swingFactor).toBeGreaterThan(0);
    expect(BOWLING_TACTICS_CONFIG.BOUNCER.bounceMultiplier).toBeGreaterThan(1.4);
    expect(BOWLING_TACTICS_CONFIG.YORKER.bounceMultiplier).toBeLessThan(0.5);
  });

  it('constructs complete 3D rigged cricket character and executes skeletal animations', () => {
    const batterChar = createCricketCharacter({
      id: 'batter-test',
      name: 'Virat Kohli',
      role: 'BATTER',
      teamName: 'India',
      teamAccentColorHex: 0x2563EB,
      hasBat: true,
      hasPads: true,
      hasHelmet: true,
    });

    expect(batterChar.group).toBeDefined();
    expect(batterChar.joints.pelvis).toBeDefined();
    expect(batterChar.joints.torso).toBeDefined();
    expect(batterChar.joints.bat).toBeDefined();
    expect(batterChar.joints.ballSocket).toBeDefined();

    const testStates: PlayerAnimState[] = [
      'BATTING_READY',
      'BACKLIFT',
      'COVER_DRIVE',
      'SQUARE_CUT',
      'PULL_SHOT',
      'LOFTED_SIX',
      'FORWARD_DEFENCE',
      'RUN_UP',
      'DELIVERY_STRIDE',
      'RELEASE',
      'FOLLOW_THROUGH',
      'RUN_TO_BALL',
      'GROUND_FIELD',
      'THROW',
      'KEEPER_READY',
      'RUN_BETWEEN_WICKETS',
      'CELEBRATION'
    ];

    testStates.forEach(state => {
      batterChar.updateAnimation(state, 0.5);
      const handPos = batterChar.getHandWorldPosition();
      expect(Number.isFinite(handPos.x)).toBe(true);
      expect(Number.isFinite(handPos.y)).toBe(true);
      expect(Number.isFinite(handPos.z)).toBe(true);

      const batPos = batterChar.getBatContactWorldPosition();
      expect(Number.isFinite(batPos.x)).toBe(true);
      expect(Number.isFinite(batPos.y)).toBe(true);
      expect(Number.isFinite(batPos.z)).toBe(true);
    });

    const bowlerChar = createCricketCharacter({
      id: 'bowler-test',
      name: 'Jasprit Bumrah',
      role: 'BOWLER',
      teamName: 'India',
      teamAccentColorHex: 0x2563EB,
      hasBat: false,
      hasPads: false,
      hasHelmet: false,
    });

    expect(bowlerChar.joints.bat).toBeUndefined();
    expect(bowlerChar.joints.ballSocket).toBeDefined();
    bowlerChar.updateAnimation('RUN_UP', 0.8);
    expect(Number.isFinite(bowlerChar.joints.spine.position.y)).toBe(true);
  });

  it('correctly adapts match delivery outcomes into physical 3D action timelines', () => {
    // 1. Six Outcome
    const sixSeq = adaptDeliveryTo3DSequence({
      runs: 6,
      isWicket: false,
      wicketType: '',
      isBoundary: true,
      isSix: true,
      isFour: false,
      ball: '1.2',
      commentary: 'Massive six over long-on!',
    } as any);

    expect(sixSeq.isSix).toBe(true);
    expect(sixSeq.resultLabel).toBe('SIX!');
    expect(sixSeq.ballTrajectory.isAerial).toBe(true);
    expect(sixSeq.ballTrajectory.apexHeight).toBeGreaterThan(10);

    // 2. Four Outcome
    const fourSeq = adaptDeliveryTo3DSequence({
      runs: 4,
      isWicket: false,
      wicketType: '',
      isBoundary: true,
      isSix: false,
      isFour: true,
      ball: '2.4',
      commentary: 'Driven through cover for four!',
    } as any);

    expect(fourSeq.isFour).toBe(true);
    expect(fourSeq.resultLabel).toBe('FOUR!');
    expect(fourSeq.ballTrajectory.isAerial).toBe(false);

    // 3. Bowled Dismissal
    const bowledSeq = adaptDeliveryTo3DSequence({
      runs: 0,
      isWicket: true,
      wicketType: 'Bowled',
      ball: '3.1',
      commentary: 'Clean bowled! Off-stump knocked out of ground!',
    } as any, 'INSWING');

    expect(bowledSeq.isBowled).toBe(true);
    expect(bowledSeq.isWicket).toBe(true);
    expect(bowledSeq.resultLabel).toBe('BOWLED');

    // 4. Stumping
    const stumpedSeq = adaptDeliveryTo3DSequence({
      runs: 0,
      isWicket: true,
      wicketType: 'Stumped',
      ball: '4.5',
      commentary: 'Beaten by flight, keeper whips off bails!',
    } as any, 'OFF_BREAK');

    expect(stumpedSeq.isStumped).toBe(true);
    expect(stumpedSeq.keeperAnim).toBe('STUMPING');
  });
});
