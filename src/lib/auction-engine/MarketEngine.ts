import { Player } from '../../types/common';
import { AuctionState } from '../../lib/auctionAI';

export interface MarketDynamics {
  scarcityMultiplier: number;
  inflationMultiplier: number;
}

/**
 * Calculates how scarce a specific role is in the remaining auction pool.
 * If there are very few elite spinners left, their scarcity multiplier goes up.
 */
function getScarcityMultiplier(player: Player, remainingPool: Player[]): number {
  if (player.rating < 85) return 1.0; // Scarcity only matters for elite/starting players

  const similarPlayersLeft = remainingPool.filter(p => 
    p.role === player.role && 
    p.rating >= 85 && 
    p.nationality === player.nationality // Indian vs Overseas scarcity is distinct
  ).length;

  if (similarPlayersLeft === 0) return 1.4; // Last elite player of this type! Panic!
  if (similarPlayersLeft === 1) return 1.2;
  if (similarPlayersLeft === 2) return 1.1;
  if (similarPlayersLeft >= 5) return 0.9; // Surplus of this type

  return 1.0;
}

/**
 * Calculates global inflation based on recent auction history.
 * If the last 5 players sold for massive amounts relative to their base price,
 * teams might become stingy (deflation) or panic (inflation depending on stage).
 */
function getInflationMultiplier(history: AuctionState['auctionHistory']): number {
  if (history.length < 5) return 1.0; // Not enough data yet

  // Get last 5 sales
  const recentSales = history.slice(-5);
  let totalSpent = 0;
  let totalExpected = 0;

  for (const sale of recentSales) {
    totalSpent += sale.price;
    // We assume a rough expected value was ~2x base price on average
    // Since we don't have the player object in history easily here, we use a simple heuristic
    // If average recent sale > 8Cr, market is hot.
  }

  const avgSpent = totalSpent / 5;
  
  // High inflation (teams overpaying recently)
  if (avgSpent > 10_000_0000) return 1.15;
  if (avgSpent > 7_000_0000) return 1.05;
  
  // Deflation (teams holding back)
  if (avgSpent < 2_000_0000) return 0.9;

  return 1.0;
}

/**
 * Evaluates the current market dynamics for a specific player.
 */
export function evaluateMarket(player: Player, auctionState: AuctionState): MarketDynamics {
  const scarcity = getScarcityMultiplier(player, auctionState.remainingPool);
  const inflation = getInflationMultiplier(auctionState.auctionHistory);

  return {
    scarcityMultiplier: scarcity,
    inflationMultiplier: inflation
  };
}
