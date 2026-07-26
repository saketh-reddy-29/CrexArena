import { Franchise } from '../../stores/useGameStore';
import { FranchiseDNA } from './TeamEvaluator';
import { SquadAnalysis } from './SquadBuilder';

export interface BudgetAnalysis {
  totalRemaining: number;
  reservedAmount: number;
  usableAmount: number;
  desperationPenalty: number;
}

export function analyzeBudget(
  franchise: Franchise,
  dna: FranchiseDNA,
  analysis: SquadAnalysis,
  currentPoolRemaining: number
): BudgetAnalysis {
  // 1. Calculate reserved amounts for remaining necessary slots
  // Assume average cost of a decent player is ₹3Cr, star is ₹8Cr, backup is ₹50L.
  
  let reservedAmount = 0;
  
  // Reserve for missing core roles (desperate needs)
  if (analysis.needs.wk >= 80) reservedAmount += 8_000_0000; // Desperate for WK -> reserve 8Cr
  else if (analysis.needs.wk >= 50) reservedAmount += 4_000_0000;
  
  if (analysis.needs.pace >= 80) reservedAmount += 10_000_0000; // Desperate for Pace -> reserve 10Cr
  else if (analysis.needs.pace >= 50) reservedAmount += 5_000_0000;
  
  if (analysis.needs.spin >= 80) reservedAmount += 7_000_0000;
  else if (analysis.needs.spin >= 50) reservedAmount += 3_500_0000;
  
  if (analysis.needs.batting >= 80) reservedAmount += 12_000_0000;
  
  // Base reserve for filling the squad (minimum ₹20L per remaining slot to reach 18 players)
  const minimumSlotsRemaining = Math.max(0, 18 - analysis.total);
  reservedAmount += (minimumSlotsRemaining * 2_000_000); // 20L per empty slot

  // Apply Budget Discipline DNA
  // If discipline is 100, they respect 100% of the reserve.
  // If discipline is 0 (e.g. RCB/PBKS), they might ignore up to 70% of their reserves to buy a star.
  const disciplineFactor = (dna.budgetDiscipline / 100);
  const adjustedReserve = reservedAmount * (0.3 + 0.7 * disciplineFactor);

  const usableAmount = Math.max(0, franchise.purse - adjustedReserve);

  // Desperation Penalty: If purse is low and we need a lot of players, 
  // reduce confidence in spending big.
  let desperationPenalty = 0;
  if (franchise.purse < 20_000_0000 && minimumSlotsRemaining > 3) {
    desperationPenalty = (minimumSlotsRemaining * 5) * (1 - disciplineFactor);
  }

  return {
    totalRemaining: franchise.purse,
    reservedAmount: adjustedReserve,
    usableAmount,
    desperationPenalty: Math.min(30, desperationPenalty)
  };
}
