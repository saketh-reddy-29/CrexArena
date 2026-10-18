import { CricketRules, FieldingRestriction } from "../types";
import { t20Rules } from "../t20/t20Rules";

/**
 * Base IPL playing conditions. Unlisted seasons inherit these modern-standard
 * conditions: 2 fielders outside the circle in overs 1-6, 5 thereafter
 * (identical to T20I powerplay law), impact player available, 2 reviews.
 */
export const iplRules: CricketRules = {
  ...t20Rules,
  format: "IPL",
  impactPlayer: true,
  maxLegSideFielders: 5,
  reviews: {
    perInnings: 2,
    retainedOnUmpireCall: true
  }
  // Any specific IPL deviations from generic T20 can go here
};

/**
 * Competition-specific, season-keyed playing conditions. A franchise
 * competition is NOT assumed to be identical every season — when a season's
 * officially notified conditions differ (fielding restriction windows, impact
 * player, etc.) they are registered here and `getRules('IPL', season)` applies
 * them automatically.
 */
export interface IplSeasonOverride {
  fieldingRestrictions?: FieldingRestriction[];
  maxLegSideFielders?: number;
  impactPlayer?: boolean;
  notes?: string;
}

export const IPL_SEASON_OVERRIDES: Record<number, IplSeasonOverride> = {
  // Example shape (kept empty until a season's conditions actually differ):
  // 2025: { fieldingRestrictions: [...], notes: 'Two-phase powerplay trial' },
};

/** Returns IPL rules honouring the configured competition season. */
export function getIplRulesForSeason(season: number = new Date().getFullYear()): CricketRules {
  const override = IPL_SEASON_OVERRIDES[season];
  if (!override) return iplRules;
  return {
    ...iplRules,
    ...(override.fieldingRestrictions ? { fieldingRestrictions: override.fieldingRestrictions } : {}),
    ...(override.maxLegSideFielders !== undefined ? { maxLegSideFielders: override.maxLegSideFielders } : {}),
    ...(override.impactPlayer !== undefined ? { impactPlayer: override.impactPlayer } : {}),
  };
}
