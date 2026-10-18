import { Fixture, MatchScorecard } from '../../types/match';
import {
  canStartFixture,
  fixtureDay,
  getNextAiFixture,
  getNextUserFixture,
  getSeasonSummary,
  isFixtureLive,
  isFixtureResolved,
  isUserFixture,
  type SeasonSummary,
} from './seasonProgression';

/**
 * Fixture service layer.
 *
 * `seasonProgression` answers "is this fixture eligible?"; this module turns
 * those primitives into explicit, structured action results so the UI can
 * explain *why* an action was refused instead of silently doing nothing.
 *
 * Everything here is pure: it validates against the persisted fixture array
 * (the single source of truth) and never mutates state. The store remains the
 * authoritative executor — these checks mirror, and are and-ed with, the
 * store's own gates so a caller can never bypass them.
 */

export type FixtureActionErrorCode =
  | 'NOT_FOUND'
  | 'COMPLETED'
  | 'LOCKED'
  | 'USER_FIXTURE'
  | 'AI_FIXTURE'
  | 'ACTIVE_MATCH'
  | 'NOT_LIVE'
  | 'NOT_COMPLETED';

export interface FixtureActionError {
  code: FixtureActionErrorCode;
  message: string;
}

export interface FixtureActionResult {
  ok: boolean;
  fixture?: Fixture;
  error?: FixtureActionError;
}

export interface ScorecardResult {
  ok: boolean;
  fixture?: Fixture;
  scorecard?: MatchScorecard;
  error?: FixtureActionError;
}

function refuse(code: FixtureActionErrorCode, message: string): FixtureActionResult {
  return { ok: false, error: { code, message } };
}

/** The complete, ordered fixture list for the competition/season. */
export function getSeasonFixtures(fixtures: Fixture[]): Fixture[] {
  return [...fixtures].sort((a, b) => fixtureDay(a) - fixtureDay(b) || a.matchNumber - b.matchNumber);
}

export function getSeasonProgress(fixtures: Fixture[]): SeasonSummary {
  return getSeasonSummary(fixtures);
}

/** The next unresolved fixture involving the user's team, regardless of day. */
export function getNextScheduledUserFixture(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  if (!userId) return null;
  const candidates = fixtures
    .filter((f) => !isFixtureResolved(f) && isUserFixture(f, userId))
    .sort((a, b) => fixtureDay(a) - fixtureDay(b) || a.matchNumber - b.matchNumber);
  return candidates[0] ?? null;
}

/** The user's next fixture that can actually be started right now. */
export function getNextEligibleUserFixture(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  return getNextUserFixture(fixtures, userId);
}

/** The next unresolved AI-vs-AI fixture on the current match-day. */
export function getNextScheduledAiFixture(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  return getNextAiFixture(fixtures, userId);
}

/** A user fixture already in progress (only one may be live at a time). */
export function findActiveUserMatch(
  fixtures: Fixture[],
  userId: string | null | undefined,
): Fixture | null {
  if (!userId) return null;
  return fixtures.find((f) => isUserFixture(f, userId) && isFixtureLive(f)) ?? null;
}

/** Validates that the user may play (or resume) one of their own fixtures. */
export function validatePlayUserFixture(
  fixtureId: string,
  fixtures: Fixture[],
  userId: string | null | undefined,
): FixtureActionResult {
  const fixture = fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return refuse('NOT_FOUND', 'That fixture no longer exists.');

  if (userId && !isUserFixture(fixture, userId)) {
    return refuse('AI_FIXTURE', 'This match does not involve your team — watch or simulate it instead.');
  }
  if (isFixtureResolved(fixture)) {
    return refuse('COMPLETED', 'This match is already completed and cannot be replayed.');
  }

  const gate = canStartFixture(fixture, fixtures, userId);
  if (!gate.allowed) return refuse('LOCKED', gate.reason || 'This match is not available yet.');

  const active = findActiveUserMatch(fixtures, userId);
  if (active && active.id !== fixture.id) {
    return refuse('ACTIVE_MATCH', 'Finish your match in progress before starting another.');
  }

  return { ok: true, fixture };
}

/** Validates that an AI-vs-AI fixture can be watched ball-by-ball. */
export function validateWatchAiFixture(
  fixtureId: string,
  fixtures: Fixture[],
  userId: string | null | undefined,
): FixtureActionResult {
  const fixture = fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return refuse('NOT_FOUND', 'That fixture no longer exists.');

  if (isUserFixture(fixture, userId)) {
    return refuse('USER_FIXTURE', 'Play your own matches from the Play button.');
  }
  if (isFixtureResolved(fixture)) {
    return refuse('COMPLETED', 'This match is already completed — open the scorecard instead.');
  }

  const gate = canStartFixture(fixture, fixtures, userId);
  if (!gate.allowed) return refuse('LOCKED', gate.reason || 'This match is not available yet.');

  return { ok: true, fixture };
}

/** Validates that an AI-vs-AI fixture can be simulated instantly. */
export function validateSimulateAiFixture(
  fixtureId: string,
  fixtures: Fixture[],
  userId: string | null | undefined,
): FixtureActionResult {
  const result = validateWatchAiFixture(fixtureId, fixtures, userId);
  if (!result.ok) return result;

  if (isFixtureLive(result.fixture)) {
    return refuse('NOT_LIVE', 'This match is already in progress — resume it to finish.');
  }
  return result;
}

/** Returns the stored scorecard for a resolved fixture (never re-simulates). */
export function getCompletedScorecard(
  fixtureId: string,
  fixtures: Fixture[],
): ScorecardResult {
  const fixture = fixtures.find((f) => f.id === fixtureId);
  if (!fixture) return refuse('NOT_FOUND', 'That fixture no longer exists.');
  if (!isFixtureResolved(fixture) || !fixture.scorecard) {
    return refuse('NOT_COMPLETED', 'This match has no result yet.');
  }
  return { ok: true, fixture, scorecard: fixture.scorecard };
}
