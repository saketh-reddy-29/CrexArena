import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../stores/useGameStore';
import { MatchStatus, MatchScorecard, InningsData } from '../types/match';

const createEmptyInningsData = (batTeam: string, bowlTeam: string, runs: number, wickets: number, overs: number, balls: number): InningsData => ({
  battingTeamId: batTeam,
  bowlingTeamId: bowlTeam,
  runs,
  wickets,
  overs,
  balls,
  batsmen: {
    'bat-1': { playerId: 'bat-1', runs: 50, balls: 35, fours: 4, sixes: 2, wickets: 0, overs: 0, runsConceded: 0, dots: 10 },
  },
  bowlers: {
    'bowl-1': { playerId: 'bowl-1', runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 2, overs: 4, runsConceded: 28, dots: 12 },
  },
  extras: { wides: 2, noBalls: 1, byes: 0, legByes: 1 },
  fallOfWickets: [],
  isFreeHitPending: false,
  drsReviews: [],
  drsReviewsRemaining: 2,
  strategicTimeouts: [],
  currentPhase: 'Middle' as any,
});

describe('Match Isolation & Standings Engine', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  it('preserves isolated, independent Playing XIs per fixture', () => {
    const store = useGameStore.getState();

    const match1Id = 'fixture-match-1';
    const match2Id = 'fixture-match-2';

    const match1Team1XI = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'];
    const match1Team2XI = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11'];

    const match2Team1XI = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11'];
    const match2Team2XI = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11'];

    store.setFixturePlayingXI(match1Id, match1Team1XI, match1Team2XI);
    store.setFixturePlayingXI(match2Id, match2Team1XI, match2Team2XI);

    // Retrieve and verify complete isolation
    const retrievedM1 = useGameStore.getState().fixturePlayingXIs[match1Id];
    const retrievedM2 = useGameStore.getState().fixturePlayingXIs[match2Id];

    expect(retrievedM1.team1XI).toEqual(match1Team1XI);
    expect(retrievedM1.team2XI).toEqual(match1Team2XI);

    expect(retrievedM2.team1XI).toEqual(match2Team1XI);
    expect(retrievedM2.team2XI).toEqual(match2Team2XI);

    // They must not collide
    expect(retrievedM1.team1XI).not.toEqual(retrievedM2.team1XI);
  });

  it('updates standings idempotently (never double-counts points or matches)', () => {
    const store = useGameStore.getState();

    // Setup initial teams and standing
    useGameStore.setState({
      selectedFormat: 'T20',
      standings: [
        { teamId: 'MI', played: 0, won: 0, lost: 0, points: 0, nrr: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, form: [] },
        { teamId: 'CSK', played: 0, won: 0, lost: 0, points: 0, nrr: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, form: [] },
      ],
      fixtures: [
        {
          id: 'test-f1',
          matchNumber: 1,
          day: 1,
          team1Id: 'MI',
          team2Id: 'CSK',
          status: MatchStatus.UPCOMING,
        },
      ],
    });

    const scorecard: MatchScorecard = {
      team1Id: 'MI',
      team2Id: 'CSK',
      winnerId: 'MI',
      innings: [
        createEmptyInningsData('MI', 'CSK', 180, 4, 20, 0),
        createEmptyInningsData('CSK', 'MI', 160, 8, 20, 0),
      ],
      margin: '20 runs',
    };

    // First update
    useGameStore.getState().updateMatchResult('test-f1', scorecard);

    let miStanding = useGameStore.getState().standings.find((s) => s.teamId === 'MI')!;
    let cskStanding = useGameStore.getState().standings.find((s) => s.teamId === 'CSK')!;

    expect(miStanding.played).toBe(1);
    expect(miStanding.won).toBe(1);
    expect(miStanding.points).toBe(2);
    expect(cskStanding.played).toBe(1);
    expect(cskStanding.lost).toBe(1);
    expect(cskStanding.points).toBe(0);

    // Second redundant update (same match ID and completed state)
    useGameStore.getState().updateMatchResult('test-f1', scorecard);

    miStanding = useGameStore.getState().standings.find((s) => s.teamId === 'MI')!;
    cskStanding = useGameStore.getState().standings.find((s) => s.teamId === 'CSK')!;

    // Must still be 1 played and 2 points
    expect(miStanding.played).toBe(1);
    expect(miStanding.points).toBe(2);
    expect(cskStanding.played).toBe(1);
    expect(cskStanding.points).toBe(0);
  });

  it('calculates Test Championship points and PCT correctly', () => {
    useGameStore.setState({
      selectedFormat: 'TEST',
      standings: [
        { teamId: 'IND', played: 0, won: 0, lost: 0, drawn: 0, points: 0, pct: 0, nrr: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, form: [] },
        { teamId: 'ENG', played: 0, won: 0, lost: 0, drawn: 0, points: 0, pct: 0, nrr: 0, runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0, form: [] },
      ],
      fixtures: [
        { id: 'test-m1', matchNumber: 1, day: 1, team1Id: 'IND', team2Id: 'ENG', status: MatchStatus.UPCOMING },
        { id: 'test-m2', matchNumber: 2, day: 9, team1Id: 'IND', team2Id: 'ENG', status: MatchStatus.UPCOMING },
      ],
    });

    // Match 1: India wins (12 points)
    const winScorecard: MatchScorecard = {
      team1Id: 'IND',
      team2Id: 'ENG',
      winnerId: 'IND',
      innings: [
        createEmptyInningsData('IND', 'ENG', 400, 10, 110, 0),
        createEmptyInningsData('ENG', 'IND', 250, 10, 85, 0),
      ],
      margin: '150 runs',
    };

    useGameStore.getState().updateMatchResult('test-m1', winScorecard);

    let indStanding = useGameStore.getState().standings.find((s) => s.teamId === 'IND')!;
    expect(indStanding.points).toBe(12);
    expect(indStanding.pct).toBe(100); // 12 / 12 * 100 = 100%

    // Match 2: Draw (4 points each)
    const drawScorecard: MatchScorecard = {
      team1Id: 'IND',
      team2Id: 'ENG',
      winnerId: 'DRAW' as any,
      innings: [
        createEmptyInningsData('IND', 'ENG', 350, 8, 120, 0),
        createEmptyInningsData('ENG', 'IND', 300, 7, 100, 0),
      ],
      margin: 'Match Drawn',
    };

    useGameStore.getState().updateMatchResult('test-m2', drawScorecard);

    indStanding = useGameStore.getState().standings.find((s) => s.teamId === 'IND')!;
    const engStanding = useGameStore.getState().standings.find((s) => s.teamId === 'ENG')!;

    // India: 12 + 4 = 16 points over 2 matches. Max possible = 24. PCT = 16/24 = 66.7%
    expect(indStanding.played).toBe(2);
    expect(indStanding.points).toBe(16);
    expect(indStanding.drawn).toBe(1);
    expect(indStanding.pct).toBeCloseTo(66.7, 1);

    // England: 0 + 4 = 4 points over 2 matches. PCT = 4/24 = 16.7%
    expect(engStanding.played).toBe(2);
    expect(engStanding.points).toBe(4);
    expect(engStanding.drawn).toBe(1);
    expect(engStanding.pct).toBeCloseTo(16.7, 1);
  });
});
