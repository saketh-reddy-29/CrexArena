import { Player } from '../types/common';
import { PlayerMatchStats } from '../types/match';
import { ArenaFormat } from '../engine/models/ArenaState';
import { ProgressionEngine, PerformanceInput } from '../engine/players/progressionEngine';

export interface PerformanceDelta {
  baseAbilityChange: number;
  formChange: number;
  newForm: number;
  newBaseAbility: number;
  updatedCareerStats: Player['careerStats'];
}

/**
 * Legacy bridge and performance calculation helper.
 * Uses ProgressionEngine for deterministic calculations.
 */
export function calculatePostMatchPerformance(
  player: Player,
  scorecard: PlayerMatchStats,
  format: ArenaFormat,
  arenaId: string = 'default_arena'
): PerformanceDelta {
  const initial = ProgressionEngine.createInitialState(arenaId, player, format);

  const input: PerformanceInput = {
    matchId: scorecard.matchId || 'match_temp',
    date: Date.now(),
    format,
    runs: scorecard.runs || 0,
    balls: scorecard.balls || 0,
    fours: scorecard.fours || 0,
    sixes: scorecard.sixes || 0,
    isOut: Boolean(scorecard.isOut),
    overs: scorecard.overs || 0,
    maidens: scorecard.maidens || 0,
    runsConceded: scorecard.runsConceded || 0,
    wickets: scorecard.wickets || 0,
    catches: scorecard.catches || 0,
    stumpings: scorecard.stumpings || 0,
    runOuts: 0,
  };

  const { updatedState, matchRecord } = ProgressionEngine.processMatchPerformance(
    initial,
    input,
    player.role
  );

  const baseAbilityChange = matchRecord.ratingDelta;
  const formChange = matchRecord.formAfter - matchRecord.formBefore;

  return {
    baseAbilityChange,
    formChange,
    newForm: updatedState.formRating,
    newBaseAbility: updatedState.currentRating,
    updatedCareerStats: {
      matches: (player.careerStats?.matches || 0) + 1,
      runs: (player.careerStats?.runs || 0) + input.runs,
      wickets: (player.careerStats?.wickets || 0) + input.wickets,
      ballsFaced: (player.careerStats?.ballsFaced || 0) + input.balls,
      ballsBowled: (player.careerStats?.ballsBowled || 0) + Math.round(input.overs * 6),
      runsConceded: (player.careerStats?.runsConceded || 0) + input.runsConceded,
      dismissals: (player.careerStats?.dismissals || 0) + (input.isOut ? 1 : 0),
      catches: (player.careerStats?.catches || 0) + input.catches,
    }
  };
}
