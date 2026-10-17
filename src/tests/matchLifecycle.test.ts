import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/useGameStore';
import { MatchStatus, MatchScorecard, InningsData, Standing } from '../types/match';

function innings(batTeam: string, bowlTeam: string, runs: number, wickets: number): InningsData {
  return {
    battingTeamId: batTeam,
    bowlingTeamId: bowlTeam,
    runs,
    wickets,
    overs: 20,
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

function standing(teamId: string): Standing {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    tied: 0,
    points: 0,
    nrr: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
    form: [],
  };
}

function seedMatch(id = 'life-1') {
  useGameStore.setState({
    selectedFormat: 'T20',
    currentMatchId: null,
    standings: [standing('MI'), standing('CSK')],
    fixtures: [
      { id, matchNumber: 1, day: 1, team1Id: 'MI', team2Id: 'CSK', status: MatchStatus.UPCOMING, fixtureStatus: 'SCHEDULED' },
      { id: `${id}-later`, matchNumber: 2, day: 2, team1Id: 'MI', team2Id: 'CSK', status: MatchStatus.UPCOMING, fixtureStatus: 'SCHEDULED' },
    ],
  });
  return id;
}

const result = (winnerId?: string): MatchScorecard => ({
  team1Id: 'MI',
  team2Id: 'CSK',
  winnerId,
  innings: [innings('MI', 'CSK', 180, 4), innings('CSK', 'MI', 160, 8)],
  margin: winnerId ? '20 runs' : undefined,
});

describe('Match lifecycle & result immutability', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('startMatch transitions a scheduled fixture to LIVE and focuses it', () => {
    const id = seedMatch();

    const started = useGameStore.getState().startMatch(id);
    expect(started).toBe(true);

    const state = useGameStore.getState();
    const fixture = state.fixtures.find((f) => f.id === id)!;
    expect(fixture.fixtureStatus).toBe('LIVE');
    // Coarse status stays playable/upcoming so the fixture remains in the schedule flow.
    expect(fixture.status).toBe(MatchStatus.UPCOMING);
    expect(state.currentMatchId).toBe(id);
  });

  it('rejects starting an unknown or already-finalised fixture', () => {
    const id = seedMatch();

    expect(useGameStore.getState().startMatch('does-not-exist')).toBe(false);

    useGameStore.getState().updateMatchResult(id, result('MI'));
    expect(useGameStore.getState().startMatch(id)).toBe(false);
  });

  it('never applies a result to an unknown fixture id', () => {
    seedMatch();
    useGameStore.getState().updateMatchResult('phantom-match', result('MI'));

    const mi = useGameStore.getState().standings.find((s) => s.teamId === 'MI')!;
    expect(mi.played).toBe(0);
    expect(mi.points).toBe(0);
  });

  it('finalises a fixture once and locks its result against overwrite', () => {
    const id = seedMatch();

    useGameStore.getState().updateMatchResult(id, result('MI'));
    let state = useGameStore.getState();
    let fixture = state.fixtures.find((f) => f.id === id)!;
    expect(fixture.status).toBe(MatchStatus.COMPLETED);
    expect(fixture.fixtureStatus).toBe('COMPLETED');
    expect(fixture.scorecard?.winnerId).toBe('MI');
    expect(state.standings.find((s) => s.teamId === 'MI')!.points).toBe(2);

    // A completely different result submitted afterwards must be ignored.
    useGameStore.getState().updateMatchResult(id, result('CSK'));
    state = useGameStore.getState();
    fixture = state.fixtures.find((f) => f.id === id)!;
    expect(fixture.scorecard?.winnerId).toBe('MI');
    expect(state.standings.find((s) => s.teamId === 'MI')!.points).toBe(2);
    expect(state.standings.find((s) => s.teamId === 'CSK')!.points).toBe(0);
  });

  it('abandonMatch records a NO_RESULT and awards a shared point without double counting', () => {
    const id = seedMatch();

    useGameStore.getState().abandonMatch(id);
    let state = useGameStore.getState();
    let fixture = state.fixtures.find((f) => f.id === id)!;
    expect(fixture.status).toBe(MatchStatus.ABANDONED);
    expect(fixture.fixtureStatus).toBe('ABANDONED');
    expect(fixture.scorecard?.result).toBe('NO_RESULT');
    expect(state.standings.find((s) => s.teamId === 'MI')!.points).toBe(1);
    expect(state.standings.find((s) => s.teamId === 'CSK')!.points).toBe(1);

    // Idempotent: abandoning again (or finalising) leaves the table untouched.
    useGameStore.getState().abandonMatch(id);
    useGameStore.getState().updateMatchResult(id, result('MI'));
    state = useGameStore.getState();
    expect(state.standings.find((s) => s.teamId === 'MI')!.points).toBe(1);
    expect(state.standings.find((s) => s.teamId === 'CSK')!.points).toBe(1);
  });
});
