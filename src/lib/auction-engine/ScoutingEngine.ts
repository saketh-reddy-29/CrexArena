import { Player } from '../../types/common';
import { Franchise } from '../../stores/useGameStore';
import { FranchiseDNA } from './TeamEvaluator';
import { AuctionState } from '../../lib/auctionAI';

// Simple string hashing function to generate a consistent pseudo-random number
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Returns a hidden rating for a player based on a specific team's scouting network.
 * Varies by up to +/- 3 points from the actual rating.
 * Uses a hash of the player ID and franchise ID to ensure consistency.
 */
export function getHiddenRating(player: Player, franchise: Franchise, dna: FranchiseDNA): number {
  const seedStr = `${player.id}-${franchise.id}`;
  const hash = Math.abs(hashString(seedStr));
  
  // Base variance -3 to +3
  let variance = (hash % 7) - 3;
  
  // Apply DNA biases to the scouted rating
  if (player.rating >= 90 && dna.starPreference > 80) variance += 1;
  if (player.nationality === 'Indian' && dna.domesticPreference > 80) variance += 1;
  
  // Cap the final rating between 50 and 99
  return Math.min(99, Math.max(50, player.rating + variance));
}

/**
 * Dynamic Market Value logic.
 * Not just Base Price * Multiplier, but factors in age, form, potential, etc.
 */
export function getDynamicMarketValue(
  player: Player, 
  scoutedRating: number, 
  auctionState: AuctionState,
  inflationMultiplier: number = 1.0
): number {
  const base = player.basePrice;
  let multiplier = 1.0;

  // 1. Rating Tier Multiplier
  if (scoutedRating >= 95) multiplier = 2.8;
  else if (scoutedRating >= 90) multiplier = 2.2;
  else if (scoutedRating >= 85) multiplier = 1.7;
  else if (scoutedRating >= 80) multiplier = 1.3;
  else multiplier = 1.1;

  // 2. Form & Stats bonus (potential/form)
  const form = player.form ?? 70;
  if (form > 85) multiplier += 0.2;
  else if (form < 50) multiplier -= 0.1;

  // 3. Role premium (All-rounders and Pacers are expensive)
  if (player.role === 'All-rounder') multiplier += 0.3;
  if (player.role === 'Bowler' && player.bowlingStyle?.toLowerCase().includes('fast')) multiplier += 0.15;

  // 4. Indian premium (Indian capped players are highly sought)
  if (player.nationality === 'Indian' && scoutedRating >= 82) multiplier += 0.25;

  // 5. Phase Discount (Players late in the auction go cheaper if money is dry)
  const ratio = auctionState.totalPlayers === 0 ? 0 : auctionState.poolIndex / auctionState.totalPlayers;
  if (ratio > 0.8) multiplier -= 0.2; // Bench phase

  // Apply global inflation/deflation
  multiplier *= inflationMultiplier;

  // Calculate final value and clamp to reasonable bounds
  const rawValue = base * multiplier;
  
  // Absolute max limits to prevent absurd valuations
  if (scoutedRating < 80) return Math.min(rawValue, 6_000_0000);
  if (scoutedRating < 90) return Math.min(rawValue, 12_000_0000);
  
  return rawValue;
}
