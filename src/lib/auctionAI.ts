import { Player } from '../types/common';
import { Franchise } from '../stores/useGameStore';

// Import new modular engine components
import { getFranchiseDNA } from './auction-engine/TeamEvaluator';
import { analyzeSquad } from './auction-engine/SquadBuilder';
import { analyzeBudget } from './auction-engine/BudgetPlanner';
import { getHiddenRating, getDynamicMarketValue } from './auction-engine/ScoutingEngine';
import { evaluateMarket } from './auction-engine/MarketEngine';
import { getMemoryFactors } from './auction-engine/AuctionMemory';
import { calculateConfidence } from './auction-engine/ConfidenceEngine';
import { calculateBidStrategy } from './auction-engine/BidStrategy';
import { getHumanLikeBidDelay, TimingContext } from './auction-engine/TimingEngine';

export interface AuctionState {
  poolIndex: number;
  totalPlayers: number;
  auctionHistory: Array<{ playerId: string; soldTo: string; price: number }>;
  remainingPool: Player[];
}

export interface FranchiseAIState {
  fatigueLevel: number;
  lostWarFor?: string;
  lastPurchasePrice: number;
  consecutivePasses: number;
}

export interface AuctionDecision {
  decision: 'BUY' | 'PASS';
  confidence: number;
  recommendedBid: number;
  maximumBid: number;
  aggression: 'Low' | 'Medium' | 'High' | 'Extreme';
  dropoutProbability: number;
  heatScore: number; // Kept for backward compatibility
  rationale: string[];
  
  // Hidden context passed to getBidDelay
  _timingContext?: TimingContext; 
}

/**
 * Evaluates whether a franchise should bid on a player.
 * Orchestrates all the sub-modules (Scouting, Budget, Market, Confidence, etc.)
 */
export function evaluateBid(
  player: Player,
  franchise: Franchise,
  currentBid: number,
  allFranchises: Franchise[],
  auctionState: AuctionState,
  franchiseState: FranchiseAIState
): AuctionDecision {
  
  // 1. Team DNA & Emotional State
  const dna = getFranchiseDNA(franchise);
  const memoryFactors = getMemoryFactors(player, franchiseState);
  
  // 2. Squad & Budget Analysis
  const squadAnalysis = analyzeSquad(franchise);
  const budgetAnalysis = analyzeBudget(franchise, dna, squadAnalysis, auctionState.remainingPool.length);
  
  // 3. Scouting & Market Dynamics
  const scoutedRating = getHiddenRating(player, franchise, dna);
  const marketDynamics = evaluateMarket(player, auctionState);
  const dynamicMarketValue = getDynamicMarketValue(player, scoutedRating, auctionState, marketDynamics.inflationMultiplier);
  
  // 4. Calculate Confidence (Probability to bid)
  const confidence = calculateConfidence(
    player,
    scoutedRating,
    currentBid,
    dynamicMarketValue,
    dna,
    squadAnalysis,
    budgetAnalysis,
    marketDynamics,
    memoryFactors
  );
  
  // 5. Final Bid Strategy (Jump bids, dropout checks)
  const strategy = calculateBidStrategy(
    player,
    franchise,
    dna,
    currentBid,
    confidence
  );

  return {
    decision: strategy.decision,
    confidence: confidence.score,
    recommendedBid: strategy.recommendedBid,
    maximumBid: strategy.maximumBid,
    aggression: strategy.aggression,
    dropoutProbability: strategy.dropoutProbability,
    heatScore: marketDynamics.scarcityMultiplier * 100, // Approximate mapping for UI compatibility
    rationale: confidence.rationale,
    _timingContext: {
      aggression: strategy.aggression,
      dna,
      currentBid,
      marketValue: dynamicMarketValue
    }
  };
}

/**
 * Calculates a human-like delay before the bid is fired.
 */
export function getBidDelay(decision: AuctionDecision): number {
  if (decision._timingContext) {
    return getHumanLikeBidDelay(decision._timingContext);
  }
  
  // Fallback if context is missing
  if (decision.aggression === 'Extreme') return 320 + Math.random() * 200;
  if (decision.aggression === 'High') return 680 + Math.random() * 320;
  if (decision.aggression === 'Medium') return 1100 + Math.random() * 420;
  return 1650 + Math.random() * 600;
}
