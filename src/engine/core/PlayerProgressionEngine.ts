export class PlayerProgressionEngine {
  
  /**
   * Updates player form and rating based on match performance.
   * Based on principles:
   * 1. Form changes fluidly but retains memory (80% old, 20% new)
   * 2. Rating changes slowly based on (Form - Expected Form)
   * 3. Delta is clamped to prevent massive jumps (+/- 0.30 max per match)
   */
  updatePlayerAfterMatch(player: any, matchPerformanceScore: number) {
    // 1. Calculate New Form
    // Example: Old form 88.2, Match Performance 95
    // New Form = 88.2 * 0.80 + 95 * 0.20 = 70.56 + 19 = 89.56
    const oldForm = player.form || 50;
    const newForm = (oldForm * 0.80) + (matchPerformanceScore * 0.20);

    // 2. Calculate Rating Delta
    const currentRating = player.formatRating || 50;
    // Expected Form is roughly equal to their Rating
    const expectedForm = currentRating;
    
    let ratingDelta = (newForm - expectedForm) * 0.03;
    
    // Clamp the delta to ensure ratings move gradually
    ratingDelta = Math.max(-0.30, Math.min(0.30, ratingDelta));

    const newRating = currentRating + ratingDelta;

    // Return the updated attributes to be saved back to the database/store
    return {
      form: Number(newForm.toFixed(2)),
      formatRating: Number(newRating.toFixed(2)),
      ratingDelta: Number(ratingDelta.toFixed(2))
    };
  }
}
