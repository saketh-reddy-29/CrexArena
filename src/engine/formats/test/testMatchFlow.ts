import { MatchResultType, TestDaySession } from '../../../types/match';

// ═══════════════════════════════════════════════════════════════════════════════
//  TEST MATCH FLOW — the meta-controller for a 4-innings Test match.
//
//  This module owns everything that sits *above* a single innings: the batting
//  order across 4 innings, the follow-on decision, declarations, the 4th-innings
//  target, the day/session clock, and how the match finishes (win / draw / tie).
//  It is deliberately pure so the interactive match loop stays thin and these
//  rules can be exhaustively unit-tested.
// ═══════════════════════════════════════════════════════════════════════════════

export interface TestInningsSummary {
  battingTeamId: string;
  bowlingTeamId: string;
  runs: number;
  wickets: number;
  /** Legal balls bowled in the innings (used only for the day clock). */
  balls?: number;
  /** True when the innings was closed by declaration rather than being all out. */
  declared?: boolean;
  /** True when this innings was played because of an enforced follow-on. */
  isFollowOn?: boolean;
  /** True when the innings is fully closed (all out, declared or target reached). */
  isComplete: boolean;
}

export interface TestMatchRules {
  maxDays: number;
  /** Minimum lead after the first innings required to enforce the follow-on. */
  followOnLeadRequirement: number;
  declarationAllowed: boolean;
  oversPerDay: number;
  sessionsPerDay: number;
  /** For the final innings of the day a slightly lower minimum may apply. */
  minOversPerDay: number;
  minOversLastDay: number;
}

export const DEFAULT_TEST_RULES: TestMatchRules = {
  maxDays: 5,
  followOnLeadRequirement: 200,
  declarationAllowed: true,
  oversPerDay: 90,
  sessionsPerDay: 3,
  minOversPerDay: 90,
  minOversLastDay: 75,
};

const MAX_INNINGS = 4;
const MAX_WICKETS = 10;

/** Total runs a team has scored across the innings it has batted. */
export function teamAggregate(innings: TestInningsSummary[], teamId: string): number {
  return innings
    .filter((inn) => inn.battingTeamId === teamId)
    .reduce((sum, inn) => sum + inn.runs, 0);
}

/**
 * The natural batting order of a 4-innings Test, given who batted first.
 * `[A, B, A, B]` normally; `[A, B, B, A]` once the follow-on is enforced.
 */
export function getBattingOrder(firstBattingTeamId: string, secondTeamId: string, followOn: boolean): string[] {
  const a = firstBattingTeamId;
  const b = secondTeamId;
  return followOn ? [a, b, b, a] : [a, b, a, b];
}

/**
 * Which innings the match is on (1-4) for the number of innings already begun.
 */
export function inningsNumberFor(inningsStarted: number): number {
  return Math.min(MAX_INNINGS, inningsStarted + 1);
}

export interface FollowOnStatus {
  /** The team that leads after both first innings. */
  leadingTeamId: string;
  trailingTeamId: string;
  /** Lead of the leading team after both first innings (may be negative). */
  lead: number;
  /** True when the trailing side was bowled out and trails by the requirement. */
  available: boolean;
}

/**
 * Evaluates the follow-on after both teams have completed their first innings
 * (i.e. after innings 2). The trailing side must have been bowled out.
 */
export function evaluateFollowOn(
  innings: TestInningsSummary[],
  rules: TestMatchRules = DEFAULT_TEST_RULES,
): FollowOnStatus | null {
  if (innings.length < 2 || !innings[0].isComplete || !innings[1].isComplete) return null;

  const firstBattingTeamId = innings[0].battingTeamId;
  const secondTeamId = innings[1].battingTeamId;
  const firstTotal = innings[0].runs;
  const secondTotal = innings[1].runs;

  const leadingTeamId = firstTotal >= secondTotal ? firstBattingTeamId : secondTeamId;
  const trailingTeamId = leadingTeamId === firstBattingTeamId ? secondTeamId : firstBattingTeamId;
  const lead = Math.abs(firstTotal - secondTotal);

  const trailingInnings = innings.find((inn) => inn.battingTeamId === trailingTeamId)!;
  const allOut = trailingInnings.wickets >= MAX_WICKETS;

  return {
    leadingTeamId,
    trailingTeamId,
    lead,
    available: allOut && lead >= rules.followOnLeadRequirement,
  };
}

/**
 * The batting team of the next innings, accounting for an enforced follow-on.
 * Returns `null` when the match has reached 4 innings.
 */
export function getNextInningsTeam(
  innings: TestInningsSummary[],
  followOnEnforced: boolean,
  team1Id: string,
  team2Id: string,
): { inningsNumber: number; battingTeamId: string; bowlingTeamId: string; isFollowOn: boolean } | null {
  if (innings.length >= MAX_INNINGS) return null;

  const firstBattingTeamId = innings.length > 0 ? innings[0].battingTeamId : team1Id;
  const secondTeamId = firstBattingTeamId === team1Id ? team2Id : team1Id;
  const order = getBattingOrder(firstBattingTeamId, secondTeamId, followOnEnforced);

  const inningsNumber = innings.length + 1;
  const battingTeamId = order[inningsNumber - 1];
  const bowlingTeamId = battingTeamId === team1Id ? team2Id : team1Id;
  const isFollowOn = inningsNumber === 3 && followOnEnforced;

  return { inningsNumber, battingTeamId, bowlingTeamId, isFollowOn };
}

export interface TestResultDecision {
  result: MatchResultType | 'IN_PROGRESS';
  winnerId?: string;
  /** Human-readable margin, e.g. "an innings and 45 runs" or "3 wickets". */
  margin?: string;
}

/**
 * The target a 4th-innings side must reach on top of its first-innings total.
 * `target` is the aggregate to beat (so the side needs `target - ownAggregate + 1`).
 */
export function getFourthInningsTarget(innings: TestInningsSummary[]): number | null {
  if (innings.length < 3) return null;
  const first = innings[0];
  const second = innings[1];
  const third = innings[2];
  const battingFourth = innings[3]?.battingTeamId ?? (third.battingTeamId === first.battingTeamId ? second.battingTeamId : first.battingTeamId);
  const opponent = battingFourth === first.battingTeamId ? second.battingTeamId : first.battingTeamId;
  return teamAggregate(innings, opponent);
}

/**
 * Determines the result of a Test match from the innings played so far.
 *
 * Handles: innings victory, runs victory, wickets victory and tie. The caller
 * is responsible for declaring a DRAW when the day limit is exhausted before a
 * result is reached (see `isDayLimitReached`).
 */
export function determineTestResult(
  innings: TestInningsSummary[],
  team1Id: string,
  team2Id: string,
): TestResultDecision {
  const completed = innings.filter((inn) => inn.isComplete);

  // Need at least the first innings of each side to have a result.
  if (completed.length < 2) return { result: 'IN_PROGRESS' };

  const first = innings[0];
  const second = innings[1];
  const firstTeamId = first.battingTeamId;
  const secondTeamId = second.battingTeamId;

  // ── Innings victory: the side batting a second time fails to pass the
  //    opponent's total after being bowled out. ─────────────────────────────
  const third = innings[2];
  if (third && third.isComplete && third.wickets >= MAX_WICKETS && !third.declared) {
    const thirdTeamAgg = teamAggregate(innings.slice(0, 3), third.battingTeamId);
    const opponentId = third.battingTeamId === firstTeamId ? secondTeamId : firstTeamId;
    const opponentAgg = teamAggregate(innings.slice(0, 3), opponentId);
    if (thirdTeamAgg <= opponentAgg) {
      const margin = opponentAgg - thirdTeamAgg;
      return {
        result: 'WIN',
        winnerId: opponentId,
        margin: margin === 0 ? 'an innings' : `an innings and ${margin} run${margin === 1 ? '' : 's'}`,
      };
    }
  }

  // ── 4th innings: a normal chase or defence. ──────────────────────────────
  const fourth = innings[3];
  if (fourth && fourth.isComplete) {
    const battingTeamId = fourth.battingTeamId;
    const bowlingTeamId = battingTeamId === firstTeamId ? secondTeamId : firstTeamId;
    const batAgg = teamAggregate(innings, battingTeamId);
    const bowlAgg = teamAggregate(innings, bowlingTeamId);

    if (batAgg > bowlAgg) {
      const wicketsInHand = MAX_WICKETS - fourth.wickets;
      return {
        result: 'WIN',
        winnerId: battingTeamId,
        margin: `${wicketsInHand} wicket${wicketsInHand === 1 ? '' : 's'}`,
      };
    }
    if (batAgg === bowlAgg) {
      return { result: 'TIE', margin: 'Match tied' };
    }
    const runs = bowlAgg - batAgg;
    return {
      result: 'WIN',
      winnerId: bowlingTeamId,
      margin: `${runs} run${runs === 1 ? '' : 's'}`,
    };
  }

  void team1Id;
  void team2Id;
  return { result: 'IN_PROGRESS' };
}

// ─── Day / session clock ─────────────────────────────────────────────────────

const ballsPerDay = (rules: TestMatchRules) => rules.oversPerDay * 6;

/**
 * Derives the current day/session from the total legal balls bowled in the
 * match so far. Day is 1-indexed and capped at `maxDays`.
 */
export function getTestDaySession(
  totalLegalBalls: number,
  rules: TestMatchRules = DEFAULT_TEST_RULES,
): TestDaySession {
  const perDay = ballsPerDay(rules);
  const balls = Math.max(0, Math.floor(totalLegalBalls));
  const rawDay = Math.floor(balls / perDay) + 1;
  const day = Math.min(rawDay, rules.maxDays);
  const withinDay = balls % perDay;
  const sessionLength = perDay / rules.sessionsPerDay;

  const session: TestDaySession['session'] =
    withinDay < sessionLength ? 'Morning' : withinDay < sessionLength * 2 ? 'Afternoon' : 'Evening';

  return { day, session };
}

/**
 * True once the scheduled days have been exhausted (i.e. the next ball would be
 * bowled on a day beyond `maxDays`).
 */
export function isDayLimitReached(
  totalLegalBalls: number,
  rules: TestMatchRules = DEFAULT_TEST_RULES,
): boolean {
  return Math.floor(Math.max(0, totalLegalBalls) / ballsPerDay(rules)) + 1 > rules.maxDays;
}

/**
 * Whether the batting captain is allowed to declare right now (Test only, and
 * only with a lead already banked).
 */
export function canDeclareNow(
  currentInnings: TestInningsSummary,
  allInnings: TestInningsSummary[],
  rules: TestMatchRules = DEFAULT_TEST_RULES,
): boolean {
  if (!rules.declarationAllowed) return false;
  if (currentInnings.isComplete) return false;
  // A declaration is only meaningful once the batting side has a lead: either
  // it is the 3rd innings, or the side already leads on aggregate.
  const battingTeamId = currentInnings.battingTeamId;
  const opponent = allInnings.find((inn) => inn.battingTeamId !== battingTeamId && inn.isComplete);
  if (!opponent) return false;
  const ownAgg = teamAggregate(allInnings, battingTeamId);
  const oppAgg = teamAggregate(allInnings, opponent.battingTeamId);
  return ownAgg > oppAgg;
}
