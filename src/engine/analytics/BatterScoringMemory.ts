import { ArenaFormat } from '../models/ArenaState';
import { Point } from '../strategy/BowlerFieldStrategyEngine';
import { Fixture } from '../../types/match';

// ═══════════════════════════════════════════════════════════════════════════════
//  CANONICAL 16-ZONE SCORING SYSTEM
//  Ground space: 600 x 600, Center: (300, 300), Batter Crease: (300, 410)
//  Angles relative to straight up (0° = straight towards bowler):
//  - Negative degrees (-180° to 0°): Off-side (for Right-Hander)
//  - Positive degrees (0° to 180°): Leg-side (for Right-Hander)
//  For Left-Hander: Frame is mirrored across vertical axis (x -> 600 - x, deg -> -deg)
// ═══════════════════════════════════════════════════════════════════════════════

export type CanonicalZoneId =
  | 'FINE_THIRD_MAN'
  | 'THIRD_MAN'
  | 'DEEP_BACKWARD_POINT'
  | 'POINT'
  | 'COVER_POINT'
  | 'COVER'
  | 'EXTRA_COVER'
  | 'LONG_OFF'
  | 'STRAIGHT_OFF'
  | 'STRAIGHT_ON'
  | 'LONG_ON'
  | 'MID_WICKET'
  | 'COW_CORNER'
  | 'SQUARE_LEG'
  | 'BACKWARD_SQUARE_LEG'
  | 'FINE_LEG'
  | 'UNKNOWN';

export type ZoneSide = 'OFF' | 'STRAIGHT' | 'LEG' | 'UNKNOWN';

export interface CanonicalZoneDefinition {
  id: CanonicalZoneId;
  name: string;
  side: ZoneSide;
  angleRange: [number, number]; // [minDeg, maxDeg]
  broadWagonKey: string;
  description: string;
}

export const CANONICAL_ZONES: Record<CanonicalZoneId, CanonicalZoneDefinition> = {
  FINE_THIRD_MAN: {
    id: 'FINE_THIRD_MAN',
    name: 'Fine Third Man',
    side: 'OFF',
    angleRange: [-165, -135],
    broadWagonKey: 'THIRD_MAN_GULLY',
    description: 'Fine edge / ramp behind square on off side',
  },
  THIRD_MAN: {
    id: 'THIRD_MAN',
    name: 'Third Man',
    side: 'OFF',
    angleRange: [-135, -105],
    broadWagonKey: 'THIRD_MAN_GULLY',
    description: 'Steered cuts and thick outside edges',
  },
  DEEP_BACKWARD_POINT: {
    id: 'DEEP_BACKWARD_POINT',
    name: 'Backward Point',
    side: 'OFF',
    angleRange: [-105, -85],
    broadWagonKey: 'POINT_SQUARE',
    description: 'Square cut behind the point fielder',
  },
  POINT: {
    id: 'POINT',
    name: 'Point',
    side: 'OFF',
    angleRange: [-85, -65],
    broadWagonKey: 'POINT_SQUARE',
    description: 'Square cuts and punches through point',
  },
  COVER_POINT: {
    id: 'COVER_POINT',
    name: 'Cover Point',
    side: 'OFF',
    angleRange: [-65, -45],
    broadWagonKey: 'COVER',
    description: 'Punches through the gap between cover and point',
  },
  COVER: {
    id: 'COVER',
    name: 'Cover',
    side: 'OFF',
    angleRange: [-45, -25],
    broadWagonKey: 'COVER',
    description: 'Classic off-drives and aerial cover drives',
  },
  EXTRA_COVER: {
    id: 'EXTRA_COVER',
    name: 'Extra Cover',
    side: 'OFF',
    angleRange: [-25, -10],
    broadWagonKey: 'COVER',
    description: 'Lofted and grounded drives inside out',
  },
  LONG_OFF: {
    id: 'LONG_OFF',
    name: 'Long-Off',
    side: 'OFF',
    angleRange: [-10, 0],
    broadWagonKey: 'LONG_OFF',
    description: 'Straight off-side drives down the ground',
  },
  STRAIGHT_OFF: {
    id: 'STRAIGHT_OFF',
    name: 'Straight Down Ground (Off)',
    side: 'STRAIGHT',
    angleRange: [-5, 0],
    broadWagonKey: 'LONG_OFF',
    description: 'Dead straight down the pitch past bowler off',
  },
  STRAIGHT_ON: {
    id: 'STRAIGHT_ON',
    name: 'Straight Down Ground (On)',
    side: 'STRAIGHT',
    angleRange: [0, 5],
    broadWagonKey: 'LONG_ON',
    description: 'Dead straight down the pitch past bowler on',
  },
  LONG_ON: {
    id: 'LONG_ON',
    name: 'Long-On',
    side: 'LEG',
    angleRange: [0, 20],
    broadWagonKey: 'LONG_ON',
    description: 'Straight on-drives and lofted shots down the ground',
  },
  MID_WICKET: {
    id: 'MID_WICKET',
    name: 'Mid-Wicket',
    side: 'LEG',
    angleRange: [20, 50],
    broadWagonKey: 'MID_WICKET_COW',
    description: 'On-drives, clips, and wristy whips',
  },
  COW_CORNER: {
    id: 'COW_CORNER',
    name: 'Cow Corner / Deep Midwicket',
    side: 'LEG',
    angleRange: [50, 80],
    broadWagonKey: 'MID_WICKET_COW',
    description: 'Pull shots and slog sweeps to the longest boundary',
  },
  SQUARE_LEG: {
    id: 'SQUARE_LEG',
    name: 'Square Leg',
    side: 'LEG',
    angleRange: [80, 110],
    broadWagonKey: 'SQUARE_LEG',
    description: 'Square pulls, hooks, sweeps and clips',
  },
  BACKWARD_SQUARE_LEG: {
    id: 'BACKWARD_SQUARE_LEG',
    name: 'Backward Square Leg',
    side: 'LEG',
    angleRange: [110, 140],
    broadWagonKey: 'SQUARE_LEG',
    description: 'Hooks and pull shots directed behind square leg',
  },
  FINE_LEG: {
    id: 'FINE_LEG',
    name: 'Fine Leg',
    side: 'LEG',
    angleRange: [140, 175],
    broadWagonKey: 'FINE_LEG',
    description: 'Leg-side glances, scoops and fine flicks',
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    name: 'Unspecified Historical Area',
    side: 'UNKNOWN',
    angleRange: [0, 0],
    broadWagonKey: 'UNKNOWN',
    description: 'Historical delivery where shot sector was unrecorded',
  },
};

export const CANONICAL_ZONE_LIST: CanonicalZoneId[] = [
  'FINE_THIRD_MAN',
  'THIRD_MAN',
  'DEEP_BACKWARD_POINT',
  'POINT',
  'COVER_POINT',
  'COVER',
  'EXTRA_COVER',
  'LONG_OFF',
  'LONG_ON',
  'MID_WICKET',
  'COW_CORNER',
  'SQUARE_LEG',
  'BACKWARD_SQUARE_LEG',
  'FINE_LEG',
];

/**
 * Returns angular degree from batter crease (300, 190) in the batter's frame.
 * Mirrored automatically for left-handed batters.
 */
export function calculateBatterRelativeAngle(point: Point, isLeftHanded: boolean): number {
  const dx = point.x - 300;
  const dy = point.y - 190;
  let deg = Math.atan2(dx, dy) * (180 / Math.PI);
  if (isLeftHanded) {
    deg = -deg;
  }
  return deg;
}

/**
 * Resolves a canonical zone from a relative angle in batter's coordinate frame.
 */
export function getCanonicalZoneFromAngle(angleDeg: number): CanonicalZoneId {
  // Normalize angle to [-180, 180]
  let a = angleDeg;
  while (a > 180) a -= 360;
  while (a < -180) a += 360;

  // Behind wicket boundaries
  if (a <= -165 || a >= 175) {
    return a < 0 ? 'FINE_THIRD_MAN' : 'FINE_LEG';
  }

  // Iterate over defined angular sectors
  for (const key of CANONICAL_ZONE_LIST) {
    const z = CANONICAL_ZONES[key];
    if (a >= z.angleRange[0] && a < z.angleRange[1]) {
      return z.id;
    }
  }

  // Safe fallback by sign
  if (a < 0) return 'POINT';
  if (a > 0) return 'MID_WICKET';
  return 'LONG_ON';
}

/**
 * Resolves canonical zone from 2D coordinate on ground.
 */
export function getCanonicalZoneFromPoint(point: Point, isLeftHanded: boolean): CanonicalZoneId {
  const angle = calculateBatterRelativeAngle(point, isLeftHanded);
  return getCanonicalZoneFromAngle(angle);
}

/**
 * Maps arbitrary zone / fielder names to canonical zone ID.
 */
export function mapZoneStringToCanonical(rawName: string): CanonicalZoneId {
  if (!rawName) return 'UNKNOWN';
  const norm = rawName.toUpperCase().replace(/\s+/g, '_');

  if (norm in CANONICAL_ZONES) return norm as CanonicalZoneId;

  if (norm.includes('FINE_THIRD') || norm.includes('1ST_SLIP') || norm.includes('2ND_SLIP') || norm.includes('SLIP')) {
    return 'FINE_THIRD_MAN';
  }
  if (norm.includes('THIRD_MAN') || norm.includes('GULLY') || norm.includes('DEEP_THIRD')) {
    return 'THIRD_MAN';
  }
  if (norm.includes('BACKWARD_POINT')) {
    return 'DEEP_BACKWARD_POINT';
  }
  if (norm.includes('COVER_POINT')) {
    return 'COVER_POINT';
  }
  if (norm.includes('EXTRA_COVER')) {
    return 'EXTRA_COVER';
  }
  if (norm.includes('COVER') || norm.includes('SWEEPER_COVER')) {
    return 'COVER';
  }
  if (norm.includes('POINT')) {
    return 'POINT';
  }
  if (norm.includes('LONG_OFF') || norm.includes('MID_OFF')) {
    return 'LONG_OFF';
  }
  if (norm.includes('LONG_ON') || norm.includes('MID_ON')) {
    return 'LONG_ON';
  }
  if (norm.includes('COW') || norm.includes('DEEP_MID_WICKET') || norm.includes('DEEP_MIDWICKET')) {
    return 'COW_CORNER';
  }
  if (norm.includes('MID_WICKET') || norm.includes('MIDWICKET') || norm.includes('FORWARD_SQUARE')) {
    return 'MID_WICKET';
  }
  if (norm.includes('BACKWARD_SQUARE')) {
    return 'BACKWARD_SQUARE_LEG';
  }
  if (norm.includes('SQUARE_LEG') || norm.includes('SHORT_LEG')) {
    return 'SQUARE_LEG';
  }
  if (norm.includes('FINE_LEG') || norm.includes('LEG_SLIP')) {
    return 'FINE_LEG';
  }

  return 'UNKNOWN';
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DELIVERY RECORD & ANALYTICS MODEL
// ═══════════════════════════════════════════════════════════════════════════════

export interface HistoricalDeliveryRecord {
  id: string;
  matchId: string;
  inningsId: string;
  batterId: string;
  batterName: string;
  bowlerId: string;
  bowlerName: string;
  bowlingType: 'PACE' | 'SPIN';
  bowlingArm?: 'Right' | 'Left';
  batterHand: 'Right' | 'Left';
  format: ArenaFormat;
  competition?: string;
  season?: number;
  over: number;
  ballInOver: number;
  phase: string;
  line?: string;
  length?: string;
  shotType: string;
  targetZone: string;
  canonicalZoneId: CanonicalZoneId;
  targetPoint?: Point;
  batterRuns: number;
  extraRuns: number;
  totalRuns: number;
  isBoundary: boolean;
  isWicket: boolean;
  dismissalType?: string;
  fieldingPosition?: string;
  pitch?: string;
  weather?: string;
  timestamp: number;
}

export interface BatterZoneMetric {
  zoneId: CanonicalZoneId;
  zoneName: string;
  side: ZoneSide;
  angleRange: [number, number];
  ballsFaced: number;
  runsScored: number;
  averageRunsPerShot: number;
  boundaryCount: number;
  boundaryPct: number;
  dotCount: number;
  dotPct: number;
  dismissalCount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  isDangerousBoundaryZone: boolean;
  isDismissalVulnerability: boolean;
}

export interface BatterProfileFilters {
  format?: ArenaFormat | 'ALL';
  season?: number;
  bowlingType?: 'PACE' | 'SPIN' | 'ALL';
  bowlingArm?: 'Right' | 'Left' | 'ALL';
  timeframe?: 'CAREER' | 'RECENT_FORM' | 'CURRENT_SEASON';
  recentDeliveriesCount?: number;
}

export interface BatterScoringProfile {
  batterId: string;
  batterName: string;
  totalBalls: number;
  totalRuns: number;
  totalBoundaries: number;
  totalDots: number;
  totalDismissals: number;
  strikeRate: number;
  zones: Record<CanonicalZoneId, BatterZoneMetric>;
  topScoringZones: CanonicalZoneId[];
  topBoundaryZones: CanonicalZoneId[];
  vulnerableDismissalZones: CanonicalZoneId[];
  sampleSizeConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  insufficientDataWarning?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BATTER SCORING MEMORY STORE (In-Memory + LocalStorage Persistent)
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'crex_batter_scoring_analytics_v1';
const MAX_STORED_DELIVERIES = 15000;

export class BatterScoringMemory {
  private static deliveries: HistoricalDeliveryRecord[] = [];
  private static processedMatchInnings: Set<string> = new Set();
  private static initialized = false;

  /**
   * Initializes store from LocalStorage if available.
   */
  public static init(): void {
    if (this.initialized) return;
    this.initialized = true;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.deliveries)) {
            this.deliveries = parsed.deliveries;
          }
          if (Array.isArray(parsed.processedMatchInnings)) {
            this.processedMatchInnings = new Set(parsed.processedMatchInnings);
          }
        }
      }
    } catch {
      // In SSR or non-browser environments, run cleanly in memory
    }
  }

  /**
   * Persists current state to LocalStorage.
   */
  private static persist(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (this.deliveries.length > MAX_STORED_DELIVERIES) {
          // Keep newest deliveries
          this.deliveries = this.deliveries.slice(-MAX_STORED_DELIVERIES);
        }
        const data = {
          deliveries: this.deliveries,
          processedMatchInnings: Array.from(this.processedMatchInnings),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
    } catch {
      // Storage quota or non-browser error
    }
  }

  /**
   * Records a single delivery outcome into historical memory.
   */
  public static recordDelivery(record: HistoricalDeliveryRecord): void {
    this.init();
    if (!record.batterId) return;

    // Resolve canonical zone if not specified
    if (!record.canonicalZoneId || record.canonicalZoneId === 'UNKNOWN') {
      if (record.targetPoint) {
        record.canonicalZoneId = getCanonicalZoneFromPoint(
          record.targetPoint,
          record.batterHand === 'Left'
        );
      } else if (record.targetZone) {
        record.canonicalZoneId = mapZoneStringToCanonical(record.targetZone);
      } else {
        record.canonicalZoneId = 'UNKNOWN';
      }
    }

    this.deliveries.push(record);
    this.persist();
  }

  /**
   * Records completed match innings deliveries idempotently.
   * If this match+innings was already processed, it will not duplicate entries.
   */
  public static recordMatchInnings(
    matchId: string,
    inningsId: string,
    records: HistoricalDeliveryRecord[]
  ): boolean {
    this.init();
    const key = `${matchId}_${inningsId}`;
    if (this.processedMatchInnings.has(key)) {
      return false; // Idempotent: already processed
    }

    for (const r of records) {
      if (!r.canonicalZoneId || r.canonicalZoneId === 'UNKNOWN') {
        if (r.targetPoint) {
          r.canonicalZoneId = getCanonicalZoneFromPoint(r.targetPoint, r.batterHand === 'Left');
        } else if (r.targetZone) {
          r.canonicalZoneId = mapZoneStringToCanonical(r.targetZone);
        } else {
          r.canonicalZoneId = 'UNKNOWN';
        }
      }
      this.deliveries.push(r);
    }

    this.processedMatchInnings.add(key);
    this.persist();
    return true;
  }

  /**
   * Backfills historical records from completed fixtures where scorecards exist.
   * CRITICAL: Never invents shot locations for historical matches.
   * Aggregate statistics are recorded with zone = 'UNKNOWN'.
   */
  public static backfillFromFixtures(fixtures: Fixture[]): number {
    this.init();
    let backfilledCount = 0;

    for (const fixture of fixtures) {
      if (!fixture.scorecard || !fixture.scorecard.innings) continue;

      fixture.scorecard.innings.forEach((innings, innIdx) => {
        const matchKey = `legacy_${fixture.id}_${innIdx}`;
        if (this.processedMatchInnings.has(matchKey)) return;

        const format = (fixture.format || 'IPL') as ArenaFormat;
        const season = (fixture as any).season || 2026;

        // Process batter aggregate records
        if (innings.batsmen) {
          Object.entries(innings.batsmen).forEach(([batterId, stats]) => {
            if (stats.balls > 0) {
              // Add a canonical aggregate delivery representation without fabricating shot locations
              this.deliveries.push({
                id: `legacy_del_${fixture.id}_${innIdx}_${batterId}`,
                matchId: fixture.id,
                inningsId: `inn_${innIdx}`,
                batterId,
                batterName: (stats as any).name || batterId,
                bowlerId: 'legacy_bowler',
                bowlerName: 'Historical Bowler',
                bowlingType: 'PACE',
                batterHand: 'Right',
                format,
                season,
                over: 0,
                ballInOver: 0,
                phase: 'Historical Aggregate',
                shotType: 'HISTORICAL_SCORECARD_RECORD',
                targetZone: 'UNKNOWN',
                canonicalZoneId: 'UNKNOWN',
                batterRuns: stats.runs,
                extraRuns: 0,
                totalRuns: stats.runs,
                isBoundary: (stats.fours || 0) + (stats.sixes || 0) > 0,
                isWicket: Boolean(stats.isOut),
                dismissalType: stats.dismissalType,
                timestamp: Date.now() - 86400000,
              });
              backfilledCount += 1;
            }
          });
        }

        this.processedMatchInnings.add(matchKey);
      });
    }

    if (backfilledCount > 0) {
      this.persist();
    }
    return backfilledCount;
  }

  /**
   * Queries and builds the scoring profile for a batter given optional filters.
   */
  public static getBatterProfile(
    batterId: string,
    filters?: BatterProfileFilters
  ): BatterScoringProfile {
    this.init();

    let matching = this.deliveries.filter(d => d.batterId === batterId);

    if (filters) {
      if (filters.format && filters.format !== 'ALL') {
        matching = matching.filter(d => d.format === filters.format);
      }
      if (filters.season !== undefined) {
        matching = matching.filter(d => d.season === filters.season);
      }
      if (filters.bowlingType && filters.bowlingType !== 'ALL') {
        matching = matching.filter(d => d.bowlingType === filters.bowlingType);
      }
      if (filters.bowlingArm && filters.bowlingArm !== 'ALL') {
        matching = matching.filter(d => d.bowlingArm === filters.bowlingArm);
      }
      if (filters.timeframe === 'RECENT_FORM') {
        const count = filters.recentDeliveriesCount || 60;
        matching = matching.slice(-count);
      }
    }

    const batterName = matching[0]?.batterName || batterId;
    const totalBalls = matching.length;
    let totalRuns = 0;
    let totalBoundaries = 0;
    let totalDots = 0;
    let totalDismissals = 0;

    // Initialize all 16 canonical zones with empty counters
    const zoneMetrics: Record<CanonicalZoneId, BatterZoneMetric> = {} as any;
    for (const key of Object.keys(CANONICAL_ZONES) as CanonicalZoneId[]) {
      const def = CANONICAL_ZONES[key];
      zoneMetrics[key] = {
        zoneId: key,
        zoneName: def.name,
        side: def.side,
        angleRange: def.angleRange,
        ballsFaced: 0,
        runsScored: 0,
        averageRunsPerShot: 0,
        boundaryCount: 0,
        boundaryPct: 0,
        dotCount: 0,
        dotPct: 0,
        dismissalCount: 0,
        confidence: 'INSUFFICIENT',
        isDangerousBoundaryZone: false,
        isDismissalVulnerability: false,
      };
    }

    // Accumulate actual outcomes
    for (const d of matching) {
      totalRuns += d.batterRuns;
      if (d.isBoundary) totalBoundaries += 1;
      if (d.batterRuns === 0 && !d.isWicket) totalDots += 1;
      if (d.isWicket) totalDismissals += 1;

      const zKey = d.canonicalZoneId in zoneMetrics ? d.canonicalZoneId : 'UNKNOWN';
      const m = zoneMetrics[zKey];
      m.ballsFaced += 1;
      m.runsScored += d.batterRuns;
      if (d.isBoundary) m.boundaryCount += 1;
      if (d.batterRuns === 0 && !d.isWicket) m.dotCount += 1;
      if (d.isWicket) m.dismissalCount += 1;
    }

    // Compute rates, efficiency, and confidence per zone
    for (const key of Object.keys(zoneMetrics) as CanonicalZoneId[]) {
      const m = zoneMetrics[key];
      if (m.ballsFaced > 0) {
        m.averageRunsPerShot = Number((m.runsScored / m.ballsFaced).toFixed(2));
        m.boundaryPct = Number(((m.boundaryCount / m.ballsFaced) * 100).toFixed(1));
        m.dotPct = Number(((m.dotCount / m.ballsFaced) * 100).toFixed(1));

        if (m.ballsFaced >= 20) m.confidence = 'HIGH';
        else if (m.ballsFaced >= 8) m.confidence = 'MEDIUM';
        else if (m.ballsFaced >= 3) m.confidence = 'LOW';
        else m.confidence = 'INSUFFICIENT';

        // Dangerous boundary zone threshold: at least 2 boundaries and >= 25% boundary rate
        m.isDangerousBoundaryZone = m.ballsFaced >= 3 && m.boundaryCount >= 2 && m.boundaryPct >= 25;
        // Dismissal vulnerability: at least 2 dismissals in this zone
        m.isDismissalVulnerability = m.dismissalCount >= 2;
      }
    }

    // Determine overall sample size confidence
    let overallConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT' = 'INSUFFICIENT';
    let warning: string | undefined;

    if (totalBalls >= 40) {
      overallConfidence = 'HIGH';
    } else if (totalBalls >= 20) {
      overallConfidence = 'MEDIUM';
    } else if (totalBalls >= 8) {
      overallConfidence = 'LOW';
      warning = 'Small sample size. Tactical insights should be treated with caution.';
    } else {
      overallConfidence = 'INSUFFICIENT';
      warning = 'Limited historical evidence (< 8 deliveries). Bowling AI will deploy standard positional templates.';
    }

    // Top scoring zones (excluding UNKNOWN)
    const validZones = CANONICAL_ZONE_LIST.filter(k => zoneMetrics[k].ballsFaced > 0);
    const topScoringZones = [...validZones]
      .sort((a, b) => zoneMetrics[b].runsScored - zoneMetrics[a].runsScored)
      .slice(0, 3);

    // Top boundary zones
    const topBoundaryZones = [...validZones]
      .filter(k => zoneMetrics[k].boundaryCount > 0)
      .sort((a, b) => zoneMetrics[b].boundaryCount - zoneMetrics[a].boundaryCount || zoneMetrics[b].boundaryPct - zoneMetrics[a].boundaryPct)
      .slice(0, 3);

    // Vulnerable dismissal zones
    const vulnerableDismissalZones = [...validZones]
      .filter(k => zoneMetrics[k].dismissalCount > 0)
      .sort((a, b) => zoneMetrics[b].dismissalCount - zoneMetrics[a].dismissalCount)
      .slice(0, 2);

    const strikeRate = totalBalls > 0 ? Number(((totalRuns / totalBalls) * 100).toFixed(1)) : 0;

    return {
      batterId,
      batterName,
      totalBalls,
      totalRuns,
      totalBoundaries,
      totalDots,
      totalDismissals,
      strikeRate,
      zones: zoneMetrics,
      topScoringZones,
      topBoundaryZones,
      vulnerableDismissalZones,
      sampleSizeConfidence: overallConfidence,
      insufficientDataWarning: warning,
    };
  }

  /**
   * Resets all stored memory (useful for test isolation).
   */
  public static clearMemory(): void {
    this.deliveries = [];
    this.processedMatchInnings.clear();
    this.initialized = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Returns all recorded deliveries count.
   */
  public static getDeliveryCount(): number {
    this.init();
    return this.deliveries.length;
  }

  /**
   * Exports entire state as JSON string.
   */
  public static exportData(): string {
    this.init();
    return JSON.stringify({
      deliveries: this.deliveries,
      processedMatchInnings: Array.from(this.processedMatchInnings),
    });
  }

  /**
   * Imports state from JSON string.
   */
  public static importData(json: string): void {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed.deliveries)) {
        this.deliveries = parsed.deliveries;
      }
      if (Array.isArray(parsed.processedMatchInnings)) {
        this.processedMatchInnings = new Set(parsed.processedMatchInnings);
      }
      this.initialized = true;
      this.persist();
    } catch {
      // Invalid format
    }
  }
}

