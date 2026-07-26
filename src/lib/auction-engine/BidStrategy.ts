import { Player } from '../../types/common';
import { Franchise } from '../../stores/useGameStore';
import { FranchiseDNA } from './TeamEvaluator';
import { ConfidenceResult } from './ConfidenceEngine';

export type AggressionLevel = 'Low' | 'Medium' | 'High' | 'Extreme';

export interface BidDecision {
  decision: 'BUY' | 'PASS';
  recommendedBid: number;
  maximumBid: number;
  aggression: AggressionLevel;
  dropoutProbability: number;
}

const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export function calculateBidStrategy(
  player: Player,
  franchise: Franchise,
  dna: FranchiseDNA,
  currentBid: number,
  confidence: ConfidenceResult
): BidDecision {
  
  // 1. Determine Aggression based on Confidence
  let aggression: AggressionLevel = 'Low';
  if (confidence.score >= 85) aggression = 'Extreme';
  else if (confidence.score >= 70) aggression = 'High';
  else if (confidence.score >= 55) aggression = 'Medium';

  // 2. Dropout Probability (Probabilistic decision making)
  // Even if they want the player, there's a chance they just pass if they aren't 'Extreme'
  let dropoutProbability = 0;
  if (aggression === 'Low') dropoutProbability = 0.85; // 85% chance to just give up
  else if (aggression === 'Medium') dropoutProbability = 0.40;
  else if (aggression === 'High') dropoutProbability = 0.10;
  else dropoutProbability = 0.01; // Almost never drops out early

  // DNA risk tolerance modifies dropout (low risk tolerance = drops out faster)
  dropoutProbability += (100 - dna.riskTolerance) * 0.002;
  dropoutProbability = clamp(dropoutProbability, 0.01, 0.99);

  // 3. Max Bid (How far will they go?)
  // Rather than just adding fixed amounts, it scales with purse and confidence
  const maxBidExtension = 
    aggression === 'Extreme' ? 30_000_0000 : 
    aggression === 'High' ? 15_000_0000 : 
    aggression === 'Medium' ? 5_000_0000 : 
    2_500_000;
  
  const maximumBid = clamp(currentBid + maxBidExtension, player.basePrice, franchise.purse);

  // 4. Strategic Jump Bids
  // Instead of always bidding the minimum increment, high aggression teams
  // might randomly jump the bid to intimidate others.
  let jumpBidAmount = currentBid < 50_000_000 ? 2_500_000 : 5_000_000; // Standard increment
  
  if (dna.aggression > 80 && aggression === 'Extreme' && Math.random() > 0.6) {
    // Intimidation Jump Bid!
    jumpBidAmount = 20_000_000; // Jump by 2Cr!
  } else if (dna.aggression > 70 && aggression === 'High' && Math.random() > 0.8) {
    jumpBidAmount = 10_000_000; // Jump by 1Cr
  }

  const recommendedBid = clamp(currentBid + jumpBidAmount, player.basePrice, maximumBid);

  // 5. Final Decision
  // They BUY if they haven't exceeded max bid and they pass the probabilistic check
  const passesProbabilisticCheck = Math.random() > dropoutProbability;
  
  let decision: 'BUY' | 'PASS' = 'PASS';
  if (currentBid < maximumBid && passesProbabilisticCheck && franchise.purse >= recommendedBid) {
    decision = 'BUY';
  }

  return {
    decision,
    recommendedBid: Math.round(recommendedBid),
    maximumBid: Math.round(maximumBid),
    aggression,
    dropoutProbability
  };
}
