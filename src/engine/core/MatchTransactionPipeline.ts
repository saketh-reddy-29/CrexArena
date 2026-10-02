import { db } from '../storage/Database';
import { ProgressionEngine, PerformanceInput } from '../players/progressionEngine';
import { RulesEngine } from '../rules/RulesEngine';
import { ArenaFormat, ArenaPlayerState } from '../models/ArenaState';
import { Player } from '../../types/common';

export interface ScorecardPlayerEntry {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  overs: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  catches: number;
  stumpings: number;
  runOuts?: number;
  dots?: number;
  ballsSurvived?: number;
  timeAtCrease?: number;
  fourthInnings?: boolean;
}

export interface MatchTransactionResult {
  matchId: string;
  arenaId: string;
  seasonId: string;
  format: ArenaFormat;
  team1Id: string;
  team2Id: string;
  winnerId?: string;
  loserId?: string;
  isDraw?: boolean;
  isTie?: boolean;
  oppositionStrength?: number;
  scorecard: ScorecardPlayerEntry[];
  playerMasterList?: Player[];
}

export class MatchTransactionPipeline {
  private rules: RulesEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
  }

  /**
   * Processes the entire match completion pipeline in an atomic transaction.
   * If any failure occurs, state is rolled back cleanly.
   */
  async processMatchResult(result: MatchTransactionResult): Promise<ArenaPlayerState[]> {
    const { matchId, arenaId, seasonId, format, scorecard, playerMasterList = [] } = result;

    await db.beginTransaction();
    const updatedStates: ArenaPlayerState[] = [];

    try {
      // 1. Iterate over every player in the scorecard
      for (const entry of scorecard) {
        // Find player in global master pool or fallback
        const masterPlayer = playerMasterList.find(p => p.id === entry.playerId) || {
          id: entry.playerId,
          name: entry.playerId,
          role: 'All-rounder',
          nationality: 'Indian',
          rating: 75,
          baseAbility: 75,
          basePrice: 0,
          stats: { batting: 75, bowling: 75, fielding: 75 },
          careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
        } as Player;

        // Retrieve existing state for this (arenaId, playerId, format)
        let playerState = await db.getPlayerState(arenaId, entry.playerId, format);

        if (!playerState) {
          // Initialize fresh format-specific state for this arena
          playerState = ProgressionEngine.createInitialState(arenaId, masterPlayer, format);
        }

        // 2. Prepare Performance Input
        const perfInput: PerformanceInput = {
          matchId,
          date: Date.now(),
          format,
          oppositionTeamId: result.team1Id === masterPlayer.intendedTeamId ? result.team2Id : result.team1Id,
          oppositionStrength: result.oppositionStrength || 75,
          matchResult: result.winnerId ? (result.winnerId === masterPlayer.intendedTeamId ? 'WIN' : 'LOSS') : (result.isDraw ? 'DRAW' : 'TIE'),
          runs: entry.runs,
          balls: entry.balls,
          fours: entry.fours,
          sixes: entry.sixes,
          isOut: entry.isOut,
          overs: entry.overs,
          maidens: entry.maidens,
          runsConceded: entry.runsConceded,
          wickets: entry.wickets,
          catches: entry.catches,
          stumpings: entry.stumpings,
          runOuts: entry.runOuts || 0,
          dots: entry.dots || 0,
          ballsSurvived: entry.ballsSurvived || entry.balls,
          timeAtCrease: entry.timeAtCrease || (entry.balls * 1.5),
          fourthInnings: entry.fourthInnings || false,
        };

        // 3. Process performance through ProgressionEngine
        const { updatedState, matchRecord } = ProgressionEngine.processMatchPerformance(
          playerState,
          perfInput,
          masterPlayer.role
        );

        // 4. Save player state in DB
        await db.savePlayerState(updatedState);
        updatedStates.push(updatedState);

        // 5. Save match log for analytics
        await db.saveMatchStats({
          id: `${matchId}_${entry.playerId}`,
          matchId,
          arenaId,
          playerId: entry.playerId,
          seasonId,
          format,
          runs: entry.runs,
          balls: entry.balls,
          fours: entry.fours,
          sixes: entry.sixes,
          isOut: entry.isOut,
          wickets: entry.wickets,
          overs: entry.overs,
          runsConceded: entry.runsConceded,
          maidens: entry.maidens,
          catches: entry.catches,
          stumpings: entry.stumpings,
          runOuts: entry.runOuts || 0,
          dots: entry.dots || 0,
          ballsSurvived: entry.ballsSurvived || entry.balls,
          performanceScore: matchRecord.performanceScore,
          expectedScore: matchRecord.expectedScore,
          ratingDelta: matchRecord.ratingDelta,
          oldRating: matchRecord.ratingBefore,
          newRating: matchRecord.ratingAfter,
          oldForm: matchRecord.formBefore,
          newForm: matchRecord.formAfter,
        });
      }

      // 6. Update Standings
      await this.updateStandings(arenaId, seasonId, result);

      // Commit transaction atomically
      await db.commitTransaction();
      return updatedStates;

    } catch (error) {
      await db.rollbackTransaction();
      console.error('Failed to commit match completion transaction. Rolled back.', error);
      throw error;
    }
  }

  private async updateStandings(arenaId: string, seasonId: string, result: MatchTransactionResult) {
    const { team1Id, team2Id, winnerId, loserId, isDraw, isTie } = result;

    if (winnerId && loserId) {
      const winnerStats = await db.getTeamStandings(arenaId, seasonId, winnerId);
      winnerStats.played++;
      winnerStats.won++;
      winnerStats.points += this.rules.getPointsForWin ? this.rules.getPointsForWin() : 2;
      await db.saveTeamStandings(winnerStats);

      const loserStats = await db.getTeamStandings(arenaId, seasonId, loserId);
      loserStats.played++;
      loserStats.lost++;
      loserStats.points += this.rules.getPointsForLoss ? this.rules.getPointsForLoss() : 0;
      await db.saveTeamStandings(loserStats);
    } else if (isDraw || isTie) {
      const t1Stats = await db.getTeamStandings(arenaId, seasonId, team1Id);
      t1Stats.played++;
      if (isDraw) t1Stats.drawn++;
      if (isTie) t1Stats.tied++;
      t1Stats.points += 1;
      await db.saveTeamStandings(t1Stats);

      const t2Stats = await db.getTeamStandings(arenaId, seasonId, team2Id);
      t2Stats.played++;
      if (isDraw) t2Stats.drawn++;
      if (isTie) t2Stats.tied++;
      t2Stats.points += 1;
      await db.saveTeamStandings(t2Stats);
    }
  }
}
