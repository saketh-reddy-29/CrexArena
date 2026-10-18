import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentMatchDay,
  getFixtureProgress,
  canStartFixture,
  getNextUserFixture,
  getNextAiFixture,
  getSeasonSummary,
  isFixtureResolved,
} from '../engine/competition/seasonProgression';
import { useGameStore } from '../stores/useGameStore';
import { Fixture, MatchStatus, MatchScorecard, InningsData, Standing } from '../types/match';

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
    currentPhase: 'Middle' as any,
  };
}

function scorecard(team1Id: string, team2Id: string, winnerId?: string): MatchScorecard {
  return {
    team1Id,
    team2Id,
    winnerId,
    innings: [innings(team1Id, team2Id, 180, 4), innings(team2Id, team1Id, 160, 8)],
    margin: winnerId ? '20 runs' : undefined,
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

const SEASON: Fixture[] = [
  fixture({ id: 'f1', day: 1, matchNumber: 1, team1Id: 'MI', team2Id: 'CSK' }),
  fixture({ id: 'f2', matchNumber: 2, day: 1, team1Id: 'RCB', team2Id: 'KKR' }),
  fixture({ id: 'f3', matchNumber: 3, day: 2, team1Id: 'MI', team2Id: 'RCB' }),
  fixture({ id: 'f4', matchNumber: 4, day: 2, team1Id: 'CSK', team2Id: 'KKR' }),
];

describe('seasonProgression — match-day eligibility', () => {
  it('reports the earliest unresolved day as the current match-day', () => {
    expect(getCurrentMatchDay([])).toBeNull();
    expect(getCurrentMatchDay([fixture({ id: 'a', team1Id: 'A', team2Id: 'B', day: 3 })])).toBe(3);

    const resolved = [fixture({ id: 'a', team1Id: 'A', team2Id: 'B', day: 1, status: MatchStatus.COMPLETED })];
    expect(getCurrentMatchDay([...resolved, fixture({ id: 'b', team1Id: 'A', team2Id: 'B', day: 2 })])).toBe(2);
  });

  it('classifies fixtures as COMPLETED / LIVE / PLAYABLE / LOCKED', () => {
    const fixtures: Fixture[] = [
      fixture({ id: 'done', team1Id: 'MI', team2Id: 'CSK', day: 1, status: MatchStatus.COMPLETED, scorecard: scorecard('MI', 'CSK', 'MI') }),
      fixture({ id: 'live', team1Id: 'MI', team2Id: 'RCB', day: 2, fixtureStatus: 'LIVE' }),
      fixture({ id: 'today', team1Id: 'CSK', team2Id: 'RCB', day: 2 }),
      fixture({ id: 'future', team1Id: 'MI', team2Id: 'CSK', day: 3 }),
    ];

    expect(getFixtureProgress(fixtures[0], fixtures, 'MI').state).toBe('COMPLETED');
    const live = getFixtureProgress(fixtures[1], fixtures, 'MI');
    expect(live.state).toBe('LIVE');
    expect(live.isUserFixture).toBe(true);
    expect(getFixtureProgress(fixtures[2], fixtures, 'MI').state).toBe('PLAYABLE');
    const locked = getFixtureProgress(fixtures[3], fixtures, 'MI');
    expect(locked.state).toBe('LOCKED');
    expect(locked.lockedReason).toContain('Day 2');
  });

  it('isFixtureResolved honours the finalized flag', () => {
    expect(isFixtureResolved(fixture({ id: 'x', team1Id: 'A', team2Id: 'B', day: 1, finalized: true }))).toBe(true);
    expect(isFixtureResolved(fixture({ id: 'y', team1Id: 'A', team2Id: 'B', day: 1, fixtureStatus: 'ABANDONED' }))).toBe(true);
  });

  it('canStartFixture blocks replay and out-of-order starts', () => {
    const fixtures: Fixture[] = [
      fixture({ id: 'd1', team1Id: 'MI', team2Id: 'CSK', day: 1 }),
      fixture({ id: 'd2', team1Id: 'MI', team2Id: 'RCB', day: 2 }),
      fixture({ id: 'done', team1Id: 'MI', team2Id: 'KKR', day: 1, status: MatchStatus.COMPLETED, scorecard: scorecard('MI', 'KKR', 'MI') }),
    ];

    expect(canStartFixture(fixtures[0], fixtures, 'MI').allowed).toBe(true);
    expect(canStartFixture(fixtures[1], fixtures, 'MI').allowed).toBe(false);
    const doneResult = canStartFixture(fixtures[2], fixtures, 'MI');
    expect(doneResult.allowed).toBe(false);
    expect(doneResult.reason).toContain('completed');
  });

  it('resolves the next user and AI fixtures for the current day', () => {
    const fixtures: Fixture[] = [
      fixture({ id: 'day1-ai', matchNumber: 1, team1Id: 'RCB', team2Id: 'KKR', day: 1 }),
      fixture({ id: 'day1-user', matchNumber: 2, team1Id: 'MI', team2Id: 'CSK', day: 1 }),
      fixture({ id: 'day2-user', matchNumber: 3, team1Id: 'MI', team2Id: 'RCB', day: 2 }),
    ];

    expect(getNextUserFixture(fixtures, 'MI')?.id).toBe('day1-user');
    expect(getNextAiFixture(fixtures, 'MI')?.id).toBe('day1-ai');
    // Without a user team everything is watchable (spectator).
    expect(getNextUserFixture(fixtures, null)).toBeNull();
    expect(getNextAiFixture(fixtures, null)?.id).toBe('day1-ai');
  });

  it('summarises season progress excluding playoffs when a league exists', () => {
    const fixtures: Fixture[] = [
      fixture({ id: 'l1', team1Id: 'MI', team2Id: 'CSK', day: 1, status: MatchStatus.COMPLETED }),
      fixture({ id: 'l2', team1Id: 'MI', team2Id: 'RCB', day: 2 }),
      fixture({ id: 'p1', team1Id: 'MI', team2Id: 'RCB', day: 1000, isPlayoff: true }),
    ];
    const summary = getSeasonSummary(fixtures);
    expect(summary.total).toBe(2);
    expect(summary.completed).toBe(1);
    expect(summary.remaining).toBe(1);
    expect(summary.currentMatchDay).toBe(2);
  });
});

describe('Season progression enforced by the store', () => {
  const fixtures = (): Fixture[] => [
    fixture({ id: 'f1', matchNumber: 1, team1Id: 'MI', team2Id: 'CSK', day: 1 }),
    fixture({ id: 'f2', matchNumber: 2, team1Id: 'RCB', team2Id: 'KKR', day: 1 }),
    fixture({ id: 'f3', matchNumber: 3, team1Id: 'MI', team2Id: 'RCB', day: 2 }),
    fixture({ id: 'f4', matchNumber: 3, team1Id: 'CSK', team2Id: 'KKR', day: 2 }),
  ];

  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.setState({
      selectedFormat: 'T20',
      selectedFranchiseId: 'MI',
      standings: [standing('MI'), standing('CSK'), standing('RCB'), standing('KKR')],
      fixtures: fixtures(),
    });
  });

  it('refuses to start a fixture whose day has not arrived', () => {
    const store = useGameStore.getState();
    expect(useGameStore.getState().startMatch('f1')).toBe(true);

    // Day 1 is still unresolved because f2 is pending → day 2 is locked.
    expect(useGameStore.getState().startMatch('f2')).toBe(true);
    expect(useGameStore.getState().startMatch('f1')).toBe(true);
    // Focusing a day-2 fixture is rejected while day 1 is unresolved.
    useGameStore.setState({
      fixtures: fixtures().map((f) => (f.id === 'f3' ? f : f)),
    });
    expect(useGameStore.getState().startMatch('f3')).toBe(false);
  });

  it('unlocks the next day once the previous day is resolved', () => {
    useGameStore.getState().updateMatchResult('f1', scorecard('MI', 'CSK', 'MI'));
    useGameStore.getState().updateMatchResult('f2', scorecard('RCB', 'KKR', 'RCB'));

    const state = useGameStore.getState();
    expect(getCurrentMatchDay(state.fixtures)).toBe(2);
    expect(useGameStore.getState().startMatch('f2a-does-not-exist')).toBe(false);
  });

  it('never starts a finalised fixture (replay prevention)', () => {
    useGameStore.getState().updateMatchResult('f1', scorecard('MI', 'CSK', 'MI'));
    const fixtureAfter = useGameStore.getState().fixtures.find((f) => f.id === 'f1')!;
    expect(fixtureAfter.finalized).toBe(true);
    expect(useGameStore.getState().startMatch('f1')).toBe(false);
    // A second, different result must not overwrite the first.
    useGameStore.getState().updateMatchResult('f1', scorecard('MI', 'CSK', 'CSK'));
    expect(useGameStore.getState().fixtures.find((f) => f.id === 'f1')!.scorecard?.winnerId).toBe('MI');
  });

  it('refuses to skip the user\'s own fixture but permits AI skip gates', () => {
    useGameStore.setState({
      selectedFranchiseId: 'MI',
      standings: [standing('MI'), standing('CSK'), standing('RCB'), standing('KKR')],
      fixtures: fixtures(),
    });

    // User fixture f1: skip must be a no-op (stays scheduled).
    useGameStore.getState().autoSimulateMatch('f1');
    expect(useGameStore.getState().fixtures.find((f) => f.id === 'f1')!.fixtureStatus).toBe('SCHEDULED');

    // Locked day-2 AI fixture f4: skip must be a no-op.
    useGameStore.getState().autoSimulateMatch('f4');
    expect(useGameStore.getState().fixtures.find((f) => f.id === 'f4')!.fixtureStatus).toBe('SCHEDULED');
  });

  it('generates a season exactly once (idempotent)', () => {
    useGameStore.getState().resetGame();
    useGameStore.setState({ selectedFormat: 'T20', franchises: useGameStore.getState().franchises });
    useGameStore.getState().generateSeasonFixtures();
    const first = useGameStore.getState().fixtures;
    expect(first.length).toBeGreaterThan(0);

    const firstIds = first.map((f) => f.id).join(',');
    useGameStore.getState().generateSeasonFixtures();
    expect(useGameStore.getState().fixtures.map((f) => f.id).join(',')).toBe(firstIds);

    // A played result survives a subsequent generate call.
    const target = first[0].id;
    useGameStore.getState().startMatch(target);
    useGameStore.getState().updateMatchResult(target, scorecard(first[0].team1Id, first[0].team2Id, first[0].team1Id));
    useGameStore.getState().generateSeasonFixtures();
    expect(useGameStore.getState().fixtures.find((f) => f.id === target)!.status).toBe(MatchStatus.COMPLETED);
  });
});
