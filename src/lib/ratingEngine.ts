import { Player } from '../types/common';
import { ArenaFormat } from '../stores/useGameStore';

export interface PlayerEffectiveRating {
  overall: number;
  batting: number;
  bowling: number;
  fielding: number;
}

// Basic format modifiers (simulating deep attributes)
const FORMAT_MODIFIERS: Record<ArenaFormat, { batAggressionBase: number, batPatienceBase: number, bowlPaceBase: number, bowlSpinBase: number }> = {
  T20:  { batAggressionBase: 1.2, batPatienceBase: 0.7, bowlPaceBase: 1.1, bowlSpinBase: 1.0 },
  ODI:  { batAggressionBase: 1.0, batPatienceBase: 1.0, bowlPaceBase: 1.0, bowlSpinBase: 1.0 },
  TEST: { batAggressionBase: 0.7, batPatienceBase: 1.3, bowlPaceBase: 1.1, bowlSpinBase: 1.2 },
  IPL:  { batAggressionBase: 1.2, batPatienceBase: 0.7, bowlPaceBase: 1.1, bowlSpinBase: 1.0 },
};

/**
 * Calculates a player's effective rating based on the current format and their role.
 * This introduces variety so a player isn't equally good in Tests and T20s.
 */
export function calculateEffectiveRating(player: Player, format: ArenaFormat): PlayerEffectiveRating {
  const mods = FORMAT_MODIFIERS[format];
  
  // Use player's hidden or assumed attributes, fallback to role-based assumptions
  const isAggressive = player.strikeRate ? player.strikeRate > 135 : (player.role === 'Batsman' ? true : false);
  const isPace = player.bowlingStyle?.toLowerCase().includes('fast') || player.bowlingStyle?.toLowerCase().includes('medium');
  const isSpin = player.bowlingStyle?.toLowerCase().includes('spin');

  // Base stats from player object
  let effBatting = player.stats?.batting ?? player.attributes?.battingAbility ?? player.rating ?? 50;
  let effBowling = player.stats?.bowling ?? player.attributes?.bowlingAbility ?? player.rating ?? 50;
  const effFielding = player.stats?.fielding ?? player.attributes?.fielding ?? 80;

  // Apply format modifiers
  if (player.role === 'Batsman' || player.role === 'All-rounder' || player.role === 'Wicketkeeper') {
    if (isAggressive) {
      effBatting = effBatting * mods.batAggressionBase;
    } else {
      effBatting = effBatting * mods.batPatienceBase;
    }
  }

  if (player.role === 'Bowler' || player.role === 'All-rounder') {
    if (isPace) {
      effBowling = effBowling * mods.bowlPaceBase;
    } else if (isSpin) {
      effBowling = effBowling * mods.bowlSpinBase;
    } else {
      // Default modifier if style unknown
      effBowling = effBowling * ((mods.bowlPaceBase + mods.bowlSpinBase) / 2);
    }
  }

  // Normalize stats to 1-99 range
  effBatting = Math.min(99, Math.max(1, Math.round(effBatting)));
  effBowling = Math.min(99, Math.max(1, Math.round(effBowling)));

  // Implement User's Dynamic Base + Form logic
  const baseAbility = player.baseAbility || player.rating;
  const currentForm = player.form || 85;
  
  // Base Ability (70%) + Form (30%)
  let baseOverall = (baseAbility * 0.70) + (currentForm * 0.30);

  // Still apply format penalty/buff based on role style
  let overallMod = 1.0;
  if (player.role === 'Batsman' || player.role === 'Wicketkeeper') {
    overallMod = isAggressive ? mods.batAggressionBase : mods.batPatienceBase;
  } else if (player.role === 'Bowler') {
    overallMod = isPace ? mods.bowlPaceBase : (isSpin ? mods.bowlSpinBase : 1.0);
  } else if (player.role === 'All-rounder') {
    overallMod = (isAggressive ? mods.batAggressionBase : mods.batPatienceBase) * 0.5 + 
                 (isPace ? mods.bowlPaceBase : (isSpin ? mods.bowlSpinBase : 1.0)) * 0.5;
  }

  let overall = Math.min(99, Math.max(1, Math.round(baseOverall * overallMod)));

  return {
    overall,
    batting: effBatting,
    bowling: effBowling,
    fielding: effFielding
  };
}

export function getFormatSpecificProfile(player: Player, format: ArenaFormat) {
  const seed = player.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const v = (base: number, offsetSeed: number, variance: number = 6) => {
    const val = base + ((seed + offsetSeed) % variance) - (variance / 2);
    return Math.min(99, Math.max(30, Math.round(val)));
  };

  const isAggressive = player.strikeRate ? player.strikeRate > 135 : (player.role === 'Batsman' ? true : false);
  const isPace = player.bowlingStyle?.toLowerCase().includes('fast') || player.bowlingStyle?.toLowerCase().includes('medium');
  const isSpin = player.bowlingStyle?.toLowerCase().includes('spin');

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

  const baseBat = player.stats?.batting ?? player.attributes?.battingAbility ?? player.rating ?? 50;

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
      concentration: Math.min(99, Math.max(30, v(player.rating, 8, 7) + concentrationMod)),
      temperament: player.temperament || v(player.rating, 9, 8),
      aggression: Math.min(99, Math.max(30, (player.aggression || v(75, 10, 30)) + aggressionMod)),
    },
    fielding: {
      fielding: v(player.stats?.fielding || 80, 11, 5),
      catching: v(player.stats?.fielding || 80, 12, 5),
    },
    form: {
      currentForm: player.form || v(player.rating, 13, 15),
      fitness: player.stamina || v(85, 14, 10),
      confidence: v(player.form || player.rating, 15, 12),
    }
  };
}
