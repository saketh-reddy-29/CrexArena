import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSeasonFixtures,
  getNextScheduledUserFixture,
  getNextEligibleUserFixture,
  getNextScheduledAiFixture,
  findActiveUserMatch,
  validatePlayUserFixture,
  validateWatchAiFixture,
  validateSimulateAiFixture,
  getCompletedScorecard,
} from '../engine/competition/fixtureService';
import { useGameStore } from '../stores/useGameStore';
import { Fixture, MatchStatus, MatchScorecard, InningsData, Standing, PowerPlayPhase } from '../types/match';

function fixture(partial: Partial<Fixture> & Pick<Fixture, 'id' | 'team1Id' | 'team2Id' | 'day'>): Fixture {
  return {
    matchNumber: 1,
    status: MatchStatus.UPCOMING,
    fixtureStatus: 'SCHEDULED',
    ...partial,
  };
}

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
    currentPhase: PowerPlayPhase.MANDATORY,
  };
}

function scorecard(t1: string, t2: string, winner: string): MatchScorecard {
  return {
    team1Id: t1,
    team2Id: t2,
    winnerId: winner,
    innings: [innings(t1, t2, 160, 6), innings(t2, t1, 140, 9)],
  };
}

function standing(teamId: string): Standing {
  return {
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    points: 0,
    nrr: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
    form: [],
  };
}

const base = (): Fixture[] => [
  fixture({ id: 'd1-ai', matchNumber: 1, team1Id: 'RCB', team2Id: 'KKR', day: 1 }),
  fixture({ id: 'd1-user', matchNumber: 2, team1Id: 'MI', team2Id: 'CSK', day: 1 }),
  fixture({ id: 'd2-user', matchNumber: 3, team1Id: 'MI', team2Id: 'RCB', day: 2 }),
  fixture({ id: 'd2-ai', matchNumber: 4, team1Id: 'CSK', team2Id: 'KKR', day: 2 }),
];

describe('fixtureService — read helpers', () => {
  it('orders fixtures by day then match number', () => {
    const fixtures = [
      fixture({ id: 'b', matchNumber: 4, team1Id: 'A', team2Id: 'B', day: 2 }),
      fixture({ id: 'a', matchNumber: 1, team1Id: 'A', team2Id: 'B', day: 1 }),
      fixture({ id: 'c', matchNumber: 2, team1Id: 'A', team2Id: 'B', day: 1 }),
    ];
    expect(getSeasonFixtures(fixtures).map((f) => f.id)).toEqual(['a', 'c', 'b']);
  });

  it('finds the next scheduled user fixture regardless of match-day', () => {
    // Day 2 is still locked, but the dashboard still needs to show it is next.
    const fixtures = base();
    expect(getNextScheduledUserFixture(fixtures, 'MI')?.id).toBe('d1-user');

    // With day 1 resolved, the next scheduled user fixture is on day 2.
    const resolved = fixtures.map((f) =>
      f.day === 1 ? { ...f, status: MatchStatus.COMPLETED, finalized: true } : f,
    );
    expect(getNextScheduledUserFixture(resolved, 'MI')?.id).toBe('d2-user');
    // Day 2 has now arrived; fixtures within a day run in parallel, so the
    // user's day-2 fixture is eligible alongside the unresolved AI fixture.
    expect(getNextEligibleUserFixture(resolved, 'MI')?.id).toBe('d2-user');
    expect(getNextScheduledAiFixture(resolved, 'MI')?.id).toBe('d2-ai');

    // While day 1 is unresolved the day-1 user fixture is the eligible one.
    expect(getNextEligibleUserFixture(fixtures, 'MI')?.id).toBe('d1-user');
  });

  it('detects an in-progress user match', () => {
    const fixtures = base().map((f) =>
      f.id === 'd1-user' ? { ...f, fixtureStatus: 'LIVE' as const } : f,
    );
    expect(findActiveUserMatch(fixtures, 'MI')?.id).toBe('d1-user');
    expect(findActiveUserMatch(fixtures, 'RCB')).toBeNull();
  });
});

describe('fixtureService — action validation', () => {
  it('refuses unknown fixtures', () => {
    const result = validatePlayUserFixture('nope', base(), 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND');
  });

  it('refuses to play an AI-only fixture through the play path', () => {
    const result = validatePlayUserFixture('d1-ai', base(), 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('AI_FIXTURE');
  });

  it('refuses to replay a completed fixture', () => {
    const fixtures = base().map((f) =>
      f.id === 'd1-user' ? { ...f, status: MatchStatus.COMPLETED, finalized: true, scorecard: scorecard('MI', 'CSK', 'MI') } : f,
    );
    const result = validatePlayUserFixture('d1-user', fixtures, 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('COMPLETED');
  });

  it('refuses a locked (future-day) fixture', () => {
    const result = validatePlayUserFixture('d2-user', base(), 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('LOCKED');
      expect(result.error.message).toContain('Day 1');
    }
  });

  it('refuses a second user match while one is in progress', () => {
    // Two user fixtures on the same match-day; one is already live.
    const fixtures: Fixture[] = [
      fixture({ id: 'a', matchNumber: 1, team1Id: 'MI', team2Id: 'CSK', day: 1, fixtureStatus: 'LIVE' }),
      fixture({ id: 'b', matchNumber: 2, team1Id: 'MI', team2Id: 'RCB', day: 1 }),
    ];
    const result = validatePlayUserFixture('b', fixtures, 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ACTIVE_MATCH');

    // Resuming the live fixture itself is still allowed.
    expect(validatePlayUserFixture('a', fixtures, 'MI').ok).toBe(true);
  });

  it('allows playing an eligible user fixture and resuming a live one', () => {
    expect(validatePlayUserFixture('d1-user', base(), 'MI').ok).toBe(true);

    const live = base().map((f) =>
      f.id === 'd1-user' ? { ...f, fixtureStatus: 'LIVE' as const } : f,
    );
    expect(validatePlayUserFixture('d1-user', live, 'MI').ok).toBe(true);
  });

  it('routes AI fixtures to watch/simulate and blocks the user fixture', () => {
    expect(validateWatchAiFixture('d1-ai', base(), 'MI').ok).toBe(true);
    const userViaWatch = validateWatchAiFixture('d1-user', base(), 'MI');
    expect(userViaWatch.ok).toBe(false);
    if (!userViaWatch.ok) expect(userViaWatch.error.code).toBe('USER_FIXTURE');
  });

  it('refuses to simulate a fixture that is already live', () => {
    const fixtures = base().map((f) =>
      f.id === 'd1-ai' ? { ...f, fixtureStatus: 'LIVE' as const } : f,
    );
    const result = validateSimulateAiFixture('d1-ai', fixtures, 'MI');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_LIVE');
  });

  it('returns the stored scorecard only for resolved fixtures', () => {
    const resolved = base().map((f) =>
      f.id === 'd1-user' ? { ...f, status: MatchStatus.COMPLETED, finalized: true, scorecard: scorecard('MI', 'CSK', 'MI') } : f,
    );
    const ok = getCompletedScorecard('d1-user', resolved);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.scorecard.winnerId).toBe('MI');

    const pending = getCompletedScorecard('d2-user', resolved);
    expect(pending.ok).toBe(false);
    if (!pending.ok) expect(pending.error.code).toBe('NOT_COMPLETED');
  });
});

describe('fixtureService agrees with the store gates', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.setState({
      selectedFormat: 'T20',
      selectedFranchiseId: 'MI',
      standings: [standing('MI'), standing('CSK'), standing('RCB'), standing('KKR')],
      fixtures: base(),
    });
  });

  it('never reports ok when the store would refuse to start a user fixture', () => {
    // AI fixtures legitimately route through watch/simulate, so the play-gate
    // agreement is only meaningful for fixtures involving the user's team.
    for (const id of ['d1-user', 'd2-user']) {
      const state = useGameStore.getState();
      const validation = validatePlayUserFixture(id, state.fixtures, 'MI');
      const started = useGameStore.getState().startMatch(id);
      expect(validation.ok).toBe(started);
      // reset any live reservation before the next iteration
      useGameStore.setState({ fixtures: base(), liveMatchState: null });
    }
  });

  it('simulate validation agrees with the store gate for AI fixtures', () => {
    // Eligible AI fixture on the current day: the service allows simulation.
    expect(validateSimulateAiFixture('d1-ai', useGameStore.getState().fixtures, 'MI').ok).toBe(true);

    // Once the store reserves it as live, a second run is refused.
    useGameStore.setState({
      fixtures: useGameStore.getState().fixtures.map((f) =>
        f.id === 'd1-ai' ? { ...f, fixtureStatus: 'LIVE' as const } : f,
      ),
    });
    expect(validateSimulateAiFixture('d1-ai', useGameStore.getState().fixtures, 'MI').ok).toBe(false);

    // A locked AI fixture on a future day is refused too.
    expect(validateSimulateAiFixture('d2-ai', useGameStore.getState().fixtures, 'MI').ok).toBe(false);
  });
});
