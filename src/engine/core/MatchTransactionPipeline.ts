import { db } from '../storage/Database';
import { PlayerProgressionEngine } from './PlayerProgressionEngine';
import { RulesEngine } from '../rules/RulesEngine';

export class MatchTransactionPipeline {
  private progressionEngine: PlayerProgressionEngine;
  private rules: RulesEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
    this.progressionEngine = new PlayerProgressionEngine();
  }

  /**
   * Processes the entire match result transactionally.
   * If any step fails, the entire database state rolls back.
   */
  async processMatchResult(matchId: string, arenaId: string, seasonId: string, matchResult: any) {
    await db.beginTransaction();

    try {
      // 1. Process player performances (scorecards)
      for (const playerStats of matchResult.scorecard) {
        // Load the player's current arena state
        let arenaPlayer = await db.getPlayerState(arenaId, playerStats.playerId);
        
        if (!arenaPlayer) {
          // Fallback creation if playing their first match in this Arena
          arenaPlayer = this.createNewArenaPlayer(arenaId, playerStats.playerId, playerStats.baseRating);
        }

        // Generate a performance score (0-100) based on runs/wickets/format
        const performanceScore = this.calculatePerformanceScore(playerStats);
        
        // Let the progression engine calculate the controlled delta
        const progression = this.progressionEngine.updatePlayerAfterMatch(arenaPlayer, performanceScore);
        
        // Update the Arena Player State
        arenaPlayer.matches += 1;
        arenaPlayer.runs += playerStats.runs;
        arenaPlayer.wickets += playerStats.wickets;
        arenaPlayer.catches += playerStats.catches;
        arenaPlayer.stumpings += playerStats.stumpings;
        arenaPlayer.currentRating = progression.formatRating;
        arenaPlayer.formRating = progression.form;

        await db.savePlayerState(arenaPlayer);

        // Save historical match log
        await db.saveMatchStats({
          id: `${matchId}_${playerStats.playerId}`,
          matchId,
          arenaId,
          seasonId,
          playerId: playerStats.playerId,
          runs: playerStats.runs,
          balls: playerStats.balls,
          fours: playerStats.fours,
          sixes: playerStats.sixes,
          isOut: playerStats.isOut,
          wickets: playerStats.wickets,
          overs: playerStats.overs,
          runsConceded: playerStats.runsConceded,
          maidens: playerStats.maidens,
          catches: playerStats.catches,
          stumpings: playerStats.stumpings,
          performanceScore,
          ratingDelta: progression.ratingDelta,
          oldRating: arenaPlayer.currentRating - progression.ratingDelta,
          newRating: arenaPlayer.currentRating
        });
      }

      // 2. Update Standings
      await this.updateStandings(arenaId, seasonId, matchResult);

      // Commit all changes
      await db.commitTransaction();
      return true;

    } catch (error) {
      await db.rollbackTransaction();
      console.error('Failed to process match result. Rolling back changes.', error);
      throw error;
    }
  }

  private calculatePerformanceScore(stats: any) {
    // Simplified: E.g., 1 run = 1 point, 1 wicket = 25 points, strike rate bonuses, etc.
    let score = (stats.runs || 0) + ((stats.wickets || 0) * 25);
    return Math.min(100, Math.max(0, score)); // Keep 0-100
  }

  private createNewArenaPlayer(arenaId: string, playerId: string, baseRating: number = 75) {
    return {
      id: `${arenaId}_${playerId}`,
      arenaId,
      playerId,
      baseRating,
      currentRating: baseRating,
      formRating: 50,
      battingRating: baseRating,
      bowlingRating: baseRating,
      fieldingRating: baseRating,
      matches: 0,
      runs: 0,
      wickets: 0,
      catches: 0,
      stumpings: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  private async updateStandings(arenaId: string, seasonId: string, matchResult: any) {
    const { winnerId, loserId, isDraw, isTie } = matchResult;

    if (winnerId && loserId) {
      const winnerStats = await db.getTeamStandings(arenaId, seasonId, winnerId);
      winnerStats.played++;
      winnerStats.won++;
      winnerStats.points += this.rules.getPointsForWin();
      await db.saveTeamStandings(winnerStats);

      const loserStats = await db.getTeamStandings(arenaId, seasonId, loserId);
      loserStats.played++;
      loserStats.lost++;
      loserStats.points += this.rules.getPointsForLoss();
      await db.saveTeamStandings(loserStats);
    }
    // Handle draws / ties ...
  }
}
