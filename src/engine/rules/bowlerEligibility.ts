import { Player } from '../../types/common';

/**
 * Normalizes player roles across all data sources and uppercase/lowercase conventions.
 */
export function normalizeRole(role?: string | null): 'BATTER' | 'BOWLER' | 'ALL_ROUNDER' | 'WICKETKEEPER' {
  if (!role) return 'BATTER';
  const r = role.toUpperCase().replace(/[-\s]/g, '_');
  if (r.includes('WICKET_KEEPER') || r.includes('WICKETKEEPER') || r === 'WK') return 'WICKETKEEPER';
  if (r.includes('ALL_ROUNDER') || r.includes('ALLROUNDER')) return 'ALL_ROUNDER';
  if (r.includes('BOWL')) return 'BOWLER';
  if (r.includes('BAT')) return 'BATTER';
  return 'BATTER';
}

/**
 * NaN & non-finite protection with custom fallback
 */
export function safeNumber(value: any, fallback: number = 50): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Sanitizes and clamps probability strictly between 0 and 1
 */
export function clampProbability(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * PHASE 1: Authoritative Bowler Eligibility Rule.
 *
 * Pure BATTER: role = BATTER must NEVER bowl.
 * WICKETKEEPER: role = WICKETKEEPER must NEVER bowl.
 * BATTER with bowlingRating = 0: must NEVER bowl.
 * ALL-ROUNDER: can bowl.
 * BOWLER: can bowl.
 */
export function isEligibleBowler(player: any): boolean {
  if (!player) return false;

  const role = normalizeRole(player.role);

  // Pure BATTER must NEVER bowl
  if (role === 'BATTER') return false;

  // WICKETKEEPER must NEVER bowl unless explicitly marked as all-rounder
  if (role === 'WICKETKEEPER') return false;

  const bowlingRating = safeNumber(
    player.bowlingRating ??
    player.attributes?.bowling?.overall ??
    player.attributes?.bowlingRating ??
    player.stats?.bowling?.rating ??
    player.stats?.bowling,
    0
  );

  const hasBowlingRole =
    role === 'BOWLER' ||
    role === 'ALL_ROUNDER';

  const bowlingType =
    player.bowlingStyle ??
    player.attributes?.bowling?.style ??
    (hasBowlingRole && bowlingRating > 0 ? 'Right-arm medium' : null);

  return (
    hasBowlingRole &&
    bowlingRating > 0 &&
    bowlingType !== null
  );
}

/**
 * PHASE 2: Valid Bowler Pool Retrieval.
 * Returns only players who are strictly eligible bowlers.
 */
export function getValidBowlingPool(playingXI: Player[], requiredBowlingOptions: number = 5): Player[] {
  if (!Array.isArray(playingXI)) return [];
  const bowlingPool = playingXI.filter(isEligibleBowler);

  if (bowlingPool.length < requiredBowlingOptions) {
    console.warn(
      `[BOWLER_ELIGIBILITY] Playing XI has only ${bowlingPool.length} valid bowlers (expected at least ${requiredBowlingOptions}).`
    );
  }

  return bowlingPool;
}

/**
 * PHASE 4: Format-Specific Bowling Limits.
 * ODI: max 10 overs per bowler
 * T20: max 4 overs per bowler
 * Test: no fixed limit, workload/spell managed
 */
export function canBowlerBowlAnotherOver(
  bowler: Player,
  oversBowled: number,
  format: string = 'T20',
  currentSpellOvers: number = 0
): boolean {
  if (!isEligibleBowler(bowler)) return false;

  const fmt = (format || 'T20').toUpperCase();
  if (fmt === 'T20' || fmt === 'IPL') {
    return oversBowled < 4;
  }
  if (fmt === 'ODI') {
    return oversBowled < 10;
  }
  // Test match: rotation governed by spell limits (e.g. max 8-10 overs per spell before rest)
  if (fmt === 'TEST') {
    return currentSpellOvers < 10;
  }
  return true;
}
