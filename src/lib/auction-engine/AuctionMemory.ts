import { Franchise } from '../../stores/useGameStore';
import { Player } from '../../types/common';
import { FranchiseAIState } from '../../lib/auctionAI';

export interface MemoryFactors {
  frustrationBoost: number;
  fatiguePenalty: number;
}

/**
 * Calculates emotional and memory-based factors for a franchise's bid.
 */
export function getMemoryFactors(
  player: Player,
  franchiseState: FranchiseAIState
): MemoryFactors {
  let frustrationBoost = 0;
  let fatiguePenalty = 0;

  // 1. Frustration / Revenge Bidding
  // If the franchise recently lost a bidding war for a player of the SAME role,
  // they become more desperate/frustrated and bid more aggressively.
  if (franchiseState.lostWarFor === player.role) {
    frustrationBoost = 15; // +15% confidence boost due to panic/frustration
  }

  // 2. Bidding Fatigue
  // If the franchise has been bidding constantly without winning, they might pull back slightly
  // or if they just bought someone expensive, they rest for a bit.
  if (franchiseState.fatigueLevel > 50) {
    fatiguePenalty = -10; // Tired of bidding wars
  } else if (franchiseState.fatigueLevel > 80) {
    fatiguePenalty = -25; // Exhausted budget/energy
  }

  // 3. Consecutive Passes (Boredom/Desperation)
  // If they have passed on 20 players in a row, they might get antsy
  if (franchiseState.consecutivePasses > 15) {
    frustrationBoost += 5;
  }

  return {
    frustrationBoost,
    fatiguePenalty
  };
}
