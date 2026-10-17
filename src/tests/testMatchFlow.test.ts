import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TEST_RULES,
  TestInningsSummary,
  canDeclareNow,
  determineTestResult,
  evaluateFollowOn,
  getBattingOrder,
  getFourthInningsTarget,
  getNextInningsTeam,
  getTestDaySession,
  inningsNumberFor,
  isDayLimitReached,
  teamAggregate,
} from '../engine/formats/test/testMatchFlow';

function inn(
  battingTeamId: string,
  bowlingTeamId: string,
  runs: number,
  wickets: number,
  opts: Partial<TestInningsSummary> = {},
): TestInningsSummary {
  return { battingTeamId, bowlingTeamId, runs, wickets, isComplete: true, ...opts };
}

describe('TestMatchFlow — batting order & innings sequencing', () => {
  it('aggregates runs across a team innings', () => {
    const innings = [inn('A', 'B', 300, 10), inn('B', 'A', 200, 10), inn('A', 'B', 150, 5, { isComplete: false })];
    expect(teamAggregate(innings, 'A')).toBe(450);
    expect(teamAggregate(innings, 'B')).toBe(200);
  });

  it('uses a straight order without a follow-on and a swapped order with one', () => {
    expect(getBattingOrder('A', 'B', false)).toEqual(['A', 'B', 'A', 'B']);
    expect(getBattingOrder('A', 'B', true)).toEqual(['A', 'B', 'B', 'A']);
  });

  it('reports the next innings team for each of the four innings', () => {
    expect(getNextInningsTeam([], false, 'A', 'B')!.battingTeamId).toBe('A');
    expect(getNextInningsTeam([inn('A', 'B', 300, 10)], false, 'A', 'B')!.battingTeamId).toBe('B');
    expect(getNextInningsTeam([inn('A', 'B', 300, 10), inn('B', 'A', 200, 10)], false, 'A', 'B')!.battingTeamId).toBe('A');
    const onFollowOn = getNextInningsTeam([inn('A', 'B', 300, 10), inn('B', 'A', 90, 10)], true, 'A', 'B')!;
    expect(onFollowOn.battingTeamId).toBe('B');
    expect(onFollowOn.isFollowOn).toBe(true);
    expect(getNextInningsTeam([inn('A', 'B', 1, 10), inn('B', 'A', 1, 10), inn('A', 'B', 1, 10), inn('B', 'A', 1, 10)], false, 'A', 'B')).toBeNull();
  });

  it('maps innings-started count to innings number', () => {
    expect(inningsNumberFor(0)).toBe(1);
    expect(inningsNumberFor(2)).toBe(3);
    expect(inningsNumberFor(9)).toBe(4);
  });
});

describe('TestMatchFlow — follow-on', () => {
  it('is unavailable until both first innings are complete', () => {
    expect(evaluateFollowOn([inn('A', 'B', 400, 10)])).toBeNull();
  });

  it('is available when the trailing side is bowled out 200+ behind', () => {
    const status = evaluateFollowOn([inn('A', 'B', 500, 10), inn('B', 'A', 280, 10)])!;
    expect(status.leadingTeamId).toBe('A');
    expect(status.trailingTeamId).toBe('B');
    expect(status.lead).toBe(220);
    expect(status.available).toBe(true);
  });

  it('is not available when the lead is under the threshold or the side is not all out', () => {
    expect(evaluateFollowOn([inn('A', 'B', 400, 10), inn('B', 'A', 250, 10)])!.available).toBe(false);
    expect(evaluateFollowOn([inn('A', 'B', 600, 10), inn('B', 'A', 300, 8)])!.available).toBe(false);
  });
});

describe('TestMatchFlow — result determination', () => {
  it('is in progress until both first innings are done', () => {
    expect(determineTestResult([inn('A', 'B', 300, 10)], 'A', 'B').result).toBe('IN_PROGRESS');
  });

  it('awards an innings victory when the side batting twice is bowled out behind', () => {
    const innings = [inn('A', 'B', 500, 10), inn('B', 'A', 200, 10)];
    // Third innings is B (follow-on) bowled out for 250 — still 50 behind.
    innings.push(inn('B', 'A', 250, 10, { isFollowOn: true }));
    const res = determineTestResult(innings, 'A', 'B');
    expect(res.result).toBe('WIN');
    expect(res.winnerId).toBe('A');
    expect(res.margin).toBe('an innings and 50 runs');
  });

  it('awards a wickets victory when the 4th-innings side chases the target', () => {
    const res = determineTestResult(
      [inn('A', 'B', 300, 10), inn('B', 'A', 250, 10), inn('A', 'B', 200, 5), inn('B', 'A', 251, 6)],
      'A',
      'B',
    );
    expect(res.result).toBe('WIN');
    expect(res.winnerId).toBe('B');
    expect(res.margin).toBe('4 wickets');
  });

  it('awards a runs victory when the 4th-innings side falls short', () => {
    const res = determineTestResult(
      [inn('A', 'B', 300, 10), inn('B', 'A', 250, 10), inn('A', 'B', 200, 10), inn('B', 'A', 200, 10)],
      'A',
      'B',
    );
    expect(res.winnerId).toBe('A');
    expect(res.margin).toBe('50 runs');
  });

  it('scores a tie when the aggregates are level after the 4th innings', () => {
    const res = determineTestResult(
      [inn('A', 'B', 300, 10), inn('B', 'A', 300, 10), inn('A', 'B', 200, 10), inn('B', 'A', 200, 10)],
      'A',
      'B',
    );
    expect(res.result).toBe('TIE');
  });

  it('computes the 4th-innings target as the opponent aggregate', () => {
    // A: 300 + 200 = 500, B: 250. B must reach 501 (i.e. 251 more) to win.
    expect(getFourthInningsTarget([inn('A', 'B', 300, 10), inn('B', 'A', 250, 10), inn('A', 'B', 200, 10)])).toBe(500);
    expect(getFourthInningsTarget([inn('A', 'B', 300, 10)])).toBeNull();
  });
});

describe('TestMatchFlow — day/session clock', () => {
  it('splits a 90-over day into three sessions', () => {
    expect(getTestDaySession(0)).toEqual({ day: 1, session: 'Morning' });
    expect(getTestDaySession(180)).toEqual({ day: 1, session: 'Afternoon' });
    expect(getTestDaySession(360)).toEqual({ day: 1, session: 'Evening' });
    expect(getTestDaySession(400)).toEqual({ day: 1, session: 'Evening' });
  });

  it('advances the day across the 90-over boundary and caps at max days', () => {
    expect(getTestDaySession(540)).toEqual({ day: 2, session: 'Morning' });
    expect(getTestDaySession(540 * 4)).toEqual({ day: 5, session: 'Morning' });
    expect(getTestDaySession(540 * 99).day).toBe(DEFAULT_TEST_RULES.maxDays);
  });

  it('detects when the day limit is exhausted', () => {
    expect(isDayLimitReached(540 * 5 - 1)).toBe(false);
    expect(isDayLimitReached(540 * 5)).toBe(true);
    expect(isDayLimitReached(540 * 7)).toBe(true);
  });
});

describe('TestMatchFlow — declarations', () => {
  it('allows a declaration once the batting side leads on aggregate', () => {
    const all = [inn('A', 'B', 300, 10), inn('B', 'A', 200, 10, { isComplete: false })];
    const current = all[1];
    // B trails 100, cannot declare.
    expect(canDeclareNow(current, all)).toBe(false);
    current.runs = 350; // B now leads by 50
    expect(canDeclareNow(current, all)).toBe(true);
  });

  it('never allows a declaration in a completed innings', () => {
    const current = inn('A', 'B', 500, 7, { isComplete: true });
    expect(canDeclareNow(current, [current])).toBe(false);
  });
});
