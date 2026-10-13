import { Player } from '../../types/common';
import { PitchType, WeatherCondition } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';

export interface Point {
  x: number;
  y: number;
}

export type FieldPositionCategory = 'CATCHING' | 'RING' | 'BOUNDARY';
export type RingDistance = 'CLOSE' | 'INNER' | 'OUTER';

export interface FieldPositionDef {
  key: string;
  name: string;
  x: number;
  y: number;
  category: FieldPositionCategory;
  ringDistance: RingDistance;
  isOutsideCircle: boolean;
  tacticalRole: string;
}

export interface BowlingPlan {
  line: 'OUTSIDE_OFF' | 'STUMPS' | 'DOWN_LEG' | 'WIDE_OUTSIDE_OFF';
  length: 'YORKER' | 'FULL' | 'GOOD' | 'SHORT' | 'BOUNCER';
  variation: 'NORMAL' | 'SLOWER_BALL' | 'SWING' | 'REVERSE_SWING' | 'GOOGLY' | 'TOP_SPIN';
  intent: 'ATTACKING' | 'CONTAINING' | 'WICKET_TAKING' | 'DEFENSIVE' | 'SHORT_BALL_TRAP';
  summary: string;
}

export interface FielderAssignment {
  id: string;
  name: string;
  role: string;
  positionKey: string;
  positionName: string;
  currentPos: Point;
  targetPos: Point;
  isOutsideCircle: boolean;
  isCatching: boolean;
  tacticalRole: string;
}

export interface ScoringZoneData {
  zone: string;
  angleRange: [number, number];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  runsScored: number;
  protection: 'COVERED' | 'OPEN';
}

export interface FieldConfiguration {
  id: string;
  name: string;
  format: ArenaFormat;
  phase: string;
  tacticalIntent: string;
  bowlingPlan: BowlingPlan;
  fielders: FielderAssignment[];
  maxOutsideCircle: number;
  actualOutsideCircle: number;
  offSideCount: number;
  legSideCount: number;
  isCompliant: boolean;
  changedFielders: Array<{
    playerId: string;
    playerName: string;
    fromRole: string;
    toRole: string;
    fromPoint: Point;
    toPoint: Point;
  }>;
  scoringZones: ScoringZoneData[];
}

export interface FieldStrategyInput {
  format: ArenaFormat;
  bowler: Player | null;
  striker: Player | null;
  nonStriker: Player | null;
  overs: number;
  balls: number;
  wickets: number;
  runs: number;
  target?: number;
  pitch: PitchType;
  weather: WeatherCondition;
  partnershipRuns?: number;
  partnershipBalls?: number;
  recentDeliveries?: Array<{ runs: number; outcome: string; isWicket?: boolean }>;
  fieldingSquad?: Player[];
  previousConfig?: FieldConfiguration | null;
  manualPresetKey?: string;
  testDaySession?: { day: number; session: 'Morning' | 'Afternoon' | 'Evening' };
  ballAgeOvers?: number;
}

// ─── CANONICAL 3D FIELD POSITION REGISTRY (600 x 600 Ground Space) ───────────
// Center = (300, 300), Pitch = y 170-430, Batter Crease = (300, 410)
// Inner Circle ellipse: rx=160, ry=190. Boundary R=268.
export const CANONICAL_POSITIONS: Record<string, FieldPositionDef> = {
  // Wicketkeeper (Constant anchor)
  WICKETKEEPER: { key: 'WICKETKEEPER', name: 'Wicketkeeper', x: 300, y: 460, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Primary Catcher / Stumps Guard' },

  // Slip Cordon (Off-side Catchers behind square)
  FIRST_SLIP: { key: 'FIRST_SLIP', name: '1st Slip', x: 265, y: 472, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Edge Catcher' },
  SECOND_SLIP: { key: 'SECOND_SLIP', name: '2nd Slip', x: 240, y: 486, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Edge Catcher' },
  THIRD_SLIP: { key: 'THIRD_SLIP', name: '3rd Slip', x: 215, y: 500, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Attacking Edge Trap' },
  GULLY: { key: 'GULLY', name: 'Gully', x: 190, y: 450, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Squarer Edge Intercept' },
  FLY_SLIP: { key: 'FLY_SLIP', name: 'Fly Slip', x: 220, y: 525, category: 'CATCHING', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Upper Cut / Ramp Trap' },
  LEG_SLIP: { key: 'LEG_SLIP', name: 'Leg Slip', x: 345, y: 470, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Glance / Turn Catcher' },

  // Close Infield Helmet Catchers
  SILLY_POINT: { key: 'SILLY_POINT', name: 'Silly Point', x: 245, y: 390, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Bat-Pad Off Trap' },
  SHORT_LEG: { key: 'SHORT_LEG', name: 'Short Leg', x: 355, y: 390, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Bat-Pad Leg Trap' },
  SILLY_MID_OFF: { key: 'SILLY_MID_OFF', name: 'Silly Mid-Off', x: 265, y: 335, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Drive Choker' },
  SILLY_MID_ON: { key: 'SILLY_MID_ON', name: 'Silly Mid-On', x: 335, y: 335, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'On-Drive Choker' },

  // 30-Yard Ring Infield (Single-Savers)
  BACKWARD_POINT: { key: 'BACKWARD_POINT', name: 'Backward Point', x: 175, y: 420, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Cut & Steer Stopper' },
  POINT: { key: 'POINT', name: 'Point', x: 155, y: 395, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Square Cut Sentry' },
  COVER_POINT: { key: 'COVER_POINT', name: 'Cover Point', x: 185, y: 335, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Punch Intercept' },
  COVER: { key: 'COVER', name: 'Cover', x: 170, y: 285, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Off-Drive Stopper' },
  EXTRA_COVER: { key: 'EXTRA_COVER', name: 'Extra Cover', x: 215, y: 255, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Lofted Drive Patrol' },
  MID_OFF: { key: 'MID_OFF', name: 'Mid-Off', x: 245, y: 195, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Straight Drive Control' },
  MID_ON: { key: 'MID_ON', name: 'Mid-On', x: 355, y: 195, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Straight On-Drive Control' },
  MID_WICKET: { key: 'MID_WICKET', name: 'Mid-Wicket', x: 425, y: 285, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Flick & Pull Stopper' },
  SQUARE_LEG: { key: 'SQUARE_LEG', name: 'Square Leg', x: 440, y: 405, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Clip / Sweep Sentry' },
  SHORT_FINE_LEG: { key: 'SHORT_FINE_LEG', name: 'Short Fine Leg', x: 385, y: 465, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Glance Single Stopper' },
  SHORT_THIRD_MAN: { key: 'SHORT_THIRD_MAN', name: 'Short Third Man', x: 210, y: 470, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Edge & Guide Saver' },

  // Deep Outfield Boundary Sweepers (Boundary Protectors)
  DEEP_THIRD_MAN: { key: 'DEEP_THIRD_MAN', name: 'Deep Third Man', x: 145, y: 495, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Upper Edge Boundary Patrol' },
  DEEP_POINT: { key: 'DEEP_POINT', name: 'Deep Point', x: 75, y: 385, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Square Cut Boundary Guard' },
  DEEP_COVER: { key: 'DEEP_COVER', name: 'Deep Cover', x: 95, y: 220, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Lofted Cover Sweeper' },
  SWEEPER_COVER: { key: 'SWEEPER_COVER', name: 'Deep Cover Sweeper', x: 80, y: 260, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Deep Off-Side Sentry' },
  LONG_OFF: { key: 'LONG_OFF', name: 'Long-Off', x: 235, y: 75, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Straight Boundary Guard' },
  LONG_ON: { key: 'LONG_ON', name: 'Long-On', x: 365, y: 75, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Straight Boundary Guard' },
  COW_CORNER: { key: 'COW_CORNER', name: 'Cow Corner', x: 480, y: 165, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Slog Sweep Boundary Patrol' },
  DEEP_MID_WICKET: { key: 'DEEP_MID_WICKET', name: 'Deep Mid-Wicket', x: 515, y: 240, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Pull Shot Boundary Guard' },
  DEEP_SQUARE_LEG: { key: 'DEEP_SQUARE_LEG', name: 'Deep Square Leg', x: 525, y: 395, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Hook / Pull Sweeper' },
  DEEP_FINE_LEG: { key: 'DEEP_FINE_LEG', name: 'Deep Fine Leg', x: 410, y: 495, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Hook / Glance Boundary Guard' },
};

export class BowlerFieldStrategyEngine {
  /**
   * Helper: mirror coordinates for left-handed batter across ground vertical axis (x=300).
   */
  public static mirrorForLeftHander(pos: Point, isLeftHanded: boolean): Point {
    if (!isLeftHanded) return { x: pos.x, y: pos.y };
    return {
      x: 600 - pos.x,
      y: pos.y,
    };
  }

  /**
   * Alias for calculateFieldConfiguration.
   */
  public static generateFieldConfiguration(input: FieldStrategyInput): FieldConfiguration {
    return this.calculateFieldConfiguration(input);
  }

  /**
   * Determine whether batter is left-handed based on battingHand property or known player name.
   */
  public static isLeftHandedBatter(batter: Player | null): boolean {
    if (!batter) return false;
    const hand = (batter as any).battingHand || (batter as any).hand;
    if (hand) return String(hand).toLowerCase().includes('left');

    const knownLefties = [
      'rishabh pant', 'shivam dube', 'quinton de kock', 'yashasvi jaiswal',
      'ravindra jadeja', 'david warner', 'travis head', 'abhishek sharma',
      'nicholas pooran', 'shikhar dhawan', 'rinku singh', 'devdutt padikkal',
      'ben stokes', 'rachin ravindra', 'tilak varma', 'axar patel',
    ];
    return knownLefties.some(name => batter.name.toLowerCase().includes(name));
  }

  /**
   * Determine bowler type (Pace vs Spin).
   */
  public static isSpinBowler(bowler: Player | null): boolean {
    if (!bowler) return false;
    const style = (bowler.bowlingStyle || '').toLowerCase();
    if (style.includes('spin') || style.includes('leg') || style.includes('off') || style.includes('slow')) return true;
    const knownSpinners = ['rashid', 'chahal', 'kuldeep', 'varun', 'narine', 'ashwin', 'jadeja', 'bishnoi', 'santner', 'shakib', 'hasaranga', 'zampa', 'shamsi'];
    return knownSpinners.some(tok => bowler.name.toLowerCase().includes(tok));
  }

  /**
   * Main calculation entry point: generates tactical field configuration for the given match context.
   */
  public static calculateFieldConfiguration(input: FieldStrategyInput): FieldConfiguration {
    const { format, bowler, striker, overs, wickets, pitch, fieldingSquad, previousConfig } = input;
    const isLeftHander = this.isLeftHandedBatter(striker);
    const isSpinner = this.isSpinBowler(bowler);

    let maxOutsideCircle = 5;
    let phaseName = 'Middle';
    let configName = 'Tactical Balanced';
    let intentText = 'Control singles and apply pressure';
    let bowlingPlan: BowlingPlan;
    let selectedKeys: string[] = [];

    // ─────────────────────────────────────────────────────────────────────────
    // 1. FORMAT-SPECIFIC FIELD LOGIC
    // ─────────────────────────────────────────────────────────────────────────
    if (format === 'TEST') {
      // ════ TEST CRICKET ENGINE ════
      const ballAge = input.ballAgeOvers ?? (overs % 80);
      const isNewBall = ballAge < 16 || overs < 16;
      const day = input.testDaySession?.day ?? (Math.floor(overs / 90) + 1);
      const session = input.testDaySession?.session ?? (overs % 90 < 30 ? 'Morning' : overs % 90 < 60 ? 'Afternoon' : 'Evening');
      maxOutsideCircle = 9; // No fielding circle limits in Test cricket!

      if (isNewBall && !isSpinner) {
        phaseName = `New Ball (Day ${day} ${session})`;
        configName = 'Attacking Slip Cordon (Test)';
        intentText = 'Seam and swing in the corridor of uncertainty; hunting edges with 3 slips and gully';
        bowlingPlan = {
          line: 'OUTSIDE_OFF',
          length: 'GOOD',
          variation: 'SWING',
          intent: 'WICKET_TAKING',
          summary: 'Good length 4th stump line probing outside edge with outswing',
        };
        selectedKeys = [
          'FIRST_SLIP', 'SECOND_SLIP', 'THIRD_SLIP', 'GULLY',
          'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'
        ];
      } else if (isSpinner || pitch === PitchType.SPIN || pitch === PitchType.SLOW) {
        phaseName = `Spin Trap (Day ${day} ${session})`;
        configName = 'Turning Pitch Bat-Pad Trap (Test)';
        intentText = 'Smothering batter with close catchers around the bat capitalizing on turn and bounce';
        bowlingPlan = {
          line: 'STUMPS',
          length: 'FULL',
          variation: 'TOP_SPIN',
          intent: 'ATTACKING',
          summary: 'Drifting into right-hander pads, sharp grip and turn off pitch rough',
        };
        selectedKeys = [
          'FIRST_SLIP', 'LEG_SLIP', 'SHORT_LEG', 'SILLY_POINT',
          'POINT', 'MID_WICKET', 'MID_OFF', 'MID_ON', 'DEEP_MID_WICKET'
        ];
      } else if (wickets >= 7) {
        phaseName = 'Tail-ender Pressure';
        configName = 'Throat Ball & Close Ring (Test)';
        intentText = 'Aggressive short ball trap with catchers under the helmet and deep backward square';
        bowlingPlan = {
          line: 'STUMPS',
          length: 'SHORT',
          variation: 'NORMAL',
          intent: 'SHORT_BALL_TRAP',
          summary: 'Bouncer aimed at chest, short leg and deep square leg waiting',
        };
        selectedKeys = [
          'FIRST_SLIP', 'GULLY', 'SHORT_LEG', 'SILLY_MID_ON',
          'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_SQUARE_LEG', 'DEEP_FINE_LEG'
        ];
      } else {
        phaseName = `Settled Batter (Day ${day} ${session})`;
        configName = 'Patience & Maiden Squeeze (Test)';
        intentText = 'Drying up scoring avenues, plugging cover and mid-wicket to force false stroke';
        bowlingPlan = {
          line: 'OUTSIDE_OFF',
          length: 'GOOD',
          variation: 'NORMAL',
          intent: 'CONTAINING',
          summary: 'Relentless 5th-stump discipline with 2 slips and packed off-side ring',
        };
        selectedKeys = [
          'FIRST_SLIP', 'SECOND_SLIP', 'GULLY', 'POINT',
          'COVER', 'EXTRA_COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'
        ];
      }
    } else if (format === 'ODI') {
      // ════ ODI CRICKET ENGINE ════
      if (overs < 10) {
        // Powerplay 1 (Overs 1-10) — Max 2 Outside Circle, 2 Catchers Required
        maxOutsideCircle = 2;
        phaseName = 'Powerplay 1 (Overs 1–10)';
        configName = 'ODI Powerplay Ring (2 Slips)';
        intentText = 'Attacking with 2 slips while guarding deep boundaries strictly within mandatory 2-outside limit';
        bowlingPlan = {
          line: 'OUTSIDE_OFF',
          length: 'GOOD',
          variation: isSpinner ? 'NORMAL' : 'SWING',
          intent: 'ATTACKING',
          summary: 'New ball seam movement challenging off-stump with slip protection',
        };
        selectedKeys = [
          'FIRST_SLIP', 'SECOND_SLIP', 'POINT', 'COVER',
          'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'
        ];
      } else if (overs < 40) {
        // Middle Overs (11-40) — Max 4 Outside Circle
        maxOutsideCircle = 4;
        phaseName = 'Middle Overs (11–40)';
        configName = isSpinner ? 'ODI Spin Choke (4 Deep)' : 'ODI Balanced 4-Deep Split';
        intentText = 'Choking rotation of strike through ring fielders with 4 deep sweepers for lofted shots';
        bowlingPlan = {
          line: isSpinner ? 'STUMPS' : 'OUTSIDE_OFF',
          length: 'GOOD',
          variation: isSpinner ? 'GOOGLY' : 'SLOWER_BALL',
          intent: 'CONTAINING',
          summary: 'Varying pace and length to induce mishits against 4 boundary sweepers',
        };
        selectedKeys = isSpinner ? [
          'FIRST_SLIP', 'POINT', 'COVER', 'MID_WICKET',
          'SHORT_FINE_LEG', 'LONG_OFF', 'LONG_ON', 'DEEP_COVER', 'DEEP_MID_WICKET'
        ] : [
          'POINT', 'COVER_POINT', 'COVER', 'MID_OFF',
          'MID_ON', 'DEEP_THIRD_MAN', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET'
        ];
      } else {
        // Death Overs (41-50) — Max 5 Outside Circle
        maxOutsideCircle = 5;
        phaseName = 'Death Overs (41–50)';
        configName = 'ODI Death Yorker Defense (5 Deep)';
        intentText = 'Protecting boundaries with 5 fielders on the rope, executing blockhole yorkers';
        bowlingPlan = {
          line: 'WIDE_OUTSIDE_OFF',
          length: 'YORKER',
          variation: 'SLOWER_BALL',
          intent: 'DEFENSIVE',
          summary: 'Pinpoint wide yorkers starving batters of hitting leverage down the ground',
        };
        selectedKeys = [
          'SHORT_THIRD_MAN', 'POINT', 'COVER', 'SHORT_FINE_LEG',
          'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'
        ];
      }
    } else {
      // ════ T20 & IPL CRICKET ENGINE ════
      if (overs < 6) {
        // Powerplay (1-6) — Max 2 Outside Circle
        maxOutsideCircle = 2;
        phaseName = 'Powerplay (Overs 1–6)';
        configName = 'T20 Powerplay Ring & Slip';
        intentText = 'Stopping early boundary blitz with 1 slip and packed 30-yard ring, 2 on boundary';
        bowlingPlan = {
          line: 'OUTSIDE_OFF',
          length: 'FULL',
          variation: isSpinner ? 'NORMAL' : 'SWING',
          intent: 'ATTACKING',
          summary: 'Full swinging delivery enticing drive towards ring catchers',
        };
        selectedKeys = [
          'FIRST_SLIP', 'POINT', 'COVER', 'EXTRA_COVER',
          'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'
        ];
      } else if (overs < 16) {
        // Middle Overs (7-15) — Max 5 Outside Circle
        maxOutsideCircle = 5;
        phaseName = 'Middle Overs (7–15)';
        configName = isSpinner ? 'T20 Spin Web (5 Deep)' : 'T20 Middle Squeeze (5 Deep)';
        intentText = 'Starving boundaries and building pressure with 5 deep fielders and active sweeper';
        bowlingPlan = {
          line: isSpinner ? 'STUMPS' : 'OUTSIDE_OFF',
          length: 'GOOD',
          variation: isSpinner ? 'GOOGLY' : 'SLOWER_BALL',
          intent: 'CONTAINING',
          summary: 'Hard length cutters forcing batter to hit to the longest boundary dimensions',
        };
        selectedKeys = isSpinner ? [
          'POINT', 'COVER', 'MID_WICKET', 'SHORT_FINE_LEG',
          'DEEP_COVER', 'LONG_OFF', 'LONG_ON', 'COW_CORNER', 'DEEP_MID_WICKET'
        ] : [
          'POINT', 'COVER', 'MID_OFF', 'SHORT_FINE_LEG',
          'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'
        ];
      } else {
        // Death Overs (16-20) — Max 5 Outside Circle
        maxOutsideCircle = 5;
        phaseName = 'Death Overs (16–20)';
        configName = 'T20 Death Yorker Shield';
        intentText = 'All-out boundary protection: 5 deep sentries, wide line yorkers, zero slot balls';
        bowlingPlan = {
          line: 'WIDE_OUTSIDE_OFF',
          length: 'YORKER',
          variation: 'SLOWER_BALL',
          intent: 'DEFENSIVE',
          summary: 'Laser-accurate wide tramline yorkers with deep cover and long-off back on the rope',
        };
        selectedKeys = [
          'SHORT_THIRD_MAN', 'POINT', 'COVER', 'SHORT_FINE_LEG',
          'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'
        ];
      }
    }

    // Adapt to manual preset request if specified
    if (input.manualPresetKey && this.PRESET_OVERLAYS[input.manualPresetKey]) {
      const preset = this.PRESET_OVERLAYS[input.manualPresetKey];
      configName = preset.name;
      selectedKeys = [...preset.keys];
      intentText = preset.intent;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ASSIGN REAL FIELDERS FROM SQUAD
    // ─────────────────────────────────────────────────────────────────────────
    const availableSquad = (fieldingSquad && fieldingSquad.length >= 11)
      ? fieldingSquad
      : this.getDefaultFieldingSquad();

    // Player 0: Bowler (Anchor at bowler crease)
    // Player 1: Wicketkeeper (Anchor at stumps)
    // Players 2..10: The 9 dynamic fielders
    const keeper = availableSquad.find(p => p.role === 'Wicketkeeper') || availableSquad[1];
    const otherPlayers = availableSquad.filter(p => p.id !== bowler?.id && p.id !== keeper.id);

    // Build the 9 fielders
    const fielders: FielderAssignment[] = [];
    const prevFielders = previousConfig?.fielders || [];
    const changedFielders: FieldConfiguration['changedFielders'] = [];

    // Add Wicketkeeper
    const wkBase = CANONICAL_POSITIONS.WICKETKEEPER;
    const wkTarget = isLeftHander ? this.mirrorForLeftHander(wkBase, true) : { x: wkBase.x, y: wkBase.y };
    fielders.push({
      id: keeper.id,
      name: keeper.name,
      role: keeper.role,
      positionKey: wkBase.key,
      positionName: wkBase.name,
      currentPos: { ...wkTarget },
      targetPos: { ...wkTarget },
      isOutsideCircle: false,
      isCatching: true,
      tacticalRole: wkBase.tacticalRole,
    });

    // Add 9 Dynamic Fielders
    selectedKeys.slice(0, 9).forEach((posKey, idx) => {
      const pDef = CANONICAL_POSITIONS[posKey] || CANONICAL_POSITIONS.MID_OFF;
      const assignedPlayer = otherPlayers[idx] || otherPlayers[idx % otherPlayers.length];
      const targetPos = this.mirrorForLeftHander(pDef, isLeftHander);

      // Find if this player had a previous position to calculate movement
      const prevAssign = prevFielders.find(f => f.id === assignedPlayer.id);
      const currentPos = prevAssign ? { ...prevAssign.targetPos } : { ...targetPos };

      const dist = Math.hypot(currentPos.x - targetPos.x, currentPos.y - targetPos.y);
      if (prevAssign && dist > 15) {
        changedFielders.push({
          playerId: assignedPlayer.id,
          playerName: assignedPlayer.name,
          fromRole: prevAssign.positionName,
          toRole: pDef.name,
          fromPoint: { ...currentPos },
          toPoint: { ...targetPos },
        });
      }

      fielders.push({
        id: assignedPlayer.id,
        name: assignedPlayer.name,
        role: assignedPlayer.role,
        positionKey: pDef.key,
        positionName: pDef.name,
        currentPos,
        targetPos,
        isOutsideCircle: pDef.isOutsideCircle,
        isCatching: pDef.category === 'CATCHING',
        tacticalRole: pDef.tacticalRole,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. COMPLIANCE & TACTICAL METRICS
    // ─────────────────────────────────────────────────────────────────────────
    const actualOutside = fielders.filter(f => f.isOutsideCircle).length;
    const offSide = fielders.filter(f => isLeftHander ? f.targetPos.x > 300 : f.targetPos.x < 300).length;
    const legSide = fielders.filter(f => isLeftHander ? f.targetPos.x < 300 : f.targetPos.x > 300).length;
    const isCompliant = format === 'TEST' || actualOutside <= maxOutsideCircle;

    // ─────────────────────────────────────────────────────────────────────────
    // 4. SCORING ZONES CALCULATION (360° Wagon Wheel)
    // ─────────────────────────────────────────────────────────────────────────
    const scoringZones = this.computeScoringZones(fielders, isLeftHander);

    return {
      id: `field_cfg_${Date.now()}`,
      name: configName,
      format,
      phase: phaseName,
      tacticalIntent: intentText,
      bowlingPlan,
      fielders,
      maxOutsideCircle,
      actualOutsideCircle: actualOutside,
      offSideCount: offSide,
      legSideCount: legSide,
      isCompliant,
      changedFielders,
      scoringZones,
    };
  }

  /**
   * Evaluates if field recalculation is required based on game events.
   */
  public static shouldRecalculateField(
    prev: FieldConfiguration | null,
    currentOvers: number,
    previousOvers: number,
    currentBowlerId: string | null,
    previousBowlerId: string | null,
    wicketJustFell: boolean,
    consecutiveBoundaries: boolean,
    manualRequested: boolean
  ): boolean {
    if (!prev) return true;
    if (manualRequested) return true;
    if (wicketJustFell) return true;
    if (currentBowlerId !== previousBowlerId) return true;
    if (Math.floor(currentOvers) !== Math.floor(previousOvers)) return true; // Over completed
    if (consecutiveBoundaries) return true;
    return false;
  }

  /**
   * Helper: computes 360-degree scoring zones and protection status.
   */
  private static computeScoringZones(fielders: FielderAssignment[], isLeftHander: boolean): ScoringZoneData[] {
    const zones = [
      { name: 'Third Man & Gully', angleRange: [-150, -110] as [number, number] },
      { name: 'Point & Backward Point', angleRange: [-110, -70] as [number, number] },
      { name: 'Cover & Extra Cover', angleRange: [-70, -25] as [number, number] },
      { name: 'Straight Long-Off', angleRange: [-25, 0] as [number, number] },
      { name: 'Straight Long-On', angleRange: [0, 25] as [number, number] },
      { name: 'Mid-Wicket & Cow Corner', angleRange: [25, 70] as [number, number] },
      { name: 'Square Leg', angleRange: [70, 110] as [number, number] },
      { name: 'Fine Leg', angleRange: [110, 150] as [number, number] },
    ];

    return zones.map(z => {
      // Find fielders stationed within this angular cone from batter crease (300, 410)
      const hasCoverage = fielders.some(f => {
        const dx = f.targetPos.x - 300;
        const dy = f.targetPos.y - 410;
        const deg = Math.atan2(dx, -dy) * (180 / Math.PI);
        return deg >= z.angleRange[0] && deg <= z.angleRange[1];
      });

      return {
        zone: z.name,
        angleRange: z.angleRange,
        riskLevel: hasCoverage ? 'LOW' : 'HIGH',
        runsScored: hasCoverage ? Math.floor(Math.random() * 8) : 12 + Math.floor(Math.random() * 14),
        protection: hasCoverage ? 'COVERED' : 'OPEN',
      };
    });
  }

  /**
   * Tactical Preset Overlays for manual selection.
   */
  public static readonly PRESET_OVERLAYS: Record<string, { name: string; keys: string[]; intent: string }> = {
    BALANCED_RING: {
      name: 'Balanced Ring (4-5 Split)',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_MID_WICKET', 'DEEP_COVER'],
      intent: 'Even distribution of boundary sweepers and ring single savers',
    },
    ATTACKING_SLIP_CORDON: {
      name: 'Aggressive Slips & Catchers',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'THIRD_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'],
      intent: 'Full edge trap behind the wicket attacking outside edge',
    },
    DEATH_YORKER_SHIELD: {
      name: 'Death Yorker Boundary Shield',
      keys: ['SHORT_THIRD_MAN', 'POINT', 'COVER', 'SHORT_FINE_LEG', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Boundary denial with 5 sentries back on the rope for blockhole bowling',
    },
    SPIN_TRAP_WEB: {
      name: 'Spin Web & Leg Slip',
      keys: ['FIRST_SLIP', 'LEG_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_WICKET', 'DEEP_COVER', 'LONG_ON', 'DEEP_MID_WICKET'],
      intent: 'Catching ring around the bat with boundary sweepers for aerial mis-hits',
    },
    SHORT_BALL_AMBUSH: {
      name: 'Short Ball Bouncer Trap',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_SQUARE_LEG', 'DEEP_MID_WICKET', 'DEEP_FINE_LEG'],
      intent: 'Bouncer ambush with 3 deep leg-side catchers for hook and pull shots',
    },
  };

  /**
   * Fallback mock squad if none provided.
   */
  private static getDefaultFieldingSquad(): Player[] {
    return [
      { id: 'p_bowler', name: 'Bowler', role: 'Bowler', rating: 88, stats: { bowling: 88 } } as any,
      { id: 'p_wk', name: 'Wicketkeeper', role: 'Wicketkeeper', rating: 85, stats: { batting: 85 } } as any,
      { id: 'p_1', name: 'Slip Catcher', role: 'Batsman', rating: 86, stats: {} } as any,
      { id: 'p_2', name: 'Gully Fielder', role: 'All-rounder', rating: 84, stats: {} } as any,
      { id: 'p_3', name: 'Point Guard', role: 'Batsman', rating: 85, stats: {} } as any,
      { id: 'p_4', name: 'Cover Patrol', role: 'Batsman', rating: 87, stats: {} } as any,
      { id: 'p_5', name: 'Extra Cover', role: 'Batsman', rating: 83, stats: {} } as any,
      { id: 'p_6', name: 'Mid-Off', role: 'Bowler', rating: 82, stats: {} } as any,
      { id: 'p_7', name: 'Mid-On', role: 'Bowler', rating: 82, stats: {} } as any,
      { id: 'p_8', name: 'Mid-Wicket', role: 'All-rounder', rating: 86, stats: {} } as any,
      { id: 'p_9', name: 'Deep Sweeper', role: 'Bowler', rating: 85, stats: {} } as any,
    ];
  }
}
