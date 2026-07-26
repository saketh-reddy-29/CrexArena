import { Player } from '../../types/common';
import { FranchiseDNA } from './TeamEvaluator';
import { SquadAnalysis, getSpecificRoleNeed } from './SquadBuilder';
import { BudgetAnalysis } from './BudgetPlanner';
import { MarketDynamics } from './MarketEngine';
import { MemoryFactors } from './AuctionMemory';

export interface ConfidenceResult {
  score: number; // 0 to 100
  rationale: string[];
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

/**
 * Calculates a probabilistic confidence score (0-100) on whether the team wants to bid.
 * This completely replaces the old deterministic weighted score logic.
 */
export function calculateConfidence(
  player: Player,
  scoutedRating: number,
  currentBid: number,
  dynamicMarketValue: number,
  dna: FranchiseDNA,
  squadAnalysis: SquadAnalysis,
  budgetAnalysis: BudgetAnalysis,
  marketDynamics: MarketDynamics,
  memoryFactors: MemoryFactors
): ConfidenceResult {
  let score = 0;
  const rationale: string[] = [];

  // 1. Core Base (Rating & Need)
  const roleNeed = getSpecificRoleNeed(player, squadAnalysis);
  
  // A team will not bid on a player if they don't need the role AT ALL
  if (roleNeed === 0) {
    return { score: 0, rationale: ['Role fully satisfied'] };
  }
  
  // Overseas cap check
  if (player.nationality === 'Overseas' && squadAnalysis.needs.overseas === 0) {
    return { score: 0, rationale: ['Overseas quota full'] };
  }

  score += scoutedRating * 0.4; // Base desire from pure rating
  score += roleNeed * 0.3; // Base desire from role need

  // 2. Price Valuation Check
  const priceRatio = currentBid / dynamicMarketValue;
  if (priceRatio < 0.5) {
    score += 20; // Massive bargain
    rationale.push('Bargain price');
  } else if (priceRatio < 0.9) {
    score += 10; // Good deal
  } else if (priceRatio > 1.5) {
    score -= 20; // Overpriced
    rationale.push('Overpriced vs Valuation');
  } else if (priceRatio > 2.5) {
    score -= 50; // Insanely overpriced
  }

  // 3. Apply DNA & Emotional Factors
  if (dna.preferredRoles.includes(player.role)) {
    score += 5;
  }
  if (dna.rivalTeams.includes(player.intendedTeamId ?? '')) {
    score += 5; // Rivalry boost
    rationale.push('Rivalry target');
  }
  if (player.intendedTeamId === dna.name) {
    score += dna.loyalty * 0.15; // Loyalty boost
    rationale.push('Franchise loyalty');
  }

  // Frustration & Fatigue
  score += memoryFactors.frustrationBoost;
  score += memoryFactors.fatiguePenalty;
  
  if (memoryFactors.frustrationBoost > 0) rationale.push('Revenge bidding');

  // 4. Budget Realities & Scarcity
  score -= budgetAnalysis.desperationPenalty;
  score *= marketDynamics.scarcityMultiplier; // If scarce, multiply confidence
  
  if (marketDynamics.scarcityMultiplier > 1.1) rationale.push('Scarcity panic');

  // Hard Cap check
  if (currentBid >= budgetAnalysis.usableAmount) {
    // They can't afford it using their usable budget.
    // If discipline is low, they might dip into reserves, but it drastically lowers confidence
    const overspendRatio = currentBid / budgetAnalysis.totalRemaining;
    if (overspendRatio > 0.9) {
      return { score: 0, rationale: ['Cannot afford'] };
    } else {
      score -= (dna.budgetDiscipline * 0.5); // Strict teams drop out instantly
      rationale.push('Dipping into reserves');
    }
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    rationale
  };
}
