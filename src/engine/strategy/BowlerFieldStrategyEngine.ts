import { Player } from '../../types/common';
import { PitchType, WeatherCondition } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';
import {
  getFieldingPhase,
  getLegSideLimit,
  isOnLegSide,
} from '../fielding/FieldingRestrictionEngine';
import { BatterScoringMemory, BatterScoringProfile } from '../analytics/BatterScoringMemory';

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
  fieldingRating?: number;
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
  /** Active Law 28.3 leg-side maximum applied to this configuration. */
  legSideLimit?: number;
  /** True when the strict two-fielder movement budget deferred part of the ideal change. */
  movementLimited?: boolean;
  /** Historical scoring profile of the active striker used for tactical field placement. */
  batterProfile?: BatterScoringProfile;
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
  /** Total overs of the (possibly reduced) innings — rescales phase windows. */
  totalOvers?: number;
  /** Batter's recently punished scoring arcs (wagon zones) — attracts fielders within the movement budget. */
  hotZones?: string[];
  /** Strict per-update movement budget (default 2, per the Laws of the game's flow). */
  maxFielderMoves?: number;
  /** Competition season — used for season-keyed rules (e.g. IPL). */
  season?: number;
}

// ─── CANONICAL 3D FIELD POSITION REGISTRY (600 x 600 Ground Space) ───────────
// Center = (300, 300), Pitch = y 170-430, Batter Crease = (300, 410)
// Inner Circle ellipse: rx=160, ry=190. Boundary R=268.
export const CANONICAL_POSITIONS: Record<string, FieldPositionDef> = {
  // Bowler (Anchored at bowling crease)
  BOWLER: { key: 'BOWLER', name: 'Bowler', x: 300, y: 190, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Delivery & Return Catch / Bowler Crease' },

  // Wicketkeeper (Constant anchor behind striker)
  WICKETKEEPER: { key: 'WICKETKEEPER', name: 'Wicketkeeper', x: 300, y: 460, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Primary Catcher / Stumps Guard' },

  // Slip Cordon (Off-side Catchers behind square with natural, non-overlapping spacing)
  FIRST_SLIP: { key: 'FIRST_SLIP', name: '1st Slip', x: 255, y: 476, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Edge Catcher' },
  SECOND_SLIP: { key: 'SECOND_SLIP', name: '2nd Slip', x: 224, y: 494, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Edge Catcher' },
  THIRD_SLIP: { key: 'THIRD_SLIP', name: '3rd Slip', x: 194, y: 512, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Attacking Edge Trap' },
  FOURTH_SLIP: { key: 'FOURTH_SLIP', name: '4th Slip', x: 165, y: 530, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Deep Cordon Catcher' },
  GULLY: { key: 'GULLY', name: 'Gully', x: 175, y: 440, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Squarer Edge Intercept' },
  FLY_SLIP: { key: 'FLY_SLIP', name: 'Fly Slip', x: 220, y: 530, category: 'CATCHING', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Upper Cut / Ramp Trap' },
  LEG_SLIP: { key: 'LEG_SLIP', name: 'Leg Slip', x: 345, y: 474, category: 'CATCHING', ringDistance: 'CLOSE', isOutsideCircle: false, tacticalRole: 'Glance / Turn Catcher' },

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
  FORWARD_SQUARE_LEG: { key: 'FORWARD_SQUARE_LEG', name: 'Forward Square Leg', x: 425, y: 350, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Short Midwicket / Pad Saver' },
  SQUARE_LEG: { key: 'SQUARE_LEG', name: 'Square Leg', x: 440, y: 405, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Clip / Sweep Sentry' },
  BACKWARD_SQUARE_LEG: { key: 'BACKWARD_SQUARE_LEG', name: 'Backward Square Leg', x: 420, y: 440, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Square Leg Glance Intercept' },
  SHORT_FINE_LEG: { key: 'SHORT_FINE_LEG', name: 'Short Fine Leg', x: 385, y: 465, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Glance Single Stopper' },
  SHORT_THIRD_MAN: { key: 'SHORT_THIRD_MAN', name: 'Short Third Man', x: 210, y: 470, category: 'RING', ringDistance: 'INNER', isOutsideCircle: false, tacticalRole: 'Edge & Guide Saver' },

  // Deep Outfield Boundary Sweepers (Boundary Protectors)
  DEEP_THIRD: { key: 'DEEP_THIRD', name: 'Deep Third', x: 160, y: 520, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Fine Boundary Third Sentry' },
  DEEP_THIRD_MAN: { key: 'DEEP_THIRD_MAN', name: 'Deep Third Man', x: 145, y: 495, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Upper Edge Boundary Patrol' },
  DEEP_BACKWARD_POINT: { key: 'DEEP_BACKWARD_POINT', name: 'Deep Backward Point', x: 95, y: 455, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Upper Cut Boundary Sentry' },
  DEEP_POINT: { key: 'DEEP_POINT', name: 'Deep Point', x: 75, y: 385, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Square Cut Boundary Guard' },
  DEEP_COVER: { key: 'DEEP_COVER', name: 'Deep Cover', x: 95, y: 220, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Lofted Cover Sweeper' },
  SWEEPER_COVER: { key: 'SWEEPER_COVER', name: 'Deep Cover Sweeper', x: 80, y: 260, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Deep Off-Side Sentry' },
  EXTRA_COVER_BOUNDARY: { key: 'EXTRA_COVER_BOUNDARY', name: 'Extra Cover Boundary', x: 135, y: 135, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Lofted Extra Cover Sweeper' },
  LONG_OFF: { key: 'LONG_OFF', name: 'Long-Off', x: 235, y: 75, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Straight Boundary Guard' },
  LONG_ON: { key: 'LONG_ON', name: 'Long-On', x: 365, y: 75, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Straight Boundary Guard' },
  COW_CORNER: { key: 'COW_CORNER', name: 'Cow Corner', x: 480, y: 165, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Slog Sweep Boundary Patrol' },
  DEEP_LEG_SIDE: { key: 'DEEP_LEG_SIDE', name: 'Deep Leg Side', x: 475, y: 320, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Wide Midwicket Deep Sentry' },
  DEEP_MID_WICKET: { key: 'DEEP_MID_WICKET', name: 'Deep Mid-Wicket', x: 515, y: 240, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Pull Shot Boundary Guard' },
  DEEP_SQUARE_LEG: { key: 'DEEP_SQUARE_LEG', name: 'Deep Square Leg', x: 525, y: 395, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Hook / Pull Sweeper' },
  DEEP_BACKWARD_SQUARE_LEG: { key: 'DEEP_BACKWARD_SQUARE_LEG', name: 'Deep Backward Square Leg', x: 495, y: 465, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Hook / Pull Deep Sweeper' },
  DEEP_FINE_LEG: { key: 'DEEP_FINE_LEG', name: 'Deep Fine Leg', x: 410, y: 495, category: 'BOUNDARY', ringDistance: 'OUTER', isOutsideCircle: true, tacticalRole: 'Hook / Glance Boundary Guard' },
};

// ─── PHASE BOUNDARY RESOLUTION (reduced-overs aware) ─────────────────────────
// Mirrors the rule-layer scaling: a 20-over ODI keeps proportional phases
// (powerplay 1-4, middle 5-16, death 17-20).
export interface PhaseBounds {
  /** Last over of the powerplay (1-indexed). */
  ppEnd: number;
  /** Last over of the middle phase (1-indexed). */
  midEnd: number;
  /** Total overs of the innings. */
  total: number;
}

export function phaseBoundaries(format: ArenaFormat, totalOvers?: number): PhaseBounds {
  if (format === 'TEST') return { ppEnd: 0, midEnd: 0, total: 0 };
  const base = format === 'ODI' ? 50 : 20;
  const total = totalOvers && totalOvers > 0 && totalOvers < base ? Math.floor(totalOvers) : base;
  const ppEnd = format === 'ODI'
    ? Math.max(1, Math.round((10 / 50) * total))
    : Math.max(1, Math.round((6 / 20) * total));
  const rawMid = format === 'ODI'
    ? Math.round((40 / 50) * total)
    : Math.round((15 / 20) * total);
  const midEnd = Math.min(total, Math.max(ppEnd + 1, rawMid));
  return { ppEnd, midEnd, total };
}

// ─── HOT-ZONE (WAGON ZONE) GEOMETRY ──────────────────────────────────────────
// Local arcs mirroring the captaincy wagon zones — defined here to avoid a
// circular dependency on AdaptiveCaptainEngine.
export const HOT_ZONE_ARCS: Record<string, [number, number]> = {
  THIRD_MAN_GULLY: [-150, -110],
  POINT_SQUARE: [-110, -70],
  COVER: [-70, -25],
  LONG_OFF: [-25, 0],
  LONG_ON: [0, 25],
  MID_WICKET_COW: [25, 70],
  SQUARE_LEG: [70, 110],
  FINE_LEG: [110, 150],
};

/** Angle (deg) of a point from the batter's crease, flipped for left-handers. */
export function zoneAngleFromBatter(p: Point, isLeftHanded: boolean): number {
  const deg = Math.atan2(p.x - 300, -(p.y - 410)) * (180 / Math.PI);
  return isLeftHanded ? -deg : deg;
}

/** True when the point falls inside any of the batter's recently punished arcs. */
export function isWithinHotZone(p: Point, isLeftHanded: boolean, hotZones?: string[] | null): boolean {
  if (!hotZones || hotZones.length === 0) return false;
  const deg = zoneAngleFromBatter(p, isLeftHanded);
  return hotZones.some((z) => {
    const arc = HOT_ZONE_ARCS[z];
    return !!arc && deg >= arc[0] && deg <= arc[1];
  });
}

/** Off-side replacement positions used when rebalancing a leg-side-heavy set. */
const OFF_SIDE_FALLBACKS = [
  'DEEP_THIRD_MAN', 'DEEP_POINT', 'SWEEPER_COVER', 'DEEP_COVER',
  'SHORT_THIRD_MAN', 'EXTRA_COVER', 'COVER_POINT', 'BACKWARD_POINT',
];

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

    // Phase windows + limits come from the authoritative rules layer and
    // automatically rescale for reduced-overs competitions and season rules.
    const bounds = phaseBoundaries(format, input.totalOvers);
    const activePhase = getFieldingPhase(format, overs + 1, undefined, input.totalOvers, input.season);
    const legSideLimit = getLegSideLimit(format, input.season);

    let maxOutsideCircle = activePhase.restricted ? activePhase.maxOutsideCircle : 9;
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
          'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_SQUARE_LEG', 'DEEP_THIRD_MAN'
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
      if (overs < bounds.ppEnd) {
        // Powerplay 1 — Max 2 Outside Circle, 2 Catchers Required
        phaseName = `Powerplay 1 (Overs 1–${bounds.ppEnd})`;
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
      } else if (overs < bounds.midEnd) {
        // Middle Overs — Max 4 Outside Circle
        phaseName = `Middle Overs (${bounds.ppEnd + 1}–${bounds.midEnd})`;
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
        // Death Overs — Max 5 Outside Circle
        phaseName = `Death Overs (${bounds.midEnd + 1}–${bounds.total})`;
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
      if (overs < bounds.ppEnd) {
        // Powerplay — Max 2 Outside Circle
        phaseName = `Powerplay (Overs 1–${bounds.ppEnd})`;
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
      } else if (overs < bounds.midEnd) {
        // Middle Overs — Max 5 Outside Circle
        phaseName = `Middle Overs (${bounds.ppEnd + 1}–${bounds.midEnd})`;
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
        // Death Overs — Max 5 Outside Circle
        phaseName = `Death Overs (${bounds.midEnd + 1}–${bounds.total})`;
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

    // ════ INTELLIGENT HISTORICAL BATTER SCORING-ZONE TACTICS ════
    const batterProfile = striker ? BatterScoringMemory.getBatterProfile(striker.id, {
      format,
      bowlingType: isSpinner ? 'SPIN' : 'PACE',
    }) : null;

    if (!input.manualPresetKey && batterProfile && batterProfile.sampleSizeConfidence !== 'INSUFFICIENT') {
      const topBoundary = batterProfile.topBoundaryZones[0];
      const topDismissal = batterProfile.vulnerableDismissalZones[0];
      const explanationParts: string[] = [];

      // 1. Defend top boundary scoring zones
      if (topBoundary === 'COW_CORNER' || topBoundary === 'MID_WICKET') {
        if (!selectedKeys.includes('DEEP_MID_WICKET') && !selectedKeys.includes('COW_CORNER')) {
          const replaceIdx = selectedKeys.findIndex(k => k === 'EXTRA_COVER' || k === 'COVER_POINT' || k === 'SHORT_THIRD_MAN' || k === 'POINT');
          if (replaceIdx !== -1) {
            selectedKeys[replaceIdx] = 'DEEP_MID_WICKET';
          }
        }
        explanationParts.push("Deep midwicket added to reduce the batter's frequent leg-side boundaries");
      } else if (topBoundary === 'COVER' || topBoundary === 'EXTRA_COVER') {
        if (!selectedKeys.includes('DEEP_COVER') && !selectedKeys.includes('COVER')) {
          const replaceIdx = selectedKeys.findIndex(k => k === 'SHORT_FINE_LEG' || k === 'MID_WICKET' || k === 'MID_ON');
          if (replaceIdx !== -1) {
            selectedKeys[replaceIdx] = 'DEEP_COVER';
          }
        }
        explanationParts.push("Deep cover deployed to protect batter's productive off-side driving zone");
      } else if (topBoundary === 'POINT' || topBoundary === 'DEEP_BACKWARD_POINT') {
        if (!selectedKeys.includes('DEEP_POINT') && !selectedKeys.includes('POINT')) {
          const replaceIdx = selectedKeys.findIndex(k => k === 'SHORT_FINE_LEG' || k === 'MID_ON' || k === 'EXTRA_COVER');
          if (replaceIdx !== -1) {
            selectedKeys[replaceIdx] = 'DEEP_POINT';
          }
        }
        explanationParts.push("Deep point positioned to cut off square-cut boundaries");
      } else if (topBoundary === 'LONG_OFF' || topBoundary === 'LONG_ON') {
        explanationParts.push("Boundary patrol strengthened down the ground against lofted drives");
      }

      // 2. Attack dismissal vulnerabilities
      if (topDismissal === 'FINE_THIRD_MAN' || topDismissal === 'THIRD_MAN') {
        if (!selectedKeys.includes('FIRST_SLIP')) {
          const replaceIdx = selectedKeys.findIndex(k => k === 'EXTRA_COVER' || k === 'MID_WICKET' || k === 'COVER_POINT');
          if (replaceIdx !== -1) {
            selectedKeys[replaceIdx] = 'FIRST_SLIP';
          }
        }
        explanationParts.push("First slip retained to attack outside edge vulnerability");
      }

      if (explanationParts.length > 0) {
        intentText = `${explanationParts.join('. ')}. (Adaptive AI Field Strategy)`;
      }
    } else if (batterProfile && batterProfile.sampleSizeConfidence === 'INSUFFICIENT') {
      intentText = `${intentText} (standard template deployed - limited batter scoring history)`;
    }

    // Adapt to manual preset request if specified
    if (input.manualPresetKey && this.PRESET_OVERLAYS[input.manualPresetKey]) {
      const preset = this.PRESET_OVERLAYS[input.manualPresetKey];
      configName = preset.name;
      selectedKeys = [...preset.keys];
      intentText = preset.intent;
    }

    // Law 28.3 — never station more than the legal maximum on the leg side.
    selectedKeys = this.enforceLegSideBalance(selectedKeys.slice(0, 9), isLeftHander, legSideLimit);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ASSIGN REAL FIELDERS FROM SQUAD (EXACTLY 11 PLAYERS)
    // ─────────────────────────────────────────────────────────────────────────
    const availableSquad = (fieldingSquad && fieldingSquad.length >= 11)
      ? fieldingSquad
      : this.getDefaultFieldingSquad();

    // Identify active keeper, bowler, and the remaining 9 outfielders
    const keeper = availableSquad.find(p => p.role === 'Wicketkeeper') || availableSquad[1];
    const bowlerPlayer = bowler || availableSquad.find(p => p.id !== keeper.id) || availableSquad[0];
    const otherPlayers = availableSquad.filter(p => p.id !== bowlerPlayer.id && p.id !== keeper.id);

    // Build exactly 11 fielders: 1 Bowler + 1 Keeper + 9 Dynamic Fielders
    const fielders: FielderAssignment[] = [];
    const prevFielders = previousConfig?.fielders || [];

    // Player 0: Bowler (Anchor at bowler crease)
    const bowlerBase = CANONICAL_POSITIONS.BOWLER;
    const bowlerTarget = { x: bowlerBase.x, y: bowlerBase.y };
    const prevBowler = prevFielders.find(f => f.positionKey === 'BOWLER' || f.id === bowlerPlayer.id);
    fielders.push({
      id: bowlerPlayer.id,
      name: bowlerPlayer.name,
      role: bowlerPlayer.role || 'Bowler',
      positionKey: bowlerBase.key,
      positionName: bowlerBase.name,
      currentPos: prevBowler ? { ...prevBowler.targetPos } : { ...bowlerTarget },
      targetPos: { ...bowlerTarget },
      isOutsideCircle: false,
      isCatching: false,
      tacticalRole: bowlerBase.tacticalRole,
      fieldingRating: (bowlerPlayer as any).stats?.bowling || bowlerPlayer.rating || 88,
    });

    // Player 1: Wicketkeeper (Anchor at stumps)
    const wkBase = CANONICAL_POSITIONS.WICKETKEEPER;
    const wkTarget = isLeftHander ? this.mirrorForLeftHander(wkBase, true) : { x: wkBase.x, y: wkBase.y };
    const prevKeeper = prevFielders.find(f => f.positionKey === 'WICKETKEEPER' || f.id === keeper.id);
    fielders.push({
      id: keeper.id,
      name: keeper.name,
      role: keeper.role || 'Wicketkeeper',
      positionKey: wkBase.key,
      positionName: wkBase.name,
      currentPos: prevKeeper ? { ...prevKeeper.targetPos } : { ...wkTarget },
      targetPos: { ...wkTarget },
      isOutsideCircle: false,
      isCatching: true,
      tacticalRole: wkBase.tacticalRole,
      fieldingRating: (keeper as any).stats?.batting || keeper.rating || 85,
    });

    // Players 2..10: Add 9 Dynamic Outfielders
    selectedKeys.slice(0, 9).forEach((posKey, idx) => {
      const pDef = CANONICAL_POSITIONS[posKey] || CANONICAL_POSITIONS.MID_OFF;
      const assignedPlayer = otherPlayers[idx] || otherPlayers[idx % otherPlayers.length];
      const targetPos = this.mirrorForLeftHander(pDef, isLeftHander);

      // Anchor the fielder's start point to its previous station (if known).
      const prevAssign = prevFielders.find(f => f.id === assignedPlayer.id);
      const currentPos = prevAssign ? { ...prevAssign.targetPos } : { ...targetPos };

      fielders.push({
        id: assignedPlayer.id,
        name: assignedPlayer.name,
        role: assignedPlayer.role || 'Batsman',
        positionKey: pDef.key,
        positionName: pDef.name,
        currentPos,
        targetPos,
        isOutsideCircle: pDef.isOutsideCircle,
        isCatching: pDef.category === 'CATCHING',
        tacticalRole: pDef.tacticalRole,
        fieldingRating: (assignedPlayer as any).stats?.fielding || assignedPlayer.rating || 85,
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. STRICT MOVEMENT BUDGET — at most N fielders (default 2) may be
    //    repositioned per tactical update. All other fielders hold station.
    // ─────────────────────────────────────────────────────────────────────────
    const maxMoves = input.maxFielderMoves ?? 2;
    const { changedFielders, movementLimited } = this.applyMovementLimit(fielders, previousConfig, {
      isLeftHander,
      maxMoves,
      hotZones: input.hotZones ?? [],
      maxOutsideCircle,
      legSideLimit,
      restricted: activePhase.restricted,
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 4. COMPLIANCE & TACTICAL METRICS
    // ─────────────────────────────────────────────────────────────────────────
    const actualOutside = fielders.filter(f => f.isOutsideCircle).length;
    const offSide = fielders.filter(f => f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER' && (isLeftHander ? f.targetPos.x > 300 : f.targetPos.x < 300)).length;
    const legSide = fielders.filter(f => f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER' && (isLeftHander ? f.targetPos.x < 300 : f.targetPos.x > 300)).length;
    const behindSquareLeg = fielders.filter(f => f.positionKey !== 'BOWLER' && f.positionKey !== 'WICKETKEEPER' && (isLeftHander ? f.targetPos.x < 300 : f.targetPos.x > 300) && f.targetPos.y > 410).length;
    const isCompliant = actualOutside <= maxOutsideCircle && legSide <= legSideLimit && behindSquareLeg <= 2;

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SCORING ZONES CALCULATION (360° Wagon Wheel)
    // ─────────────────────────────────────────────────────────────────────────
    const scoringZones = this.computeScoringZones(fielders, isLeftHander, batterProfile);

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
      legSideLimit,
      movementLimited,
      isCompliant,
      changedFielders,
      scoringZones,
      batterProfile: batterProfile || undefined,
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
   * Law 28.3 — never station more than the legal maximum on the leg side.
   * Law 28.4 — never station more than 2 outfielders behind square on the leg side.
   * Over-limit leg-side positions are swapped for same-category off-side slots.
   */
  private static enforceLegSideBalance(keys: string[], isLeftHander: boolean, limit: number): string[] {
    const adjusted = [...keys];
    const isLegKey = (k: string): boolean => {
      const def = CANONICAL_POSITIONS[k];
      if (!def) return false;
      const x = isLeftHander ? 600 - def.x : def.x;
      return isOnLegSide(x, isLeftHander);
    };
    const countLeg = () => adjusted.filter(isLegKey).length;
    let guard = 0;
    while (countLeg() > limit && guard++ < 16) {
      let legIdx = -1;
      for (let i = adjusted.length - 1; i >= 0; i -= 1) {
        if (isLegKey(adjusted[i])) { legIdx = i; break; }
      }
      if (legIdx < 0) break;
      const removedCategory = CANONICAL_POSITIONS[adjusted[legIdx]]?.category;
      const fallback = OFF_SIDE_FALLBACKS.find(k => !adjusted.includes(k) && CANONICAL_POSITIONS[k]?.category === removedCategory)
        ?? OFF_SIDE_FALLBACKS.find(k => !adjusted.includes(k));
      if (!fallback) break;
      adjusted[legIdx] = fallback;
    }

    // Law 28.4 — max 2 behind square on leg side
    const isBehindSquareLegKey = (k: string): boolean => {
      const def = CANONICAL_POSITIONS[k];
      if (!def) return false;
      const p = BowlerFieldStrategyEngine.mirrorForLeftHander(def, isLeftHander);
      return isOnLegSide(p.x, isLeftHander) && p.y > 410;
    };
    guard = 0;
    while (adjusted.filter(isBehindSquareLegKey).length > 2 && guard++ < 16) {
      const idx = adjusted.findIndex(isBehindSquareLegKey);
      if (idx < 0) break;
      const fallback = ['SQUARE_LEG', 'MID_WICKET', 'MID_ON', 'COVER'].find(k => !adjusted.includes(k))
        ?? OFF_SIDE_FALLBACKS.find(k => !adjusted.includes(k));
      if (fallback) adjusted[idx] = fallback;
      else break;
    }

    return adjusted;
  }

  /**
   * Applies the per-update movement budget. Fielders whose ideal station
   * differs from their previous station are "movers"; at most `maxMoves` of
   * them relocate. The subset is chosen by legal-field feasibility first, then
   * by hot-zone relevance, then by travel distance. Every intermediate field
   * remains legal, and the animation simply represents the already-decided
   * result.
   */
  private static applyMovementLimit(
    fielders: FielderAssignment[],
    previousConfig: FieldConfiguration | null | undefined,
    opts: {
      isLeftHander: boolean;
      maxMoves: number;
      hotZones: string[];
      maxOutsideCircle: number;
      legSideLimit: number;
      restricted: boolean;
    },
  ): { changedFielders: FieldConfiguration['changedFielders']; movementLimited: boolean } {
    const changedFielders: FieldConfiguration['changedFielders'] = [];
    const prevById = new Map<string, FielderAssignment>();
    (previousConfig?.fielders ?? []).forEach(f => prevById.set(f.id, f));
    if (!prevById.size || opts.maxMoves <= 0) return { changedFielders, movementLimited: false };

    interface Mover { f: FielderAssignment; prev: FielderAssignment; dist: number; }
    const MOVE_THRESHOLD = 4;
    const movers: Mover[] = [];

    for (const f of fielders) {
      const prev = prevById.get(f.id);
      if (!prev) continue;
      f.currentPos = { ...prev.targetPos };
      if (f.positionKey === 'WICKETKEEPER' || f.positionKey === 'BOWLER') continue;
      const dist = Math.hypot(f.currentPos.x - f.targetPos.x, f.currentPos.y - f.targetPos.y);
      if (dist > MOVE_THRESHOLD) movers.push({ f, prev, dist });
    }

    const isProjectedLegal = (settled: Set<FielderAssignment>): boolean => {
      let outside = 0;
      let leg = 0;
      let behindSquare = 0;
      for (const f of fielders) {
        if (f.positionKey === 'WICKETKEEPER' || f.positionKey === 'BOWLER') continue;
        const anchor = settled.has(f) ? f : prevById.get(f.id) ?? f;
        const pos = settled.has(f) ? f.targetPos : anchor.targetPos;
        if (anchor.isOutsideCircle) outside += 1;
        if (isOnLegSide(pos.x, opts.isLeftHander)) {
          leg += 1;
          if (pos.y > 410) behindSquare += 1;
        }
      }
      if (opts.restricted && outside > opts.maxOutsideCircle) return false;
      if (leg > opts.legSideLimit) return false;
      return behindSquare <= 2;
    };

    const recordChanges = (selected: Mover[]) => {
      for (const m of selected) {
        changedFielders.push({
          playerId: m.f.id,
          playerName: m.f.name,
          fromRole: m.prev.positionName,
          toRole: m.f.positionName,
          fromPoint: { ...m.f.currentPos },
          toPoint: { ...m.f.targetPos },
        });
      }
    };

    if (movers.length <= opts.maxMoves) {
      recordChanges(movers);
      return { changedFielders, movementLimited: false };
    }

    const pool = movers
      .map(m => ({ m, score: this.moverPriorityScore(m, opts.isLeftHander, opts.hotZones) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(opts.maxMoves, 6))
      .map(p => p.m);

    let chosen: Mover[] = [];
    for (let size = opts.maxMoves; size >= 1 && chosen.length === 0; size -= 1) {
      for (const combo of this.combinations(pool, size)) {
        if (isProjectedLegal(new Set(combo.map(c => c.f)))) { chosen = combo; break; }
      }
    }

    const chosenSet = new Set(chosen.map(c => c.f));
    for (const m of movers) {
      if (chosenSet.has(m.f)) continue;
      // Movement budget exhausted — hold station at the previous assignment.
      m.f.targetPos = { ...m.f.currentPos };
      m.f.positionKey = m.prev.positionKey;
      m.f.positionName = m.prev.positionName;
      m.f.isOutsideCircle = m.prev.isOutsideCircle;
      m.f.isCatching = m.prev.isCatching;
      m.f.tacticalRole = m.prev.tacticalRole;
    }
    recordChanges(chosen);
    return { changedFielders, movementLimited: true };
  }

  private static moverPriorityScore(
    m: { f: FielderAssignment; prev: FielderAssignment; dist: number },
    isLeftHanded: boolean,
    hotZones: string[],
  ): number {
    let score = Math.min(m.dist, 250) / 10;
    const idealHot = isWithinHotZone(m.f.targetPos, isLeftHanded, hotZones);
    const wasHot = isWithinHotZone(m.f.currentPos, isLeftHanded, hotZones);
    if (idealHot && !wasHot) score += 300;
    else if (idealHot) score += 120;
    if (wasHot && !idealHot) score -= 200;
    if (m.f.isCatching) score += 40;
    if (m.f.isOutsideCircle && !m.prev.isOutsideCircle) score += 30;
    return score;
  }

  private static combinations<T>(items: T[], size: number): T[][] {
    if (size <= 0 || size > items.length) return [];
    const result: T[][] = [];
    const combo: T[] = [];
    const walk = (start: number) => {
      if (combo.length === size) { result.push([...combo]); return; }
      for (let i = start; i < items.length; i += 1) {
        combo.push(items[i]);
        walk(i + 1);
        combo.pop();
      }
    };
    walk(0);
    return result;
  }

  /**
   * Helper: computes 360-degree scoring zones and protection status.
   */
  private static computeScoringZones(
    fielders: FielderAssignment[],
    isLeftHander: boolean,
    batterProfile?: BatterScoringProfile | null
  ): ScoringZoneData[] {
    const zones = [
      { name: 'Third Man & Gully', angleRange: [-150, -110] as [number, number], keys: ['FINE_THIRD_MAN', 'THIRD_MAN'] },
      { name: 'Point & Backward Point', angleRange: [-110, -70] as [number, number], keys: ['DEEP_BACKWARD_POINT', 'POINT'] },
      { name: 'Cover & Extra Cover', angleRange: [-70, -25] as [number, number], keys: ['COVER_POINT', 'COVER', 'EXTRA_COVER'] },
      { name: 'Straight Long-Off', angleRange: [-25, 0] as [number, number], keys: ['LONG_OFF', 'STRAIGHT_OFF'] },
      { name: 'Straight Long-On', angleRange: [0, 25] as [number, number], keys: ['STRAIGHT_ON', 'LONG_ON'] },
      { name: 'Mid-Wicket & Cow Corner', angleRange: [25, 70] as [number, number], keys: ['MID_WICKET', 'COW_CORNER'] },
      { name: 'Square Leg', angleRange: [70, 110] as [number, number], keys: ['SQUARE_LEG', 'BACKWARD_SQUARE_LEG'] },
      { name: 'Fine Leg', angleRange: [110, 150] as [number, number], keys: ['FINE_LEG'] },
    ];

    return zones.map(z => {
      // Find fielders stationed within this angular cone from batter crease (300, 410)
      const hasCoverage = fielders.some(f => {
        const dx = f.targetPos.x - 300;
        const dy = f.targetPos.y - 410;
        const deg = Math.atan2(dx, -dy) * (180 / Math.PI);
        return deg >= z.angleRange[0] && deg <= z.angleRange[1];
      });

      let realRuns = 0;
      if (batterProfile && batterProfile.totalBalls > 0) {
        for (const k of z.keys) {
          if (batterProfile.zones[k as any]) {
            realRuns += batterProfile.zones[k as any].runsScored;
          }
        }
      }

      return {
        zone: z.name,
        angleRange: z.angleRange,
        riskLevel: hasCoverage ? 'LOW' : 'HIGH',
        runsScored: realRuns,
        protection: hasCoverage ? 'COVERED' : 'OPEN',
      };
    });
  }

  /**
   * Tactical Preset Overlays for manual selection.
   * Derived from authoritative T20, ODI, and Test reference blueprints.
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
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_SQUARE_LEG', 'DEEP_MID_WICKET', 'DEEP_THIRD_MAN'],
      intent: 'Bouncer ambush with deep square and mid-wicket waiting for hook and pull shots',
    },

    // ── ODI REFERENCE PRESETS ──
    ODI_PP_PACE: {
      name: 'ODI Powerplay - Right-Arm Pace (New Ball)',
      keys: ['FIRST_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Attacking 2-slip cordon with 2 boundary catchers on rope within 2-outside limit',
    },
    ODI_PP_LEFT_ARM_PACE: {
      name: 'ODI Powerplay - Left-Arm Pace (New Ball)',
      keys: ['FIRST_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Angling across right-hander with slip and gully, fine leg protected',
    },
    ODI_PP_SWING: {
      name: 'ODI Powerplay - Swing Conditions (Cloudy)',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Overcast swing attack with 2 slips hunting moving deliveries',
    },
    ODI_PP_SPIN: {
      name: 'ODI Powerplay - Spin Bowling',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Powerplay spin choke with ring single denial and slip catcher',
    },
    ODI_PP_DEFENSIVE: {
      name: 'ODI Powerplay - Defensive Start',
      keys: ['POINT', 'COVER', 'EXTRA_COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Defensive ring preventing singles and limiting early boundary blitz',
    },
    ODI_MID_PACE_BALANCED: {
      name: 'ODI Middle - Pace Balanced Field',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG', 'DEEP_COVER', 'DEEP_MID_WICKET'],
      intent: '4 deep sweepers controlling strike rotation and boundary releases',
    },
    ODI_MID_SPIN_ATTACK: {
      name: 'ODI Middle - Spin Attacking Field',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG', 'DEEP_COVER', 'DEEP_MID_WICKET'],
      intent: 'Attacking spin with slip and short leg bat-pad, 2 deep sweepers for lofted shots',
    },
    ODI_MID_BLOCK_HOLES: {
      name: 'ODI Middle - Block Holes (Dot Balls)',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'SHORT_FINE_LEG', 'LONG_OFF', 'LONG_ON'],
      intent: 'Denying boundary down ground and choking singles to build dot-ball pressure',
    },
    ODI_MID_PARTNERSHIP_BREAKER: {
      name: 'ODI Middle - Partnership Breaker',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG', 'DEEP_COVER', 'DEEP_MID_WICKET'],
      intent: 'Aggressive close-catcher deployment to induce mistimed stroke against settled partnership',
    },
    ODI_MID_LEFT_HAND_BATTER: {
      name: 'ODI Middle - Against Left-Hand Batter',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG', 'DEEP_COVER', 'DEEP_MID_WICKET'],
      intent: 'Realigned 4-deep field mirroring angles for left-handed striker',
    },
    ODI_DEATH_STANDARD: {
      name: 'ODI Death - Standard Death Field',
      keys: ['COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG', 'DEEP_POINT', 'DEEP_SQUARE_LEG', 'LONG_OFF'],
      intent: '5 deep boundary sweepers protecting ropes during final phase',
    },
    ODI_DEATH_YORKER: {
      name: 'ODI Death - Yorker Plan',
      keys: ['SHORT_THIRD_MAN', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Boundary denial with 5 on rope executing toe-crushing yorkers',
    },
    ODI_DEATH_SLOWER_BALL: {
      name: 'ODI Death - Slower Ball Plan',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Off-pace cutters forcing mistimed aerial strokes into deep sweepers',
    },
    ODI_DEATH_AGGRESSIVE_BATTER: {
      name: 'ODI Death - Aggressive Batter',
      keys: ['COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET'],
      intent: 'Deep fence guarding prime hitting zones against power batter',
    },
    ODI_DEATH_DEFENDING_TOTAL: {
      name: 'ODI Death - Defending a Total',
      keys: ['SHORT_THIRD_MAN', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Maximum boundary protection to squeeze required rate at the death',
    },

    // ── TEST CRICKET REFERENCE PRESETS ──
    TEST_NEW_BALL_PACE: {
      name: 'Test New Ball - Right-Arm Pace (Standard)',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'THIRD_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'],
      intent: 'Relentless 4th-stump probing with 3 slips and gully hunting outside edge',
    },
    TEST_NEW_BALL_LEFT_ARM: {
      name: 'Test New Ball - Left-Arm Pace',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'SHORT_FINE_LEG'],
      intent: 'Left-arm seam movement across right-hander probing corridor of uncertainty',
    },
    TEST_NEW_BALL_SWING: {
      name: 'Test New Ball - Swing Conditions',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'THIRD_SLIP', 'FOURTH_SLIP', 'GULLY', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'],
      intent: 'Heavy overhead swing with 4 slips and gully attacking the moving ball',
    },
    TEST_NEW_BALL_BOUNCY: {
      name: 'Test New Ball - Bouncy Pitch',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'THIRD_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_FINE_LEG'],
      intent: 'High bounce attack with slips back and fine leg positioned for top edges',
    },
    TEST_NEW_BALL_OVERSEAS: {
      name: 'Test New Ball - Overseas Conditions',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'GULLY', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_THIRD_MAN'],
      intent: 'Disciplined channel bowling with deep third man backup for away tours',
    },
    TEST_SPIN_OFF_SPIN: {
      name: 'Test Spin - Off Spin (Right-Arm)',
      keys: ['FIRST_SLIP', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_MID_WICKET'],
      intent: 'Close bat-pad catchers around batter pads with deep midwicket saving aerial hit',
    },
    TEST_SPIN_LEFT_ARM: {
      name: 'Test Spin - Left-Arm Spin',
      keys: ['FIRST_SLIP', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_MID_WICKET'],
      intent: 'Arm ball and turn into the rough with silly point and short leg waiting',
    },
    TEST_SPIN_DRY_TURNING: {
      name: 'Test Spin - Dry Turning Pitch',
      keys: ['FIRST_SLIP', 'LEG_SLIP', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_MID_WICKET'],
      intent: 'Puffing dust and sharp turn: leg slip, silly point and short leg surrounding batter',
    },
    TEST_SPIN_LEFT_HAND: {
      name: 'Test Spin - Against Left-Hand Batter',
      keys: ['FIRST_SLIP', 'LEG_SLIP', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_SQUARE_LEG'],
      intent: 'Off-spinner turning into the left-hander pads with bat-pad cordon ready',
    },
    TEST_SPIN_DEFENSIVE: {
      name: 'Test Spin - Defensive Spin Field',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_COVER', 'DEEP_MID_WICKET'],
      intent: 'Ring choke cutting off singles and protecting boundary sweepers',
    },
    TEST_LATE_ATTACKING: {
      name: 'Test Late Session - Attacking (Wicket Hunt)',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SHORT_FINE_LEG'],
      intent: 'All-out wicket hunt with crowded infield catchers applying claustrophobic pressure',
    },
    TEST_LATE_DEFENSIVE: {
      name: 'Test Late Session - Defensive (Run Prevention)',
      keys: ['POINT', 'COVER', 'EXTRA_COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_MID_WICKET'],
      intent: 'Drying up runs and frustrating established batters before the close of play',
    },
    TEST_LATE_TAILENDERS: {
      name: 'Test Late Session - Against Tailenders',
      keys: ['FIRST_SLIP', 'GULLY', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'DEEP_FINE_LEG'],
      intent: 'Throat ball bouncer ambush with catchers under helmet and deep fine leg',
    },
    TEST_LATE_PROTECT_LEAD: {
      name: 'Test Late Session - 4th Innings (Protect Lead)',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_MID_WICKET'],
      intent: 'Deep boundary sweeper protection with slip to defend 4th innings target',
    },
    TEST_LATE_FORCE_DECISION: {
      name: 'Test Late Session - To Force a Decision',
      keys: ['FIRST_SLIP', 'SECOND_SLIP', 'GULLY', 'SILLY_POINT', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'SHORT_FINE_LEG'],
      intent: 'Ultra-aggressive ring to force an error in dying overs of Day 5',
    },

    // ── T20 / IPL REFERENCE PRESETS ──
    T20_PP_PACE: {
      name: 'T20 Powerplay - Right-Arm Pace (New Ball)',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Slip catching edge with 2 boundary guards within powerplay limits',
    },
    T20_PP_LEFT_ARM_PACE: {
      name: 'T20 Powerplay - Left-Arm Pace (New Ball)',
      keys: ['FIRST_SLIP', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG'],
      intent: 'Left-arm swing across right-hander with slip and deep fine leg',
    },
    T20_PP_SPIN_RIGHT: {
      name: 'T20 Powerplay - Right-Arm Spin',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'SHORT_FINE_LEG', 'DEEP_SQUARE_LEG'],
      intent: 'Attacking powerplay spin with slip and deep square leg boundary protection',
    },
    T20_PP_SPIN_LEFT: {
      name: 'T20 Powerplay - Left-Arm Spin',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_OFF', 'MID_ON', 'SQUARE_LEG', 'SHORT_FINE_LEG', 'DEEP_SQUARE_LEG'],
      intent: 'Left-arm orthodox darting into stumps with slip and deep square',
    },
    T20_PP_DEFENSIVE: {
      name: 'T20 Powerplay - Defensive Powerplay',
      keys: ['POINT', 'COVER', 'EXTRA_COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'SQUARE_LEG', 'DEEP_THIRD_MAN', 'DEEP_SQUARE_LEG'],
      intent: 'Restricting powerplay boundary avenues through 30-yard ring single choke',
    },
    T20_MID_PACE_ATTACK: {
      name: 'T20 Middle - Pace Attacking Field',
      keys: ['FIRST_SLIP', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_THIRD_MAN', 'DEEP_POINT', 'DEEP_COVER', 'DEEP_MID_WICKET', 'LONG_OFF'],
      intent: 'Slip catcher retained with 5 boundary sweepers challenging aerial risks',
    },
    T20_MID_PACE_DEFENSIVE: {
      name: 'T20 Middle - Pace Defensive Field',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_THIRD_MAN', 'DEEP_POINT', 'DEEP_COVER', 'DEEP_MID_WICKET', 'DEEP_FINE_LEG'],
      intent: 'Deep fence on both flanks squeezing scoring opportunities in middle overs',
    },
    T20_MID_SPIN_ATTACK: {
      name: 'T20 Middle - Spin Attacking Field',
      keys: ['FIRST_SLIP', 'SHORT_LEG', 'POINT', 'COVER', 'MID_WICKET', 'LONG_OFF', 'LONG_ON', 'COW_CORNER', 'DEEP_SQUARE_LEG'],
      intent: 'Tempting big shot with boundary fielders positioned at long-on and deep midwicket',
    },
    T20_MID_SPIN_DEFENSIVE: {
      name: 'T20 Middle - Spin Defensive Field',
      keys: ['POINT', 'COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_SQUARE_LEG'],
      intent: 'Deep fence denying boundaries and forcing single rotation against spin',
    },
    T20_MID_AGGRESSIVE_BATTER: {
      name: 'T20 Middle - Against Aggressive Batter',
      keys: ['COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET'],
      intent: 'Plugging boundary zones to starve aggressive batter of boundary hits',
    },
    T20_DEATH_YORKER: {
      name: 'T20 Death - Yorker Plan',
      keys: ['SHORT_THIRD_MAN', 'COVER', 'MID_OFF', 'MID_ON', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Boundary denial with 5 sentries back on the rope for blockhole yorkers',
    },
    T20_DEATH_SLOWER_BALL: {
      name: 'T20 Death - Slower Ball Plan',
      keys: ['SHORT_THIRD_MAN', 'POINT', 'COVER', 'MID_OFF', 'DEEP_POINT', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET', 'DEEP_SQUARE_LEG'],
      intent: 'Off-pace deliveries enticing mishits into 5 boundary sweepers',
    },
    T20_DEATH_SPIN: {
      name: 'T20 Death - Spin Death Overs',
      keys: ['COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_POINT', 'DEEP_SQUARE_LEG', 'LONG_OFF', 'LONG_ON', 'DEEP_MID_WICKET'],
      intent: 'Deep straight and midwicket ropes covered against death-over slogs',
    },
    T20_DEATH_LEFT_HAND: {
      name: 'T20 Death - Against Left-Hand Batter',
      keys: ['COVER', 'MID_OFF', 'MID_ON', 'MID_WICKET', 'DEEP_THIRD_MAN', 'DEEP_FINE_LEG', 'DEEP_COVER', 'LONG_OFF', 'LONG_ON'],
      intent: 'Realigned boundary ropes targeting left-hander hitting arcs at the death',
    },
    T20_DEATH_LEG_SIDE_HEAVY: {
      name: 'T20 Death - Leg-Side Heavy Field',
      keys: ['POINT', 'COVER', 'MID_OFF', 'SHORT_THIRD_MAN', 'DEEP_MID_WICKET', 'COW_CORNER', 'DEEP_SQUARE_LEG', 'DEEP_FINE_LEG', 'LONG_ON'],
      intent: '5 leg-side sentries defending against pull, hook and slog sweep boundaries',
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
