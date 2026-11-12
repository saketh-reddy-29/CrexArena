export interface CricketArenaPose {
  sp: number;      // Stadium spin / celebration full rotation angle
  yw: number;      // Body orientation along pitch axis (0 = facing bowler, 1 = side-on batting stance)
  lean: number;    // Torso lean forward/backward
  head: number;    // Head pitch / tilt tracking
  crouch: number;  // Pelvis / hip drop in meters
  lfx: number;     // Left foot forward/back
  lfy: number;     // Left foot vertical lift
  rfx: number;     // Right foot forward/back
  rfy: number;     // Right foot vertical lift
  lhx: number;     // Left hand forward target
  lhy: number;     // Left hand height target
  rhx: number;     // Right hand forward target
  rhy: number;     // Right hand height target
  grip: number;    // Bat grip mode (0 = no bat/free, 1 = one-hand hold, 2 = two-hand batting grip)
  bx: number;      // Bat base X position
  by: number;      // Bat base Y height
  ba: number;      // Bat angle (in radians)
  air: number;     // Airborne vertical displacement (running/jumping/diving)
  rot: number;     // Full body pitch / dive rotation
  latL?: number;   // Left arm lateral offset
  latR?: number;   // Right arm lateral offset
  tw?: number;     // Spine twist angle
  toe?: number;    // Foot pitch angle
}

export type CricketArenaAction =
  | 'idle'
  | 'ready'
  | 'walk'
  | 'jog'
  | 'sprint'
  | 'run'
  | 'runBat'
  | 'sprintBat'
  | 'batIdle'
  | 'batStance'
  | 'batPickup'
  | 'backlift'
  | 'batLower'
  | 'batShoulder'
  | 'forwardDefence'
  | 'backDefence'
  | 'straightDrive'
  | 'coverDrive'
  | 'offDrive'
  | 'onDrive'
  | 'pull'
  | 'hook'
  | 'sweep'
  | 'reverseSweep'
  | 'lofted'
  | 'flick'
  | 'lateCut'
  | 'squareCut'
  | 'followThrough'
  | 'fastBowl'
  | 'spinBowl'
  | 'bowl_fast'
  | 'bowl_spin'
  | 'bowl_seam'
  | 'bowl_swing'
  | 'bowl_slower'
  | 'bowl_yorker'
  | 'bowl_bouncer'
  | 'groundField'
  | 'ballPickup'
  | 'highCatch'
  | 'diveCatch'
  | 'diveStop'
  | 'getUp'
  | 'slide'
  | 'fall'
  | 'throwOver'
  | 'throwUnder'
  | 'throwPower'
  | 'throwQuick'
  | 'catchChest'
  | 'keeperReady'
  | 'keeperStand'
  | 'keeperCatch'
  | 'keeperLow'
  | 'keeperHigh'
  | 'keeperSide'
  | 'keeperDiveL'
  | 'keeperDiveR'
  | 'stumping'
  | 'celebrateSmall'
  | 'celebrateJump'
  | 'victory'
  | 'handsUp'
  | 'defeat'
  | 'walkAway'
  | 'appeal'
  | 'umpireOut'
  | 'umpireFour'
  | 'umpireSix';

export const CRICKET_ARENA_ACTIONS: readonly CricketArenaAction[] = [
  'idle',
  'ready',
  'walk',
  'jog',
  'sprint',
  'run',
  'runBat',
  'sprintBat',
  'batIdle',
  'batStance',
  'batPickup',
  'backlift',
  'batLower',
  'batShoulder',
  'forwardDefence',
  'backDefence',
  'straightDrive',
  'coverDrive',
  'offDrive',
  'onDrive',
  'pull',
  'hook',
  'sweep',
  'reverseSweep',
  'lofted',
  'flick',
  'lateCut',
  'squareCut',
  'followThrough',
  'fastBowl',
  'spinBowl',
  'bowl_fast',
  'bowl_spin',
  'bowl_seam',
  'bowl_swing',
  'bowl_slower',
  'bowl_yorker',
  'bowl_bouncer',
  'groundField',
  'ballPickup',
  'highCatch',
  'diveCatch',
  'diveStop',
  'getUp',
  'slide',
  'fall',
  'throwOver',
  'throwUnder',
  'throwPower',
  'throwQuick',
  'catchChest',
  'keeperReady',
  'keeperStand',
  'keeperCatch',
  'keeperLow',
  'keeperHigh',
  'keeperSide',
  'keeperDiveL',
  'keeperDiveR',
  'stumping',
  'celebrateSmall',
  'celebrateJump',
  'victory',
  'handsUp',
  'defeat',
  'walkAway',
  'appeal',
  'umpireOut',
  'umpireFour',
  'umpireSix',
] as const;

type Keyframe = readonly [number, Partial<CricketArenaPose>];

const REST: CricketArenaPose = {
  sp: 0,
  yw: 0,
  lean: 0.05,
  head: 0,
  crouch: 0,
  lfx: -0.15,
  lfy: 0,
  rfx: 0.15,
  rfy: 0,
  lhx: 0.05,
  lhy: 0.85,
  rhx: 0.1,
  rhy: 0.85,
  grip: 0,
  bx: 0,
  by: 0,
  ba: 0,
  air: 0,
  rot: 0,
};

// Batting Stance (side-on, wide balanced base, hands low, bat toe resting near back foot)
const BAT_STANCE: Partial<CricketArenaPose> = {
  yw: 1,
  lean: 0.14,
  crouch: 0.14,
  lfx: -0.26,
  rfx: 0.34,
  grip: 2,
  bx: 0.34,
  by: 0.9,
  ba: -0.6,
};

// Backlift pose (bat raised behind back hip, front foot triggered)
const BACKLIFT_POSE: Partial<CricketArenaPose> = {
  yw: 1,
  lean: 0.08,
  crouch: 0.1,
  lfx: -0.3,
  rfx: 0.3,
  grip: 2,
  bx: 0.2,
  by: 1.3,
  ba: -2.5,
};

// Wicketkeeper ready crouch
const KEEPER_READY_POSE: Partial<CricketArenaPose> = {
  crouch: 0.5,
  lean: 0.2,
  lfx: -0.25,
  rfx: 0.25,
  lhx: 0.55,
  lhy: 0.4,
  rhx: 0.55,
  rhy: 0.35,
};

const smooth = (v: number) => v * v * (3 - 2 * v);
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

function interpolateKeyframes(frames: Keyframe[], t: number): Partial<CricketArenaPose> {
  const progress = clamp(t);
  if (frames.length === 0) return {};
  if (progress <= frames[0][0]) return frames[0][1];
  if (progress >= frames[frames.length - 1][0]) return frames[frames.length - 1][1];

  for (let i = 1; i < frames.length; i++) {
    const [prevT, prevPose] = frames[i - 1];
    const [nextT, nextPose] = frames[i];
    if (progress <= nextT) {
      const factor = smooth((progress - prevT) / Math.max(0.0001, nextT - prevT));
      const res: Partial<CricketArenaPose> = { ...prevPose };
      const allKeys = new Set([...Object.keys(prevPose), ...Object.keys(nextPose)]) as Set<keyof CricketArenaPose>;
      allKeys.forEach((key) => {
        const startVal = prevPose[key] ?? REST[key];
        const endVal = nextPose[key] ?? startVal;
        if (typeof startVal === 'number' && typeof endVal === 'number') {
          res[key] = startVal + (endVal - startVal) * factor;
        }
      });
      return res;
    }
  }
  return frames[frames.length - 1][1];
}

function runCycle(t: number, amp: number, lift: number, lean: number, freq: number, hasBat = false): Partial<CricketArenaPose> {
  const angle = t * freq * Math.PI * 2;
  const pose: Partial<CricketArenaPose> = {
    lean,
    crouch: 0.05,
    lfx: Math.sin(angle) * amp,
    lfy: Math.max(0, Math.cos(angle)) * lift,
    rfx: Math.sin(angle + Math.PI) * amp,
    rfy: Math.max(0, Math.cos(angle + Math.PI)) * lift,
    lhx: 0.05 + Math.sin(angle) * amp * 0.8,
    lhy: 0.8 + Math.cos(angle) * 0.1,
    air: Math.abs(Math.sin(angle)) * 0.05 * lift * 4,
  };

  if (hasBat) {
    pose.grip = 1;
    pose.rhx = 0.25;
    pose.rhy = 1.15;
    pose.ba = -2.2;
  } else {
    pose.rhx = 0.05 + Math.sin(angle + Math.PI) * amp * 0.8;
    pose.rhy = 0.8 - Math.cos(angle) * 0.1;
  }
  return pose;
}

// Shot definition table: [backliftAngle, contactAngle, contactHeight, frontFootX, lean, exitVelocity, followThroughAngle]
interface ShotSpec {
  a1: number;
  a2: number;
  py: number;
  fx: number;
  lean: number;
  ft: number;
  cr?: number;
  bk?: number;
}

const SHOT_DATABASE: Record<string, ShotSpec> = {
  forwardDefence: { a1: -0.8, a2: 0.15, py: 0.85, fx: 0.55, lean: 0.35, ft: 0.5 },
  backDefence: { a1: -1.2, a2: 0.1, py: 0.9, fx: 0.1, lean: 0.1, ft: 0.5, cr: 0.15, bk: 1 },
  straightDrive: { a1: -2.6, a2: 1.0, py: 1.0, fx: 0.6, lean: 0.3, ft: 2.6 },
  coverDrive: { a1: -2.4, a2: 0.8, py: 1.0, fx: 0.6, lean: 0.3, ft: 2.4 },
  offDrive: { a1: -2.5, a2: 0.9, py: 1.0, fx: 0.55, lean: 0.3, ft: 2.5 },
  onDrive: { a1: -2.6, a2: 1.1, py: 1.0, fx: 0.55, lean: 0.35, ft: 2.7 },
  pull: { a1: -1.5, a2: 1.4, py: 1.25, fx: -0.1, lean: 0.2, ft: 2.8, bk: 1 },
  hook: { a1: -1.2, a2: 1.8, py: 1.6, fx: -0.1, lean: 0.1, ft: 3.2, bk: 1 },
  sweep: { a1: -1.4, a2: 1.2, py: 0.5, fx: 0.5, lean: 0.6, ft: 2.2, cr: 0.5 },
  reverseSweep: { a1: 1.4, a2: -1.2, py: 0.5, fx: 0.5, lean: 0.6, ft: -2.2, cr: 0.5 },
  lofted: { a1: -2.8, a2: 0.5, py: 1.0, fx: 0.5, lean: 0.2, ft: 3.0 },
  flick: { a1: -1.8, a2: 1.5, py: 0.9, fx: 0.3, lean: 0.2, ft: 2.4 },
  lateCut: { a1: -1.9, a2: 1.7, py: 0.8, fx: -0.2, lean: 0.2, ft: 2.9, bk: 1 },
  squareCut: { a1: -2.0, a2: 1.6, py: 0.95, fx: -0.15, lean: 0.22, ft: 2.8, bk: 1 },
};

export function getCricketArenaPose(
  action: CricketArenaAction,
  progress: number,
  clock: number,
  isLeftHanded = false
): CricketArenaPose {
  const t = clamp(progress);
  let pose: Partial<CricketArenaPose> = {};

  // 1. IDLE & READY POSES
  if (action === 'idle') {
    pose = {
      crouch: Math.sin(clock * 6.28) * 0.012,
      head: Math.sin(clock * 3) * 0.05,
      lhy: 0.83 + Math.sin(clock * 6.28) * 0.01,
    };
  } else if (action === 'ready') {
    pose = {
      lean: 0.25,
      crouch: 0.22,
      lfx: -0.3,
      rfx: 0.3,
      lhx: 0.45,
      lhy: 0.55,
      rhx: 0.5,
      rhy: 0.5,
      head: Math.sin(clock * 3) * 0.05,
    };
  } else if (action === 'batIdle') {
    // True batting stance with subtle breathing motion
    pose = {
      ...BAT_STANCE,
      crouch: 0.14 + Math.sin(clock * 6.28) * 0.012,
      head: Math.sin(clock * 2.5) * 0.02,
    };
  } else if (action === 'batStance') {
    pose = interpolateKeyframes([
      [0, REST],
      [1, BAT_STANCE],
    ], t);
  } else if (action === 'batPickup') {
    pose = interpolateKeyframes([
      [0, { lhx: 0.45, lhy: 0.1, rhx: 0.55, rhy: 0.08, lean: 0.5 }],
      [0.55, { lean: 0.95, crouch: 0.25, lfx: -0.3, rfx: 0.3, lhx: 0.5, lhy: 0.08, rhx: 0.55, rhy: 0.08, grip: 2, bx: 0.5, by: 0.08, ba: 1.5 }],
      [1, BAT_STANCE],
    ], t);
  } else if (action === 'backlift') {
    pose = interpolateKeyframes([
      [0, BAT_STANCE],
      [0.7, BACKLIFT_POSE],
      [1, BACKLIFT_POSE],
    ], t);
  } else if (action === 'batLower') {
    pose = interpolateKeyframes([
      [0, BACKLIFT_POSE],
      [1, BAT_STANCE],
    ], t);
  } else if (action === 'batShoulder') {
    pose = {
      grip: 1,
      rhx: 0.25,
      rhy: 1.2,
      ba: -2.2,
      lhx: -0.25,
      lhy: 0.55,
      head: 0.1,
    };

  // 2. SHOT ANIMATIONS (14 distinct professional strokes)
  } else if (SHOT_DATABASE[action]) {
    const s = SHOT_DATABASE[action];
    const cr = s.cr || 0.1;
    const ftBase = { lean: 0.1, crouch: 0.12, lfx: -0.3, rfx: 0.3, grip: 2, yw: 1 };
    pose = interpolateKeyframes([
      [0, BAT_STANCE],
      [0.24, { ...BACKLIFT_POSE, ba: s.a1, by: s.py + 0.15 }],
      [0.48, {
        ...ftBase,
        bx: 0.5,
        by: s.py,
        ba: s.a2,
        lean: s.lean,
        crouch: cr,
        rfx: s.bk ? 0.1 : s.fx,
        lfx: s.bk ? -0.5 : -0.3,
      }],
      [1.0, {
        ...ftBase,
        bx: 0.2,
        by: s.py + 0.45,
        ba: s.ft,
        lean: 0.1,
      }],
    ], t);
  } else if (action === 'followThrough') {
    pose = interpolateKeyframes([
      [0, { grip: 2, bx: 0.5, by: 1.0, ba: 1.0, yw: 1 }],
      [1, { grip: 2, bx: 0.2, by: 1.5, ba: 2.6, lean: 0.1, yw: 1 }],
    ], t);

  // 3. BOWLING MECHANICS (Run-up, Gather, Windmill Arm Rotation, Synchronized Release)
  } else if (action.startsWith('bowl_') || action === 'fastBowl' || action === 'spinBowl') {
    const isSpin = action.includes('spin');
    // Multi-stage delivery sequence:
    // 0.00 - 0.44: Run-up sprint towards crease
    // 0.44 - 0.58: Gather & bound into delivery stride
    // 0.58 - 0.78: Windmill bowling arm rotation & release
    // 0.78 - 1.00: Follow-through and deceleration
    if (t < 0.44) {
      pose = runCycle(t / 0.44, 0.55, 0.4, 0.25, 3.5, false);
    } else if (t < 0.58) {
      const boundPhase = (t - 0.44) / 0.14;
      pose = {
        lean: 0.15,
        air: 0.32 * Math.sin(boundPhase * Math.PI),
        lfx: 0.1,
        rfx: -0.2,
        lhx: 0.5,
        lhy: 1.7,
        rhx: -0.4,
        rhy: 1.2,
      };
    } else if (t < 0.78) {
      const armPhase = (t - 0.58) / 0.20 * Math.PI * 2;
      pose = {
        lean: 0.35,
        crouch: 0.15,
        rfx: 0.6,
        lfx: -0.4,
        lhx: 0.5 - Math.max(0, armPhase - 3.1) * 0.15,
        lhy: 1.7 - Math.max(0, armPhase - 3.1) * 0.3,
        rhx: 0.1 - (isSpin ? 0.6 : 0.74) * Math.sin(armPhase),
        rhy: 1.38 - (isSpin ? 0.6 : 0.74) * Math.cos(armPhase),
      };
    } else {
      const finishPhase = (t - 0.78) / 0.22;
      pose = {
        lean: 0.5 - finishPhase * 0.3,
        crouch: 0.25 - finishPhase * 0.1,
        rfx: 0.5,
        lfx: -0.3,
        rhx: 0.35,
        rhy: 0.5 + finishPhase * 0.3,
        lhx: 0.1,
        lhy: 0.9,
      };
    }

  // 4. RUNNING & LOCOMOTION
  } else if (action === 'walk') {
    pose = runCycle(clock, 0.25, 0.12, 0.04, 0.9, false);
  } else if (action === 'jog') {
    pose = runCycle(clock, 0.4, 0.25, 0.15, 1.6, false);
  } else if (action === 'sprint' || action === 'run') {
    pose = runCycle(clock, 0.6, 0.4, 0.35, 2.3, false);
  } else if (action === 'runBat') {
    pose = runCycle(clock, 0.4, 0.25, 0.15, 1.6, true);
  } else if (action === 'sprintBat') {
    pose = runCycle(clock, 0.6, 0.4, 0.35, 2.3, true);

  // 5. WICKETKEEPING
  } else if (action === 'keeperReady') {
    pose = {
      ...KEEPER_READY_POSE,
      head: Math.sin(clock * 3) * 0.04,
    };
  } else if (action === 'keeperStand') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [1, { lean: 0.05, lhx: 0.4, lhy: 1.0, rhx: 0.45, rhy: 1.0 }],
    ], t);
  } else if (action === 'keeperCatch') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.4, { ...KEEPER_READY_POSE, lhx: 0.6, lhy: 0.45, rhx: 0.68, rhy: 0.45 }],
      [1, KEEPER_READY_POSE],
    ], t);
  } else if (action === 'keeperLow') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.4, { ...KEEPER_READY_POSE, crouch: 0.65, lean: 0.35, lhx: 0.55, lhy: 0.1, rhx: 0.63, rhy: 0.1 }],
      [1, KEEPER_READY_POSE],
    ], t);
  } else if (action === 'keeperHigh') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.4, { lean: 0.05, crouch: 0.1, lhx: 0.45, lhy: 1.95, rhx: 0.53, rhy: 1.95 }],
      [1, KEEPER_READY_POSE],
    ], t);
  } else if (action === 'keeperSide') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.4, { ...KEEPER_READY_POSE, lhx: 0.9, lhy: 0.6, rhx: 0.98, rhy: 0.6 }],
      [1, KEEPER_READY_POSE],
    ], t);
  } else if (action === 'keeperDiveL' || action === 'keeperDiveR') {
    const isLeft = action === 'keeperDiveL';
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.35, { rot: isLeft ? -1.3 : 1.2, air: 0.5, lhx: 0.2, lhy: 2.0, rhx: 0.3, rhy: 2.0 }],
      [1.0, { rot: isLeft ? -1.5 : 1.5, air: 0.25, lhx: 0.2, lhy: 2.0 }],
    ], t);
  } else if (action === 'stumping') {
    pose = interpolateKeyframes([
      [0, KEEPER_READY_POSE],
      [0.35, { ...KEEPER_READY_POSE, lhx: -0.7, lhy: 0.65, rhx: -0.7, rhy: 0.7, lean: 0.35 }],
      [1, KEEPER_READY_POSE],
    ], t);

  // 6. FIELDING (Ground collection, catches, dives, throws)
  } else if (action === 'groundField') {
    pose = interpolateKeyframes([
      [0, { lean: 0.25, crouch: 0.2, lhx: 0.45, lhy: 0.55, rhx: 0.5, rhy: 0.5 }],
      [0.35, { lean: 0.6, crouch: 0.4, lfx: -0.2, rfx: 0.35, lhx: 0.7, lhy: 0.1, rhx: 0.75, rhy: 0.08 }],
      [1, { lean: 0.2, crouch: 0.1 }],
    ], t);
  } else if (action === 'ballPickup') {
    pose = interpolateKeyframes([
      [0, { lean: 0.3, crouch: 0.2 }],
      [0.4, { lean: 0.9, crouch: 0.3, lfx: -0.3, rfx: 0.3, lhx: 0.9, lhy: 0.1 }],
      [0.55, { lean: 0.9, crouch: 0.3, lhx: 0.9, lhy: 0.1 }],
      [1, { lean: 0.1, lhx: 0.4, lhy: 0.9 }],
    ], t);
  } else if (action === 'highCatch') {
    pose = interpolateKeyframes([
      [0, { lean: 0.1, crouch: 0.1, lhx: 0.3, lhy: 1.0, rhx: 0.35, rhy: 1.0 }],
      [0.4, { lean: 0, lhx: 0.4, lhy: 2.0, rhx: 0.5, rhy: 2.0, air: 0.06 }],
      [0.72, { lhx: 0.4, lhy: 2.0, rhx: 0.5, rhy: 2.0 }],
      [1, { lhx: 0.25, lhy: 0.9, rhx: 0.3, rhy: 0.85, crouch: 0.1 }],
    ], t);
  } else if (action === 'diveCatch' || action === 'diveStop') {
    pose = interpolateKeyframes([
      [0, { lean: 0.35, crouch: 0.15, lhx: 0.5, lhy: 1.0, rhx: 0.5, rhy: 1.0 }],
      [0.26, { rot: 1.0, air: 0.55, lhx: 0.1, lhy: 2.0, rhx: 0.2, rhy: 2.1, lfx: -0.3, rfx: -0.5, lfy: 0.2, rfy: 0.3 }],
      [0.55, { rot: 1.4, air: 0.4, lhx: 0.1, lhy: 2.1, rhx: 0.2, rhy: 2.1, lfx: -0.2, rfx: -0.4, lfy: 0.3, rfy: 0.3 }],
      [1, { rot: 1.5, air: 0.28, lhx: 0.1, lhy: 2.0, rhx: 0.2, rhy: 2.1 }],
    ], t);
  } else if (action === 'getUp') {
    pose = interpolateKeyframes([
      [0, { rot: 1.5, air: 0.28, lhx: 0.1, lhy: 2.0 }],
      [0.45, { rot: 0.5, air: 0.05, lean: 0.7, crouch: 0.4, lhx: 0.7, lhy: 0.3, rhx: 0.7, rhy: 0.3 }],
      [1, { lean: 0.2, crouch: 0.1 }],
    ], t);
  } else if (action === 'slide') {
    pose = interpolateKeyframes([
      [0, { lean: 0.3 }],
      [0.35, { rot: 1.3, air: 0.25, lhx: 0.1, lhy: 2.0 }],
      [1, { rot: 1.45, air: 0.25 }],
    ], t);
  } else if (action === 'throwOver' || action === 'throwPower') {
    const power = action === 'throwPower';
    pose = interpolateKeyframes([
      [0, { lean: -0.1, lfx: -0.3, rfx: 0.3, rhx: power ? -0.6 : -0.5, rhy: power ? 1.6 : 1.5, lhx: 0.5, lhy: 1.2 }],
      [0.35, { lean: 0.3, rhx: power ? 0.8 : 0.7, rhy: power ? 1.9 : 1.85, lfx: -0.3, rfx: 0.4, lhx: 0.3, lhy: 0.9 }],
      [1, { lean: 0.5, rhx: 0.3, rhy: 0.5, rfx: 0.5 }],
    ], t);
  } else if (action === 'throwQuick' || action === 'throwUnder') {
    pose = interpolateKeyframes([
      [0, { lean: 0.1, lfx: -0.2, rfx: 0.2, rhx: -0.2, rhy: 0.5, lhx: 0.4, lhy: 0.8 }],
      [0.35, { lean: 0.25, rhx: 0.6, rhy: 0.3, lfx: -0.2, rfx: 0.3, lhx: 0.3, lhy: 0.6 }],
      [1, { lean: 0.4, rhx: 0.3, rhy: 0.4 }],
    ], t);
  } else if (action === 'catchChest') {
    pose = interpolateKeyframes([
      [0, { lean: 0.05, lhx: 0.4, lhy: 0.95, rhx: 0.45, rhy: 0.95 }],
      [0.45, { lean: 0.08, lhx: 0.5, lhy: 1.1, rhx: 0.55, rhy: 1.1 }],
      [1, { lean: 0.05, lhx: 0.3, lhy: 0.9, rhx: 0.35, rhy: 0.9, crouch: 0.05 }],
    ], t);

  // 7. CELEBRATIONS & DISMISSALS
  } else if (action === 'celebrateJump') {
    // 360-degree stadium spin with bat raised high
    const jump = Math.max(0, Math.sin(clock * 5.5)) * 0.07;
    pose = {
      grip: 1,
      sp: t * Math.PI * 2,
      air: jump,
      rhx: 0.1,
      rhy: 2.25,
      latR: -0.1,
      ba: Math.PI + 0.42 + Math.sin(clock * 3.2) * 0.1,
      lhx: 0.1,
      lhy: 1.2 + Math.sin(clock * 4.1) * 0.12,
      latL: 0.35,
      lean: -0.1,
      head: -0.15,
      lfx: -0.18,
      rfx: 0.18,
      lfy: jump * 0.6,
      rfy: jump * 0.6,
    };
  } else if (action === 'celebrateSmall') {
    pose = interpolateKeyframes([
      [0, REST],
      [0.45, { rhx: 0.3, rhy: 1.9, lhx: -0.1, lhy: 0.6, air: 0.03 }],
      [1, { rhx: 0.3, rhy: 1.9 }],
    ], t);
  } else if (action === 'victory') {
    pose = interpolateKeyframes([
      [0, REST],
      [1, { grip: 1, rhx: 0.1, rhy: 2.25, latR: -0.1, ba: Math.PI + 0.42, lhx: 0.1, lhy: 1.2, latL: 0.35, lean: -0.1, head: -0.15, lfx: -0.18, rfx: 0.18 }],
    ], t);
  } else if (action === 'handsUp') {
    pose = interpolateKeyframes([
      [0, REST],
      [0.4, { lhx: -0.1, lhy: 2.1, rhx: 0.3, rhy: 2.1, lfx: -0.2, rfx: 0.2 }],
      [1, { lhx: -0.1, lhy: 2.1, rhx: 0.3, rhy: 2.1 }],
    ], t);
  } else if (action === 'defeat') {
    pose = interpolateKeyframes([
      [0, REST],
      [1, { lean: 0.25, head: 0.4, lhx: 0.1, lhy: 0.3, rhx: 0.1, rhy: 0.3, crouch: 0.05 }],
    ], t);
  } else if (action === 'walkAway') {
    pose = runCycle(clock, 0.22, 0.1, 0.05, 0.8, false);
    pose.lean = 0.2;
    pose.head = 0.25;

  // 8. UMPIRE SIGNALS
  } else if (action === 'umpireOut') {
    pose = interpolateKeyframes([
      [0, REST],
      [0.4, { rhx: 0.15, rhy: 2.15 }],
      [1, { rhx: 0.15, rhy: 2.15 }],
    ], t);
  } else if (action === 'umpireFour') {
    pose = { rhx: 0.5 + Math.sin(clock * 10) * 0.25, rhy: 1.3 };
  } else if (action === 'umpireSix') {
    pose = interpolateKeyframes([
      [0, REST],
      [0.4, { lhx: 0.15, lhy: 2.15, rhx: 0.35, rhy: 2.15 }],
      [1, { lhx: 0.15, lhy: 2.15, rhx: 0.35, rhy: 2.15 }],
    ], t);
  } else if (action === 'appeal') {
    pose = interpolateKeyframes([
      [0, REST],
      [0.3, { lhx: 0.3, lhy: 2.1, rhx: 0.4, rhy: 2.1, lean: -0.1, head: -0.1 }],
      [1, { lhx: 0.3, lhy: 2.1, rhx: 0.4, rhy: 2.1, lean: -0.1 }],
    ], t);
  }

  // Left-handed batter mirroring: mirror feet and lateral offsets (not raw negative scale on mesh)
  if (isLeftHanded && pose.yw) {
    const origLfx = pose.lfx ?? REST.lfx;
    const origRfx = pose.rfx ?? REST.rfx;
    pose.lfx = origRfx;
    pose.rfx = origLfx;
    if (pose.ba) pose.ba = -pose.ba;
    if (pose.latL || pose.latR) {
      const ol = pose.latL || 0;
      pose.latL = -(pose.latR || 0);
      pose.latR = -ol;
    }
  }

  return { ...REST, ...pose };
}
