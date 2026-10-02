export interface PartnershipState {
  runs: number;
  balls: number;
  runRate: number;
  status: 'NEW_PARTNERSHIP' | 'BUILDING' | 'ESTABLISHED' | 'DOMINANT';
  milestoneTrigger: number | null; // 50, 100, 150, 200 or null
  batterConfidenceBoost: number;   // 0 to 25
  bowlerUrgencyScore: number;      // 0 to 100
}

export class PartnershipEngine {
  /**
   * Evaluates partnership dynamics and generates tactical responses
   */
  public evaluate(runs: number, balls: number, format: string): PartnershipState {
    const runRate = balls > 0 ? (runs / balls) * 6 : 0;
    const fmt = format.toUpperCase();

    // 1. Determine Partnership Status
    let status: 'NEW_PARTNERSHIP' | 'BUILDING' | 'ESTABLISHED' | 'DOMINANT' = 'NEW_PARTNERSHIP';
    const estThreshold = fmt === 'TEST' ? 60 : fmt === 'ODI' ? 45 : 30;
    const domThreshold = fmt === 'TEST' ? 120 : fmt === 'ODI' ? 90 : 65;

    if (runs >= domThreshold) {
      status = 'DOMINANT';
    } else if (runs >= estThreshold) {
      status = 'ESTABLISHED';
    } else if (runs >= 15) {
      status = 'BUILDING';
    }

    // 2. Check milestone crosses
    let milestoneTrigger: number | null = null;
    if (runs >= 200) milestoneTrigger = 200;
    else if (runs >= 150) milestoneTrigger = 150;
    else if (runs >= 100) milestoneTrigger = 100;
    else if (runs >= 50) milestoneTrigger = 50;

    // 3. Batter confidence & bowler urgency
    const batterConfidenceBoost = status === 'DOMINANT' ? 20 : status === 'ESTABLISHED' ? 12 : status === 'BUILDING' ? 5 : 0;
    const bowlerUrgencyScore = status === 'DOMINANT' ? 95 : status === 'ESTABLISHED' ? 80 : status === 'BUILDING' ? 50 : 30;

    return {
      runs,
      balls,
      runRate: Number(runRate.toFixed(2)),
      status,
      milestoneTrigger,
      batterConfidenceBoost,
      bowlerUrgencyScore,
    };
  }
}

export const partnershipEngine = new PartnershipEngine();
