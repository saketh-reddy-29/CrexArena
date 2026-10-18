import { getRules } from '../rules/RulesEngine';
import { Format, FieldingRestriction } from '../rules/types';

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL FIELD GEOMETRY (must match CricketActionVisualizer's 600x600 space)
// Center = (300, 300). Inner 30-yard circle is an ellipse rx=160, ry=190.
// Boundary rope radius = 268.
// ─────────────────────────────────────────────────────────────────────────────
export const FIELD_CENTER = { x: 300, y: 300 };
export const INNER_CIRCLE = { cx: 300, cy: 300, rx: 160, ry: 190 } as const;
export const BOUNDARY_RADIUS = 268;
export const MAX_FIELDING_SIDE = 11;
export const MAX_OUTFIELDERS = 9; // excluding bowler + wicketkeeper

export type FieldingPhaseKey = 'POWERPLAY' | 'MIDDLE' | 'DEATH' | 'TEST';

export interface FieldingPhase {
  key: FieldingPhaseKey;
  label: string;
  shortLabel: string;
  startOver: number;
  endOver: number;
  maxOutsideCircle: number;
  catchersRequired?: number;
  restricted: boolean; // false => no outside-circle limit (e.g. Test cricket)
}

export interface FielderPosition {
  id: string;
  name?: string;
  role?: string; // 'Bowler' | 'Wicketkeeper' | 'Batsman' | 'All-rounder'
  x: number;
  y: number;
  /** Optional pre-computed flag; when omitted the engine derives it from geometry. */
  isOutsideCircle?: boolean;
}

export type FieldViolationCode =
  | 'INVALID_PLAYER_COUNT'
  | 'TOO_MANY_OUTSIDE'
  | 'MISSING_WICKETKEEPER'
  | 'MISSING_BOWLER'
  | 'TOO_MANY_LEG_SIDE';

export interface FieldValidationViolation {
  code: FieldViolationCode;
  message: string;
  limit?: number;
  actual?: number;
  fielderIds?: string[];
}

export interface FieldValidationOptions {
  /** Total players expected on the fielding side (default 11). */
  expectedPlayerCount?: number;
  /** When false the player-count rule is skipped (e.g. bowler tracked separately). */
  enforcePlayerCount?: boolean;
  /** Competition-specific override of the phase limits. */
  overrides?: FieldingRestriction[];
  /** Enforce that a wicketkeeper is present (default false). */
  requireWicketkeeper?: boolean;
  /** Enforce that a bowler is present (default false). */
  requireBowler?: boolean;
  /** Maximum fielders on the leg side (default disabled). */
  maxLegSide?: number;
  /** Batter handedness, used for leg-side counting. */
  isLeftHanded?: boolean;
}

export interface FieldValidationResult {
  valid: boolean;
  format: Format;
  over: number;
  phase: FieldingPhase;
  totalFielders: number;
  outsideCircleCount: number;
  insideCircleCount: number;
  maxOutsideCircle: number;
  offSideCount: number;
  legSideCount: number;
  /** Active Law 28.3 leg-side maximum. */
  legSideLimit: number;
  /** Fielders currently outside the circle (ids). */
  outsideFielderIds: string[];
  violations: FieldValidationViolation[];
  /** Short human-readable summary, e.g. "Powerplay restriction: maximum 2 fielders outside the circle. 3 outside. Move 1 fielder inside." */
  message: string;
}

export interface FieldValidationInput {
  format: Format;
  /** 1-indexed over currently being bowled. */
  over: number;
  fielders: FielderPosition[];
  options?: FieldValidationOptions;
  /** Total overs of the (possibly reduced) innings — rescales phase windows. */
  totalOvers?: number;
  /** Competition season — used for season-keyed rules (e.g. IPL). */
  season?: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Converts a completed/legal ball count into a 1-indexed over number.
 * balls = 0  => Over 1. balls = 6 => Over 2.
 */
export function overFromBalls(balls: number): number {
  return Math.floor(Math.max(0, balls) / 6) + 1;
}

/**
 * Authoritative circle test. Uses the same ellipse geometry as the 2D field so
 * the UI and engine always agree. Points exactly on the ellipse count as inside.
 */
export function isOutsideCircle(x: number, y: number): boolean {
  const nx = (x - INNER_CIRCLE.cx) / INNER_CIRCLE.rx;
  const ny = (y - INNER_CIRCLE.cy) / INNER_CIRCLE.ry;
  return nx * nx + ny * ny > 1.0000001;
}

export function isOnLegSide(x: number, isLeftHanded: boolean): boolean {
  // Right-hander: leg side is x > 300. Left-hander mirrored.
  return isLeftHanded ? x < FIELD_CENTER.x : x > FIELD_CENTER.x;
}

function describeFormat(format: Format): string {
  switch (format) {
    case 'TEST':
      return 'Test match';
    case 'ODI':
      return 'ODI';
    case 'IPL':
      return 'IPL';
    default:
      return 'T20';
  }
}

function phaseMeta(format: Format, over: number, totalOvers?: number): { key: FieldingPhaseKey; label: string; shortLabel: string } {
  if (format === 'TEST') {
    return { key: 'TEST', label: 'Test Match', shortLabel: 'TEST' };
  }
  // Rescale the phase windows for reduced-overs innings so labels and limits
  // stay coherent (e.g. a 10-over T20: powerplay 1-3, middle 4-8, death 9-10).
  const base = format === 'ODI' ? 50 : 20;
  const factor = totalOvers && totalOvers < base ? totalOvers / base : 1;
  const ppEnd = Math.max(1, Math.round((format === 'ODI' ? 10 : 6) * factor));
  const midEnd = Math.max(ppEnd, Math.round((format === 'ODI' ? 40 : 15) * factor));
  const lastOver = totalOvers && totalOvers < base ? totalOvers : base;
  if (over <= ppEnd) return { key: 'POWERPLAY', label: `Powerplay (Overs 1–${ppEnd})`, shortLabel: 'POWERPLAY' };
  if (over <= midEnd) return { key: 'MIDDLE', label: `Middle Overs (${ppEnd + 1}–${midEnd})`, shortLabel: 'MIDDLE OVERS' };
  return { key: 'DEATH', label: `Death Overs (${midEnd + 1}–${lastOver})`, shortLabel: 'DEATH OVERS' };
}

/**
 * Returns the central fielding-restriction table for a format, honouring
 * competition overrides. This is the single source of truth used by both the
 * UI and the authoritative simulation layer.
 */
export function getFieldingRestrictions(format: Format, overrides?: FieldingRestriction[], season?: number): FieldingRestriction[] {
  if (overrides && overrides.length) return overrides;
  const rules = getRules(format, season);
  return rules.fieldingRestrictions ?? [];
}

/**
 * Law 28.3 — maximum fielders on the leg side. Defaults to 5 for every
 * format unless the competition rules configure otherwise.
 */
export function getLegSideLimit(format: Format, season?: number): number {
  const rules = getRules(format, season);
  return rules.maxLegSideFielders ?? 5;
}

/**
 * Rescales restriction windows for a reduced-overs innings. A 20-over ODI,
 * for example, keeps the same proportional phases: powerplay 1-4, middle
 * 5-16, death 17-20.
 */
export function scaleRestrictionsForTotalOvers(
  restrictions: FieldingRestriction[],
  baseTotalOvers: number,
  totalOvers: number,
): FieldingRestriction[] {
  if (!totalOvers || totalOvers >= baseTotalOvers || baseTotalOvers <= 0) return restrictions;
  const factor = totalOvers / baseTotalOvers;
  return restrictions.map((r, idx) => {
    const isLast = idx === restrictions.length - 1;
    const startOver = Math.max(1, Math.round((r.startOver - 1) * factor) + 1);
    const endOver = isLast ? totalOvers : Math.max(startOver, Math.round(r.endOver * factor));
    return { ...r, startOver, endOver };
  });
}

/**
 * Resolves the active fielding phase for the given format + over.
 * Test cricket returns an unrestricted phase (no circle limits).
 * `totalOvers` rescales the windows for reduced-overs competitions.
 */
export function getFieldingPhase(format: Format, over: number, overrides?: FieldingRestriction[], totalOvers?: number, season?: number): FieldingPhase {
  const meta = phaseMeta(format, over, totalOvers);
  const rules = getRules(format, season);
  let restrictions = getFieldingRestrictions(format, overrides, season);
  if (totalOvers && rules.maxOvers) {
    restrictions = scaleRestrictionsForTotalOvers(restrictions, rules.maxOvers, totalOvers);
  }

  if (!restrictions.length) {
    // Test cricket (or any format with no configured restrictions): no limit.
    return {
      key: meta.key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      startOver: 1,
      endOver: Number.POSITIVE_INFINITY,
      maxOutsideCircle: MAX_OUTFIELDERS,
      restricted: false,
    };
  }

  const match = restrictions.find((r) => over >= r.startOver && over <= r.endOver);
  if (match) {
    return {
      key: meta.key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      startOver: match.startOver,
      endOver: match.endOver,
      maxOutsideCircle: match.maxOutsideCircle,
      catchersRequired: match.catchersRequired,
      restricted: true,
    };
  }

  // Over falls outside every configured window (e.g. super over) — fall back to
  // the last configured restriction but keep the derived phase label.
  const last = restrictions[restrictions.length - 1];
  return {
    key: meta.key,
    label: meta.label,
    shortLabel: meta.shortLabel,
    startOver: last.startOver,
    endOver: last.endOver,
    maxOutsideCircle: last.maxOutsideCircle,
    catchersRequired: last.catchersRequired,
    restricted: true,
  };
}

/**
 * Counts fielders outside the circle, excluding the bowler and wicketkeeper
 * (per cricket law only the 9 outfielders count toward the circle limit).
 */
export function countOutsideCircle(fielders: FielderPosition[]): number {
  return fielders.filter((f) => {
    if (isBowlerOrKeeper(f)) return false;
    const outside = f.isOutsideCircle !== undefined ? f.isOutsideCircle : isOutsideCircle(f.x, f.y);
    return outside;
  }).length;
}

export function isBowlerOrKeeper(f: FielderPosition): boolean {
  const role = (f.role || '').toLowerCase();
  return role === 'bowler' || role === 'wicketkeeper' || role === 'wicket-keeper' || role === 'keeper';
}

/** Counts outfielders on the leg side (excludes bowler + wicketkeeper). */
export function countOnLegSide(fielders: FielderPosition[], isLeftHanded: boolean): number {
  return fielders.filter((f) => {
    if (isBowlerOrKeeper(f)) return false;
    return isOnLegSide(f.x, isLeftHanded);
  }).length;
}

/**
 * The mandatory field validation gate. Every fielding configuration must pass
 * this before it can be applied to the authoritative simulation layer.
 * Enforces the outside-circle restriction for the active phase AND the
 * Law 28.3 leg-side maximum, at the instant of delivery.
 */
export function validateField(input: FieldValidationInput): FieldValidationResult {
  const { format, over, fielders } = input;
  const options = input.options ?? {};
  const phase = getFieldingPhase(format, over, options.overrides, input.totalOvers, input.season);
  const legSideLimit = options.maxLegSide !== undefined ? options.maxLegSide : getLegSideLimit(format, input.season);

  const isLeftHanded = options.isLeftHanded ?? false;
  const outsideFielderIds: string[] = [];
  let outside = 0;
  let inside = 0;
  let offSide = 0;
  let legSide = 0;

  for (const f of fielders) {
    if (isBowlerOrKeeper(f)) continue;
    const isOutside = f.isOutsideCircle !== undefined ? f.isOutsideCircle : isOutsideCircle(f.x, f.y);
    if (isOutside) {
      outside += 1;
      outsideFielderIds.push(f.id);
    } else {
      inside += 1;
    }
    if (isOnLegSide(f.x, isLeftHanded)) legSide += 1;
    else offSide += 1;
  }

  const violations: FieldValidationViolation[] = [];

  // 1. Player count
  const enforceCount = options.enforcePlayerCount !== false;
  const expected = options.expectedPlayerCount ?? MAX_FIELDING_SIDE;
  if (enforceCount && fielders.length !== expected) {
    violations.push({
      code: 'INVALID_PLAYER_COUNT',
      message: `Fielding side must contain exactly ${expected} active players, including the bowler and wicketkeeper.`,
      limit: expected,
      actual: fielders.length,
    });
  }

  // 2. Outside-circle limit (only when the format/phase is restricted)
  if (phase.restricted && outside > phase.maxOutsideCircle) {
    violations.push({
      code: 'TOO_MANY_OUTSIDE',
      message: `${phase.label} restriction: maximum ${phase.maxOutsideCircle} fielders outside the circle. Current formation: ${outside} outside. Move ${outside - phase.maxOutsideCircle} fielder${outside - phase.maxOutsideCircle > 1 ? 's' : ''} inside.`,
      limit: phase.maxOutsideCircle,
      actual: outside,
      fielderIds: outsideFielderIds,
    });
  }

  // 3. Optional: keeper / bowler presence
  const hasKeeper = fielders.some((f) => /wicket/.test((f.role || '').toLowerCase()));
  const hasBowler = fielders.some((f) => (f.role || '').toLowerCase() === 'bowler');
  if (options.requireWicketkeeper && !hasKeeper) {
    violations.push({ code: 'MISSING_WICKETKEEPER', message: 'A wicketkeeper must be assigned to the fielding side.' });
  }
  if (options.requireBowler && !hasBowler) {
    violations.push({ code: 'MISSING_BOWLER', message: 'A bowler must be assigned to the fielding side.' });
  }

  // 4. Leg-side limit (Law 28.3) — enabled by default for every format.
  if (legSideLimit !== undefined && legSide > legSideLimit) {
    violations.push({
      code: 'TOO_MANY_LEG_SIDE',
      message: `No more than ${legSideLimit} fielders may be on the leg side (Law 28.3). Current: ${legSide}. Move ${legSide - legSideLimit} fielder${legSide - legSideLimit > 1 ? 's' : ''} to the off side.`,
      limit: legSideLimit,
      actual: legSide,
    });
  }

  const message = violations.length
    ? violations.map((v) => v.message).join(' ')
    : `${describeFormat(format)} field legal (${outside}/${phase.restricted ? phase.maxOutsideCircle : MAX_OUTFIELDERS} outside circle).`;

  return {
    valid: violations.length === 0,
    format,
    over,
    phase,
    totalFielders: fielders.length,
    outsideCircleCount: outside,
    insideCircleCount: inside,
    maxOutsideCircle: phase.maxOutsideCircle,
    offSideCount: offSide,
    legSideCount: legSide,
    legSideLimit,
    outsideFielderIds,
    violations,
    message,
  };
}

/**
 * Produces the compact field-status badge text, e.g.
 *   "POWERPLAY · Outside circle: 2/2"
 *   "TEST · No circle restriction"
 */
export function getRestrictionSummary(phase: FieldingPhase, outsideCount: number): string {
  if (!phase.restricted) {
    return `${phase.shortLabel} · No circle restriction`;
  }
  return `${phase.shortLabel} · Outside circle: ${clamp(outsideCount, 0, MAX_OUTFIELDERS)}/${phase.maxOutsideCircle}`;
}

/**
 * Convenience: validate using an already-computed outside count and phase,
 * without needing full fielder coordinates (used by UI presets).
 */
export function isFieldLegal(format: Format, over: number, outsideCount: number, overrides?: FieldingRestriction[], totalOvers?: number): boolean {
  const phase = getFieldingPhase(format, over, overrides, totalOvers);
  if (!phase.restricted) return true;
  return outsideCount <= phase.maxOutsideCircle;
}
