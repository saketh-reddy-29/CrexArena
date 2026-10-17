import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/useGameStore';
import { MatchScorecard, InningsData } from '../types/match';

function inn(batTeam: string, bowlTeam: string, runs: number, wickets: number): InningsData {
  return {
    battingTeamId: batTeam,
    bowlingTeamId: bowlTeam,
    runs,
    wickets,
    overs: 40,
    balls: 0,
    batsmen: {},
    bowlers: {},
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    fallOfWickets: [],
    isFreeHitPending: false,
    drsReviews: [],
    drsReviewsRemaining: 2,
    strategicTimeouts: [],
    currentPhase: 'Middle' as any,
  };
}

describe('Series store integration', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('creates a series with matching fixtures and a 2-row table', () => {
    const store = useGameStore.getState();
    store.createSeries({ format: 'TEST', team1Id: 'ENG', team2Id: 'AUS', matchCount: 3, name: 'The Ashes' });

    const state = useGameStore.getState();
    expect(state.seriesConfig?.name).toBe('The Ashes');
    expect(state.fixtures).toHaveLength(3);
    expect(state.standings).toHaveLength(2);
    expect(state.standings.map((s) => s.teamId).sort()).toEqual(['AUS', 'ENG']);
    // Series is a Test, so the arena switches to the Test format.
    expect(state.selectedFormat).toBe('TEST');
  });

  it('recomputes WTC points after a Test win', () => {
    const store = useGameStore.getState();
    store.createSeries({ format: 'TEST', team1Id: 'ENG', team2Id: 'AUS', matchCount: 1, name: 'Ashes' });

    const fixture = useGameStore.getState().fixtures[0];
    const scorecard: MatchScorecard = {
      team1Id: fixture.team1Id,
      team2Id: fixture.team2Id,
      innings: [inn(fixture.team1Id, fixture.team2Id, 400, 10), inn(fixture.team2Id, fixture.team1Id, 250, 10)],
      result: 'WIN',
      winnerId: fixture.team1Id,
    };

    useGameStore.getState().updateMatchResult(fixture.id, scorecard);

    const standings = useGameStore.getState().standings;
    const winner = standings.find((s) => s.teamId === fixture.team1Id)!;
    const loser = standings.find((s) => s.teamId === fixture.team2Id)!;
    expect(winner.points).toBe(12);
    expect(winner.won).toBe(1);
    expect(loser.points).toBe(0);
    expect(loser.lost).toBe(1);
    expect(winner.played).toBe(1);
    expect(loser.played).toBe(1);
    // WTC percentage for a 1-match Test series win: 12 / (1 * 12) * 100
    expect(winner.pct).toBeCloseTo(100, 1);
  });

  it('is idempotent when the same result is submitted twice', () => {
    const store = useGameStore.getState();
    store.createSeries({ format: 'ODI', team1Id: 'IND', team2Id: 'AUS', matchCount: 1 });
    const fixture = useGameStore.getState().fixtures[0];
    const scorecard: MatchScorecard = {
      team1Id: fixture.team1Id,
      team2Id: fixture.team2Id,
      innings: [inn(fixture.team1Id, fixture.team2Id, 250, 8), inn(fixture.team2Id, fixture.team1Id, 240, 10)],
      result: 'WIN',
      winnerId: fixture.team1Id,
    };

    useGameStore.getState().updateMatchResult(fixture.id, scorecard);
    useGameStore.getState().updateMatchResult(fixture.id, scorecard);

    const standings = useGameStore.getState().standings;
    expect(standings.find((s) => s.teamId === fixture.team1Id)!.points).toBe(2); // not 4
    expect(standings.find((s) => s.teamId === fixture.team1Id)!.played).toBe(1); // not 2
  });

  it('clears the series and its fixtures', () => {
    const store = useGameStore.getState();
    store.createSeries({ format: 'T20', team1Id: 'IND', team2Id: 'SA', matchCount: 2 });
    expect(useGameStore.getState().seriesConfig).not.toBeNull();

    useGameStore.getState().clearSeries();
    expect(useGameStore.getState().seriesConfig).toBeNull();
    expect(useGameStore.getState().fixtures).toHaveLength(0);
    expect(useGameStore.getState().standings).toHaveLength(0);
  });
});
