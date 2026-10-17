import {
  Fixture,
  InningsData,
  MatchFormat,
  MatchResultType,
  MatchStatus,
  SeriesConfig,
  SeriesStanding,
} from '../../types/match';
import { FixtureScheduler } from '../scheduling/FixtureScheduler';

// ═══════════════════════════════════════════════════════════════════════════════
//  SERIES ENGINE — bilateral (two-team) series configuration, scheduling and
//  points table. A "series" is the international-format competition shape
//  (e.g. a 3-match ODI series or a 5-match Test series), as opposed to the
//  franchise round-robin league used by the IPL.
// ═══════════════════════════════════════════════════════════════════════════════

const DAY_MS = 24 * 60 * 60 * 1000;
/** Gap between the *start days* of consecutive matches in the series. */
const SERIES_GAP_DAYS: Record<string, number> = {
  T20: 3,
  ODI: 3,
  TEST: 8, // 5 days of play + 3 rest days
};

export const MIN_SERIES_MATCHES = 1;
export const MAX_SERIES_MATCHES = 7;

export interface SeriesPoints {
  win: number;
  tie: number;
  draw: number;
  loss: number;
  noResult: number;
}

/** Points awarded per result for a given format (WTC scheme for Tests). */
export function getSeriesPoints(format: SeriesConfig['format']): SeriesPoints {
  if (format === 'TEST') {
    return { win: 12, tie: 6, draw: 4, loss: 0, noResult: 0 };
  }
  return { win: 2, tie: 1, draw: 1, loss: 0, noResult: 1 };
}

/** Maximum points a single match can award — the denominator of the WTC %. */
export function getSeriesMaxPoints(format: SeriesConfig['format']): number {
  return getSeriesPoints(format).win;
}

export interface SeriesConfigInput {
  name?: string;
  format: SeriesConfig['format'];
  team1Id: string;
  team2Id: string;
  matchCount: number;
}

/**
 * Normalises and validates a series configuration. Throws on invalid input so
 * the UI can surface a clear message.
 */
export function createSeriesConfig(input: SeriesConfigInput, id?: string): SeriesConfig {
  if (input.team1Id === input.team2Id) {
    throw new Error('A series needs two different teams.');
  }
  if (!Number.isInteger(input.matchCount) || input.matchCount < MIN_SERIES_MATCHES || input.matchCount > MAX_SERIES_MATCHES) {
    throw new Error(`Series length must be between ${MIN_SERIES_MATCHES} and ${MAX_SERIES_MATCHES} matches.`);
  }
  const seriesId = id ?? `series_${input.team1Id}_${input.team2Id}_${Date.now()}`;
  return {
    id: seriesId,
    name: input.name?.trim() || `${input.format} Series`,
    format: input.format,
    team1Id: input.team1Id,
    team2Id: input.team2Id,
    matchCount: input.matchCount,
    createdAt: Date.now(),
  };
}

function toMatchFormat(format: SeriesConfig['format']): MatchFormat {
  switch (format) {
    case 'TEST':
      return MatchFormat.TEST;
    case 'ODI':
      return MatchFormat.ODI;
    default:
      return MatchFormat.T20;
  }
}

/**
 * Builds the fixtures for a bilateral series. Home advantage alternates, and
 * Test matches are spaced to allow the 5-day duration plus rest days.
 */
export function generateSeriesFixtures(config: SeriesConfig, startTime: number = Date.now()): Fixture[] {
  const fixtures: Fixture[] = [];
  const gapDays = SERIES_GAP_DAYS[config.format] ?? 3;
  const duration = FixtureScheduler.calculateMatchDuration(config.format);

  for (let i = 0; i < config.matchCount; i += 1) {
    // Alternate home ground: match 1 & 3 → team1 hosts, 2 & 4 → team2 hosts.
    const homeFirst = i % 2 === 0;
    const team1Id = homeFirst ? config.team1Id : config.team2Id;
    const team2Id = homeFirst ? config.team2Id : config.team1Id;
    const start = startTime + i * gapDays * DAY_MS;

    fixtures.push({
      id: `${config.id}_m${i + 1}`,
      matchNumber: i + 1,
      day: i * gapDays + 1,
      team1Id,
      team2Id,
      status: MatchStatus.UPCOMING,
      fixtureStatus: 'SCHEDULED',
      format: toMatchFormat(config.format),
      startTime: start,
      endTime: start + duration,
      tournamentId: config.id,
    });
  }

  return fixtures;
}

/**
 * Infers the result of a completed fixture from its scorecard. Prefers the
 * explicit `result` field, falls back to the `winnerId` convention used by the
 * store ('TIE' / absent ⇒ tie or draw).
 */
export function inferFixtureResult(fixture: Fixture): { result: MatchResultType; winnerId?: string } {
  const scorecard = fixture.scorecard;
  if (!scorecard) return { result: 'NO_RESULT' };
  if (scorecard.result) return { result: scorecard.result, winnerId: scorecard.winnerId };
  if (scorecard.winnerId && scorecard.winnerId === 'TIE') return { result: 'TIE' };
  if (scorecard.winnerId && scorecard.winnerId !== 'DRAW') return { result: 'WIN', winnerId: scorecard.winnerId };
  if (scorecard.winnerId === 'DRAW' || !scorecard.winnerId) return { result: 'DRAW' };
  return { result: 'NO_RESULT' };
}

function oversOf(innings: InningsData | undefined): number {
  if (!innings) return 0;
  return innings.overs + innings.balls / 6;
}

/**
 * Builds the bilateral series points table from the fixtures played so far.
 * Returns two rows (one per team) sorted by points, then percentage, then NRR.
 */
export function computeSeriesStandings(config: SeriesConfig, fixtures: Fixture[]): SeriesStanding[] {
  const points = getSeriesPoints(config.format);
  const maxPoints = getSeriesMaxPoints(config.format);

  const rows: Record<string, SeriesStanding> = {};
  const blank = (teamId: string): SeriesStanding => ({
    teamId,
    played: 0,
    won: 0,
    lost: 0,
    drawn: 0,
    tied: 0,
    points: 0,
    pct: 0,
    nrr: 0,
    runsScored: 0,
    oversFaced: 0,
    runsConceded: 0,
    oversBowled: 0,
    form: [],
  });
  rows[config.team1Id] = blank(config.team1Id);
  rows[config.team2Id] = blank(config.team2Id);

  const seriesFixtures = fixtures.filter(
    (f) => f.tournamentId === config.id && f.status === MatchStatus.COMPLETED,
  );

  seriesFixtures.forEach((fixture) => {
    const { result, winnerId } = inferFixtureResult(fixture);
    if (result === 'NO_RESULT') return;

    const team1 = rows[fixture.team1Id];
    const team2 = rows[fixture.team2Id];
    if (!team1 || !team2) return;

    const innings: InningsData[] = fixture.scorecard?.innings ?? [];
    const t1Runs = innings
      .filter((i) => i.battingTeamId === fixture.team1Id)
      .reduce((s, i) => s + i.runs, 0);
    const t2Runs = innings
      .filter((i) => i.battingTeamId === fixture.team2Id)
      .reduce((s, i) => s + i.runs, 0);
    const t1Overs = innings.filter((i) => i.battingTeamId === fixture.team1Id).reduce((s, i) => s + oversOf(i), 0);
    const t2Overs = innings.filter((i) => i.battingTeamId === fixture.team2Id).reduce((s, i) => s + oversOf(i), 0);

    team1.played += 1;
    team2.played += 1;
    team1.runsScored += t1Runs;
    team1.oversFaced += t1Overs;
    team1.runsConceded += t2Runs;
    team1.oversBowled += t2Overs;
    team2.runsScored += t2Runs;
    team2.oversFaced += t2Overs;
    team2.runsConceded += t1Runs;
    team2.oversBowled += t1Overs;

    if (result === 'WIN' && winnerId) {
      const winner = rows[winnerId];
      const loser = winnerId === fixture.team1Id ? team2 : team1;
      winner.won += 1;
      winner.points += points.win;
      winner.form.push('W');
      loser.lost += 1;
      loser.points += points.loss;
      loser.form.push('L');
    } else if (result === 'TIE') {
      [team1, team2].forEach((t) => {
        t.tied += 1;
        t.points += points.tie;
        t.form.push('T');
      });
    } else {
      // DRAW or NO_RESULT
      [team1, team2].forEach((t) => {
        t.drawn += 1;
        t.points += points.draw;
        t.form.push('D');
      });
    }
  });

  return Object.values(rows)
    .map((row) => {
      const nrr = row.oversFaced > 0 && row.oversBowled > 0
        ? Math.round((row.runsScored / row.oversFaced - row.runsConceded / row.oversBowled) * 1000) / 1000
        : 0;
      const pct = row.played > 0 ? Math.round((row.points / (row.played * maxPoints)) * 1000) / 10 : 0;
      return { ...row, nrr, pct, form: row.form.slice(-5) };
    })
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.pct !== a.pct) return b.pct - a.pct;
      return b.nrr - a.nrr;
    });
}

/** The series leader after the fixtures played so far, or null if unbeaten/empty. */
export function getSeriesWinner(config: SeriesConfig, fixtures: Fixture[]): string | null {
  const table = computeSeriesStandings(config, fixtures);
  const totalMatches = fixtures.filter((f) => f.tournamentId === config.id && f.status === MatchStatus.COMPLETED).length;
  if (totalMatches < config.matchCount) return null;
  if (table[0].points === table[1].points) return null;
  return table[0].teamId;
}
