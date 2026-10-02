import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { db } from '../engine/storage/Database';
import { safeRating, safeForm, safeNumber } from '../engine/utils/safeMath';
import { PlayerFormStatus } from '../engine/players/types';

export interface PlayerEffectiveRating {
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
}

// Basic format modifiers (simulating deep attributes)
const FORMAT_MODIFIERS: Record<ArenaFormat, { batAggressionBase: number; batPatienceBase: number; bowlPaceBase: number; bowlSpinBase: number }> = {
  T20:  { batAggressionBase: 1.2, batPatienceBase: 0.7, bowlPaceBase: 1.1, bowlSpinBase: 1.0 },
  ODI:  { batAggressionBase: 1.0, batPatienceBase: 1.0, bowlPaceBase: 1.0, bowlSpinBase: 1.0 },
  TEST: { batAggressionBase: 0.7, batPatienceBase: 1.3, bowlPaceBase: 1.1, bowlSpinBase: 1.2 },
  IPL:  { batAggressionBase: 1.2, batPatienceBase: 0.7, bowlPaceBase: 1.1, bowlSpinBase: 1.0 },
};

/**
 * Retrieves the format-specific rating for a player in a specific arena.
 * If not yet played in the arena, returns their baseAbility/rating for that format.
 */
export async function getPlayerRatingAsync(playerId: string, format: ArenaFormat, arenaId?: string): Promise<number> {
  if (arenaId) {
    const state = await db.getPlayerState(arenaId, playerId, format);
    if (state) {
      return safeRating(state.currentRating);
    }
  }
  return 75;
}

/**
 * Synchronous accessor for player rating, taking in an optional arena player state dictionary or fallback.
 */
export function getPlayerRating(
  player: Player,
  format: ArenaFormat,
  arenaPlayerStates?: Record<string, any>
): number {
  const key = arenaPlayerStates ? `${player.id}_${format}` : null;
  if (key && arenaPlayerStates && arenaPlayerStates[key]) {
    return safeRating(arenaPlayerStates[key].currentRating);
  }
  
  // Format-adjusted base rating
  const baseAbility = safeRating(player.baseAbility || player.rating || 75);
  const mods = FORMAT_MODIFIERS[format] || FORMAT_MODIFIERS.T20;
  let mult = 1.0;
  if (format === 'TEST') {
    mult = player.role === 'Batsman' ? (player.strikeRate && player.strikeRate < 130 ? 1.03 : 0.98) : 1.0;
  } else if (format === 'IPL' || format === 'T20') {
    mult = player.role === 'Batsman' ? (player.strikeRate && player.strikeRate > 140 ? 1.03 : 0.98) : 1.0;
  }
  return safeRating(baseAbility * mult);
}

/**
 * Retrieves format-specific form status with clear labels.
 * If no matches played, returns value: null and label: "NO MATCHES".
 */
export function getPlayerForm(
  player: Player,
  format: ArenaFormat,
  arenaPlayerState?: any
): PlayerFormStatus {
  if (!arenaPlayerState || !arenaPlayerState.hasRecentMatches || arenaPlayerState.recentMatchCount === 0 || arenaPlayerState.recentForm === 0) {
    return {
      value: 0, // Explicitly 0 for fresh state with no matches played yet
      label: "New / No Data",
      trend: "NEUTRAL",
      delta: 0,
      recentMatches: 0,
      lastMatchAt: undefined,
    };
  }

  const formVal = safeForm(arenaPlayerState.recentForm || arenaPlayerState.formRating);
  const delta = safeNumber(arenaPlayerState.ratingDelta, 0);

  let label = "GOOD FORM";
  if (formVal >= 85) label = "PEAK FORM";
  else if (formVal >= 70) label = "GOOD FORM";
  else if (formVal >= 55) label = "MODERATE";
  else if (formVal >= 40) label = "DIP IN FORM";
  else label = "POOR FORM";

  let trend: 'IMPROVING' | 'DECLINING' | 'NEUTRAL' = 'NEUTRAL';
  if (delta > 0.05) trend = 'IMPROVING';
  else if (delta < -0.05) trend = 'DECLINING';

  return {
    value: formVal,
    label,
    trend,
    delta,
    recentMatches: arenaPlayerState.recentMatchCount || 0,
    lastMatchAt: arenaPlayerState.lastMatchAt ? new Date(arenaPlayerState.lastMatchAt) : undefined,
  };
}

/**
 * Calculates a player's effective rating based on the current format and their role.
 */
export function calculateEffectiveRating(
  player: Player, 
  format: ArenaFormat,
  arenaPlayerState?: any
): PlayerEffectiveRating {
  const mods = FORMAT_MODIFIERS[format] || FORMAT_MODIFIERS.T20;
  
  const isAggressive = player.strikeRate ? player.strikeRate > 135 : (player.role === 'Batsman');
  const isPace = player.bowlingStyle?.toLowerCase().includes('fast') || player.bowlingStyle?.toLowerCase().includes('medium');
  const isSpin = player.bowlingStyle?.toLowerCase().includes('spin');

  let effBatting = player.stats?.batting ?? player.attributes?.battingAbility ?? player.rating ?? 50;
  let effBowling = player.stats?.bowling ?? player.attributes?.bowlingAbility ?? player.rating ?? 50;
  const effFielding = player.stats?.fielding ?? player.attributes?.fielding ?? 80;

  if (arenaPlayerState) {
    effBatting = arenaPlayerState.battingRating || effBatting;
    effBowling = arenaPlayerState.bowlingRating || effBowling;
  }

  // Apply format modifiers
  if (player.role === 'Batsman' || player.role === 'All-rounder' || player.role === 'Wicketkeeper') {
    effBatting = isAggressive ? effBatting * mods.batAggressionBase : effBatting * mods.batPatienceBase;
  }

  if (player.role === 'Bowler' || player.role === 'All-rounder') {
    if (isPace) effBowling = effBowling * mods.bowlPaceBase;
    else if (isSpin) effBowling = effBowling * mods.bowlSpinBase;
    else effBowling = effBowling * ((mods.bowlPaceBase + mods.bowlSpinBase) / 2);
  }

  effBatting = safeRating(effBatting);
  effBowling = safeRating(effBowling);

  const baseAbility = arenaPlayerState?.currentRating || player.baseAbility || player.rating || 75;
  const currentForm = arenaPlayerState?.hasRecentMatches ? arenaPlayerState.formRating : 75;
  
  // Base Ability (70%) + Form (30%)
  const baseOverall = (baseAbility * 0.70) + (currentForm * 0.30);

  let overallMod = 1.0;
  if (player.role === 'Batsman' || player.role === 'Wicketkeeper') {
    overallMod = isAggressive ? mods.batAggressionBase : mods.batPatienceBase;
  } else if (player.role === 'Bowler') {
    overallMod = isPace ? mods.bowlPaceBase : (isSpin ? mods.bowlSpinBase : 1.0);
  } else if (player.role === 'All-rounder') {
    overallMod = (isAggressive ? mods.batAggressionBase : mods.batPatienceBase) * 0.5 + 
                 (isPace ? mods.bowlPaceBase : (isSpin ? mods.bowlSpinBase : 1.0)) * 0.5;
  }

  const overall = safeRating(baseOverall * overallMod);

  return {
    overall,
    batting: effBatting,
    bowling: effBowling,
    fielding: effFielding
  };
}

export function getFormatSpecificProfile(player: Player, format: ArenaFormat, arenaPlayerState?: any) {
  const seed = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const v = (base: number, offsetSeed: number, variance: number = 6) => {
    const val = base + ((seed + offsetSeed) % variance) - (variance / 2);
    return Math.min(99, Math.max(30, Math.round(val)));
  };

  let techniqueMod = 0;
  let powerMod = 0;
  let concentrationMod = 0;
  let aggressionMod = 0;

  if (format === 'TEST') {
    techniqueMod = 10;
    concentrationMod = 15;
    powerMod = -10;
    aggressionMod = -15;
  } else if (format === 'T20' || format === 'IPL') {
    techniqueMod = -5;
    concentrationMod = -10;
    powerMod = 15;
    aggressionMod = 15;
  }

  const baseBat = arenaPlayerState?.battingRating ?? player.stats?.batting ?? player.attributes?.battingAbility ?? player.rating ?? 50;
  const currentRating = arenaPlayerState?.currentRating ?? player.rating ?? 75;
  const currentForm = arenaPlayerState?.hasRecentMatches ? arenaPlayerState.formRating : 75;
  const currentFitness = arenaPlayerState?.fitness ?? player.stamina ?? 85;
  const currentConfidence = arenaPlayerState?.confidence ?? 75;

  return {
    batting: {
      technique: Math.min(99, Math.max(30, v(baseBat, 1, 6) + techniqueMod)),
      consistency: v(baseBat, 2, 8),
      timing: v(baseBat, 3, 5),
      power: Math.min(99, Math.max(30, (player.role === 'Bowler' ? v(baseBat, 4, 15) : v(baseBat, 4, 10)) + powerMod)),
      strikeRotation: v(baseBat, 5, 5),
      againstPace: v(baseBat, 6, 6),
      againstSpin: v(baseBat, 7, 6),
    },
    mental: {
      concentration: Math.min(99, Math.max(30, v(currentRating, 8, 7) + concentrationMod)),
      temperament: player.temperament || v(currentRating, 9, 8),
      aggression: Math.min(99, Math.max(30, (player.aggression || v(75, 10, 30)) + aggressionMod)),
    },
    fielding: {
      fielding: v(player.stats?.fielding || 80, 11, 5),
      catching: v(player.stats?.fielding || 80, 12, 5),
    },
    form: {
      currentForm,
      fitness: currentFitness,
      confidence: currentConfidence,
    }
  };
}
