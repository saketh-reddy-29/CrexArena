import { FranchiseDNA } from './TeamEvaluator';
import { AggressionLevel } from './BidStrategy';

export interface TimingContext {
  aggression: AggressionLevel;
  dna: FranchiseDNA;
  currentBid: number;
  marketValue: number;
}

/**
 * Generates human-like delay times in milliseconds.
 * Teams will pause, think, fake hesitation, or snap-bid.
 */
export function getHumanLikeBidDelay(context: TimingContext): number {
  const { aggression, dna, currentBid, marketValue } = context;

  // Base reaction time based on aggression
  let baseDelay = 1500;
  let variance = 500;

  switch (aggression) {
    case 'Extreme':
      baseDelay = 400;
      variance = 300;
      break;
    case 'High':
      baseDelay = 800;
      variance = 400;
      break;
    case 'Medium':
      baseDelay = 1500;
      variance = 800;
      break;
    case 'Low':
      baseDelay = 2500;
      variance = 1000;
      break;
  }

  // 1. DNA Patience modification
  // Patient teams wait longer (add up to 1 second)
  const patienceFactor = (dna.patience / 100);
  baseDelay += (patienceFactor * 1000);

  // 2. Hesitation / "Thinking" logic
  // If the price is getting close to the market value, teams start to "think" longer
  const priceRatio = currentBid / marketValue;
  if (priceRatio > 0.9 && Math.random() > 0.5) {
    // Fake hesitation / deep thought
    baseDelay += 1500 + Math.random() * 2000; 
  } else if (priceRatio > 1.2 && Math.random() > 0.3) {
    // Overpaying causes massive hesitation before continuing
    baseDelay += 2000 + Math.random() * 3000;
  }

  // 3. Late Auction Snap (Panic!)
  // If the team is low patience and the price is cheap, they might snap bid instantly
  if (dna.patience < 30 && priceRatio < 0.5 && Math.random() > 0.7) {
    baseDelay = 200 + Math.random() * 200; // Almost instant
  }

  // Final calculation with variance
  let finalDelay = baseDelay + (Math.random() * variance) - (variance / 2);
  
  // Ensure we don't go below 250ms (inhumanly fast) and not above 8 seconds (too boring)
  return Math.min(8000, Math.max(250, finalDelay));
}
