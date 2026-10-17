import { describe, it, expect } from 'vitest';
import {
  MAX_SERIES_MATCHES,
  computeSeriesStandings,
  createSeriesConfig,
  generateSeriesFixtures,
  getSeriesMaxPoints,
  getSeriesPoints,
  getSeriesWinner,
  inferFixtureResult,
} from '../engine/competition/seriesEngine';
import { Fixture, MatchStatus, SeriesConfig } from '../types/match';

function completedFixture(
  configId: string,
  team1Id: string,
  team2Id: string,
  opts: Partial<Fixture> & { result?: 'WIN' | 'DRAW' | 'TIE'; winnerId?: string },
): Fixture {
  const { result, winnerId, ...rest } = opts;
  return {
    id: `${configId}_x`,
    matchNumber: 1,
    day: 1,
    team1Id,
    team2Id,
    status: MatchStatus.COMPLETED,
    tournamentId: configId,
    scorecard: {
      team1Id,
      team2Id,
      innings: [],
      result,
      winnerId,
    },
    ...rest,
  };
}

describe('SeriesEngine — configuration', () => {
  it('creates a validated series config', () => {
    const cfg = createSeriesConfig({ format: 'ODI', team1Id: 'IND', team2Id: 'AUS', matchCount: 3, name: 'Ind v Aus' }, 'S1');
    expect(cfg.id).toBe('S1');
    expect(cfg.name).toBe('Ind v Aus');
    expect(cfg.format).toBe('ODI');
    expect(cfg.matchCount).toBe(3);
  });

  it('rejects same-team and out-of-range series', () => {
    expect(() => createSeriesConfig({ format: 'T20', team1Id: 'IND', team2Id: 'IND', matchCount: 3 })).toThrow(/different teams/);
    expect(() => createSeriesConfig({ format: 'T20', team1Id: 'IND', team2Id: 'AUS', matchCount: 0 })).toThrow(/between/);
    expect(() => createSeriesConfig({ format: 'T20', team1Id: 'IND', team2Id: 'AUS', matchCount: MAX_SERIES_MATCHES + 1 })).toThrow(/between/);
  });

  it('uses the WTC points scheme for Tests and 2/1 for limited overs', () => {
    expect(getSeriesPoints('TEST')).toEqual({ win: 12, tie: 6, draw: 4, loss: 0, noResult: 0 });
    expect(getSeriesPoints('ODI')).toEqual({ win: 2, tie: 1, draw: 1, loss: 0, noResult: 1 });
    expect(getSeriesMaxPoints('TEST')).toBe(12);
    expect(getSeriesMaxPoints('T20')).toBe(2);
  });
});

describe('SeriesEngine — fixture generation', () => {
  it('creates the requested number of fixtures with alternating home advantage', () => {
    const cfg = createSeriesConfig({ format: 'ODI', team1Id: 'IND', team2Id: 'AUS', matchCount: 3 }, 'S1');
    const fixtures = generateSeriesFixtures(cfg, 0);
    expect(fixtures).toHaveLength(3);
    expect(fixtures.map((f) => f.team1Id)).toEqual(['IND', 'AUS', 'IND']);
    expect(fixtures.map((f) => f.team2Id)).toEqual(['AUS', 'IND', 'AUS']);
    expect(fixtures.every((f) => f.tournamentId === 'S1')).toBe(true);
    expect(fixtures.every((f) => f.status === MatchStatus.UPCOMING)).toBe(true);
  });

  it('spaces Test matches by 8 days and limited-overs by 3', () => {
    const testCfg = createSeriesConfig({ format: 'TEST', team1Id: 'ENG', team2Id: 'AUS', matchCount: 2 }, 'T');
    const testFixtures = generateSeriesFixtures(testCfg, 0);
    const DAY = 24 * 60 * 60 * 1000;
    expect(testFixtures[1].startTime! - testFixtures[0].startTime!).toBe(8 * DAY);

    const t20Cfg = createSeriesConfig({ format: 'T20', team1Id: 'IND', team2Id: 'SA', matchCount: 2 }, 'X');
    const t20Fixtures = generateSeriesFixtures(t20Cfg, 0);
    expect(t20Fixtures[1].startTime! - t20Fixtures[0].startTime!).toBe(3 * DAY);
  });
});

describe('SeriesEngine — standings', () => {
  const cfg: SeriesConfig = createSeriesConfig({ format: 'ODI', team1Id: 'IND', team2Id: 'AUS', matchCount: 3 }, 'S1');

  it('awards 2 points for a win in limited-overs', () => {
    const table = computeSeriesStandings(cfg, [completedFixture('S1', 'IND', 'AUS', { result: 'WIN', winnerId: 'IND' })]);
    const ind = table.find((t) => t.teamId === 'IND')!;
    const aus = table.find((t) => t.teamId === 'AUS')!;
    expect(ind.points).toBe(2);
    expect(ind.won).toBe(1);
    expect(aus.points).toBe(0);
    expect(aus.lost).toBe(1);
  });

  it('awards 12 / 6 / 4 for Test win / tie / draw', () => {
    const testCfg = createSeriesConfig({ format: 'TEST', team1Id: 'ENG', team2Id: 'AUS', matchCount: 3 }, 'T');
    const win = computeSeriesStandings(testCfg, [completedFixture('T', 'ENG', 'AUS', { result: 'WIN', winnerId: 'ENG' })]);
    expect(win.find((t) => t.teamId === 'ENG')!.points).toBe(12);

    const tie = computeSeriesStandings(testCfg, [completedFixture('T', 'ENG', 'AUS', { result: 'TIE' })]);
    expect(tie.find((t) => t.teamId === 'ENG')!.points).toBe(6);
    expect(tie.find((t) => t.teamId === 'AUS')!.tied).toBe(1);

    const draw = computeSeriesStandings(testCfg, [completedFixture('T', 'ENG', 'AUS', { result: 'DRAW' })]);
    expect(draw.find((t) => t.teamId === 'ENG')!.points).toBe(4);
    expect(draw.find((t) => t.teamId === 'ENG')!.drawn).toBe(1);
    // WTC percentage: 4 / (1 * 12) * 100
    expect(draw.find((t) => t.teamId === 'ENG')!.pct).toBeCloseTo(33.3, 1);
  });

  it('infers results when the scorecard has no explicit result', () => {
    const win = completedFixture('S1', 'IND', 'AUS', { winnerId: 'IND' });
    expect(inferFixtureResult(win)).toEqual({ result: 'WIN', winnerId: 'IND' });
    const tie = completedFixture('S1', 'IND', 'AUS', { winnerId: 'TIE' });
    expect(inferFixtureResult(tie).result).toBe('TIE');
    const draw = completedFixture('S1', 'IND', 'AUS', { winnerId: 'DRAW' });
    expect(inferFixtureResult(draw).result).toBe('DRAW');
  });

  it('accumulates a multi-match series and detects the winner', () => {
    const fixtures: Fixture[] = [
      completedFixture('S1', 'IND', 'AUS', { result: 'WIN', winnerId: 'IND' }),
      completedFixture('S1', 'AUS', 'IND', { result: 'WIN', winnerId: 'AUS' }),
      completedFixture('S1', 'IND', 'AUS', { result: 'WIN', winnerId: 'IND' }),
    ];
    const table = computeSeriesStandings(cfg, fixtures);
    expect(table[0].teamId).toBe('IND');
    expect(table[0].points).toBe(4);
    expect(getSeriesWinner(cfg, fixtures)).toBe('IND');
  });

  it('reports no winner until every fixture is complete', () => {
    const fixtures: Fixture[] = [
      completedFixture('S1', 'IND', 'AUS', { result: 'WIN', winnerId: 'IND' }),
      { id: 'S1_m2', matchNumber: 2, day: 1, team1Id: 'AUS', team2Id: 'IND', status: MatchStatus.UPCOMING, tournamentId: 'S1' },
    ];
    expect(getSeriesWinner(cfg, fixtures)).toBeNull();
  });
});
