import { Fixture, MatchStatus } from '../../types/match';

/**
 * Season / mega-auction progression.
 *
 * The entire schedule is generated up-front. Matches are grouped into
 * "match-days". A fixture may only be played, watched or simulated while its
 * day is the earliest day that still has unresolved fixtures. Fixtures on
 * later days are LOCKED until every fixture on the current day has a result.
 *
 * These helpers are pure and derive everything from the persisted fixture
 * list, so the same progression rules apply after a page refresh (the fixture
 * array is the single source of truth — not transient React state).
 */

export type FixtureUiState = 'COMPLETED' | 'LIVE' | 'PLAYABLE' | 'LOCKED';

export interface FixtureProgress {
  fixtureId: string;
  state: FixtureUiState;
  isUserFixture: boolean;
  /** Human-readable reason shown on locked fixtures. */
  lockedReason?: string;
}

export interface SeasonSummary {
  /** League fixtures (playoffs excluded when a playoff bracket exists). */
  total: number;
  completed: number;
  remaining: number;
  /** Earliest day still containing an unresolved fixture, or null at season end. */
  currentMatchDay: number | null;
}

/** A fixture is resolved once it is completed or abandoned with a locked result. */
export function isFixtureResolved(fixture: Fixture): boolean {
  return (
    fixture.finalized === true ||
    fixture.status === MatchStatus.COMPLETED ||
    fixture.status === MatchStatus.ABANDONED ||
    fixture.fixtureStatus === 'COMPLETED' ||
    fixture.fixtureStatus === 'ABANDONED'
  );
}

/** A fixture counts as live while its detailed lifecycle status is LIVE. */
export function isFixtureLive(fixture: Fixture): boolean {
  return !isFixtureResolved(fixture) && (
    fixture.status === MatchStatus.LIVE || fixture.fixtureStatus === 'LIVE'
  );
}

/** Normalised match-day number; defaults to day 1 for legacy fixtures. */
export function fixtureDay(fixture: Fixture): number {
  return typeof fixture.day === 'number' && fixture.day > 0 ? fixture.day : 1;
}

export function isUserFixture(fixture: Fixture, userId: string | null | undefined): boolean {
  if (!userId) return false;
  return fixture.team1Id === userId || fixture.team2Id === userId;
}

/**
 * The next playable match-day: the smallest day that still has an unresolved
 * fixture. Returns null once the whole season (including playoffs) is done.
 */
export function getCurrentMatchDay(fixtures: Fixture[]): number | null {
  let current: number | null = null;
  for (const fixture of fixtures) {
    if (isFixtureResolved(fixture)) continue;
    const day = fixtureDay(fixture);
    if (current === null || day < current) current = day;
  }
  return current;
}

/** Classifies a fixture for the UI and the store's authority checks. */
export function getFixtureProgress(
  fixture: Fixture,
  fixtures: Fixture[],
  userId: string | null | undefined,
): FixtureProgress {
  const user = isUserFixture(fixture, userId);

  if (isFixtureResolved(fixture)) {
    return { fixtureId: fixture.id, state: 'COMPLETED', isUserFixture: user };
  }
  if (isFixtureLive(fixture)) {
    return { fixtureId: fixture.id, state: 'LIVE', isUserFixture: user };
  }

  const currentDay = getCurrentMatchDay(fixtures);
  const day = fixtureDay(fixture);
  if (currentDay === null || day <= currentDay) {
    return { fixtureId: fixture.id, state: 'PLAYABLE', isUserFixture: user };
  }

  const pending = fixtures.filter((f) => !isFixtureResolved(f) && fixtureDay(f) < day).length;
  return {
    fixtureId: fixture.id,
    state: 'LOCKED',
    isUserFixture: user,
    lockedReason: `Resolve Day ${currentDay} first — ${pending} fixture${pending === 1 ? '' : 's'} pending.`,
  };
}

/**
 * Authoritative gate used by the store before a fixture is allowed to enter
 * its LIVE lifecycle. Rejects finished (replay prevention) and locked
 * (out-of-order) fixtures.
 */
export function canStartFixture(
  fixture: Fixture,
  fixtures: Fixture[],
  userId: string | null | undefined,
): { allowed: boolean; reason?: string } {
  const progress = getFixtureProgress(fixture, fixtures, userId);
  if (progress.state === 'COMPLETED') {
    return { allowed: false, reason: 'This fixture is completed and cannot be replayed.' };
  }
  if (progress.state === 'LOCKED') {
    return { allowed: false, reason: progress.lockedReason };
  }
  return { allowed: true };
}

/** The user's next fixture on the current match-day, if one exists. */
export function getNextUserFixture(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  if (!userId) return null;
  const currentDay = getCurrentMatchDay(fixtures);
  if (currentDay === null) return null;

  const candidates = fixtures
    .filter(
      (f) =>
        !isFixtureResolved(f) &&
        isUserFixture(f, userId) &&
        (isFixtureLive(f) || fixtureDay(f) === currentDay),
    )
    .sort((a, b) => a.matchNumber - b.matchNumber);

  return candidates[0] ?? null;
}

/**
 * The next unresolved AI-vs-AI fixture on the current match-day. Used by the
 * "Continue Season" action to advance the day without the user's matches.
 */
export function getNextAiFixture(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  const currentDay = getCurrentMatchDay(fixtures);
  if (currentDay === null) return null;

  const candidates = fixtures
    .filter(
      (f) =>
        !isFixtureResolved(f) &&
        !isUserFixture(f, userId) &&
        (isFixtureLive(f) || fixtureDay(f) === currentDay),
    )
    .sort((a, b) => a.matchNumber - b.matchNumber);

  return candidates[0] ?? null;
}

/** Aggregate progress for a progress bar / "Continue Season" affordance. */
export function getSeasonSummary(fixtures: Fixture[]): SeasonSummary {
  const league = fixtures.filter((f) => !f.isPlayoff);
  const scoped = league.length > 0 ? league : fixtures;
  const completed = scoped.filter(isFixtureResolved).length;
  const total = scoped.length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    currentMatchDay: getCurrentMatchDay(fixtures),
  };
}
