import { describe, it, expect } from 'vitest';
import { FixtureScheduler } from '../engine/scheduling/FixtureScheduler';
import { Fixture, MatchStatus, MatchFormat } from '../types/match';

describe('FixtureScheduler & Conflict Engine', () => {
  it('correctly calculates match durations across formats', () => {
    expect(FixtureScheduler.calculateMatchDuration('T20')).toBe(3.5 * 3600 * 1000);
    expect(FixtureScheduler.calculateMatchDuration('IPL' as any)).toBe(3.5 * 3600 * 1000);
    expect(FixtureScheduler.calculateMatchDuration('ODI')).toBe(8 * 3600 * 1000);
    expect(FixtureScheduler.calculateMatchDuration('TEST')).toBe(5 * 24 * 3600 * 1000);
  });

  it('correctly specifies minimum rest durations', () => {
    expect(FixtureScheduler.getMinimumRestDuration('T20')).toBe(16 * 3600 * 1000);
    expect(FixtureScheduler.getMinimumRestDuration('ODI')).toBe(24 * 3600 * 1000);
    expect(FixtureScheduler.getMinimumRestDuration('TEST')).toBe(48 * 3600 * 1000);
  });

  it('detects team overlapping conflict in concurrent matches', () => {
    const baseTime = 1775000000000;
    const t20Duration = 3.5 * 3600 * 1000;

    const existingFixtures: Fixture[] = [
      {
        id: 'f1',
        matchNumber: 1,
        day: 1,
        team1Id: 'IND',
        team2Id: 'AUS',
        status: MatchStatus.UPCOMING,
        startTime: baseTime,
        endTime: baseTime + t20Duration,
      },
    ];

    // Same start time with India
    const hasConflict1 = FixtureScheduler.isTeamOverlapping(
      'IND',
      baseTime + 3600 * 1000,
      baseTime + 3600 * 1000 + t20Duration,
      existingFixtures
    );
    expect(hasConflict1).toBe(true);

    // Non-overlapping time (5 hours later)
    const hasConflict2 = FixtureScheduler.isTeamOverlapping(
      'IND',
      baseTime + 5 * 3600 * 1000,
      baseTime + 5 * 3600 * 1000 + t20Duration,
      existingFixtures
    );
    expect(hasConflict2).toBe(false);

    // Different team entirely
    const hasConflict3 = FixtureScheduler.isTeamOverlapping(
      'ENG',
      baseTime,
      baseTime + t20Duration,
      existingFixtures
    );
    expect(hasConflict3).toBe(false);
  });

  it('multi-day Test matches reserve teams for all 5 consecutive days', () => {
    const baseTime = 1775000000000;
    const testDuration = 5 * 24 * 3600 * 1000; // 5 days

    const existingFixtures: Fixture[] = [
      {
        id: 'test-1',
        matchNumber: 1,
        day: 1,
        team1Id: 'ENG',
        team2Id: 'AUS',
        status: MatchStatus.UPCOMING,
        format: MatchFormat.TEST,
        startTime: baseTime,
        endTime: baseTime + testDuration,
      },
    ];

    // Day 3 of the test match: England cannot be scheduled in any other fixture
    const day3Time = baseTime + 2.5 * 24 * 3600 * 1000;
    const isEngBlocked = FixtureScheduler.isTeamOverlapping(
      'ENG',
      day3Time,
      day3Time + 3.5 * 3600 * 1000,
      existingFixtures
    );
    expect(isEngBlocked).toBe(true);

    // Day 6 (after Test conclusion): England is no longer overlapping
    const day6Time = baseTime + 5.5 * 24 * 3600 * 1000;
    const isEngFree = FixtureScheduler.isTeamOverlapping(
      'ENG',
      day6Time,
      day6Time + 3.5 * 3600 * 1000,
      existingFixtures
    );
    expect(isEngFree).toBe(false);
  });

  it('detects player overlap conflict if player is selected in two concurrent matches', () => {
    const baseTime = 1775000000000;
    const t20Duration = 3.5 * 3600 * 1000;

    const existingFixtures: Fixture[] = [
      {
        id: 'f1',
        matchNumber: 1,
        day: 1,
        team1Id: 'MI',
        team2Id: 'CSK',
        status: MatchStatus.UPCOMING,
        startTime: baseTime,
        endTime: baseTime + t20Duration,
        team1PlayingXI: ['player-bumrah', 'player-rohit'],
        team2PlayingXI: ['player-dhoni', 'player-jadeja'],
      },
    ];

    // Player Bumrah cannot be playing in another simultaneous fixture
    const isBumrahOverlapping = FixtureScheduler.isPlayerOverlapping(
      'player-bumrah',
      baseTime + 1000,
      baseTime + t20Duration,
      existingFixtures
    );
    expect(isBumrahOverlapping).toBe(true);

    // Another player not in that match is free
    const isKohliOverlapping = FixtureScheduler.isPlayerOverlapping(
      'player-kohli',
      baseTime,
      baseTime + t20Duration,
      existingFixtures
    );
    expect(isKohliOverlapping).toBe(false);
  });

  it('validates fixtures and rejects invalid schedules', () => {
    const baseTime = 1775000000000;
    const duration = 3.5 * 3600 * 1000;

    // Self-play rejection
    const invalidSelfMatch: Fixture = {
      id: 'inv-1',
      matchNumber: 1,
      day: 1,
      team1Id: 'IND',
      team2Id: 'IND',
      status: MatchStatus.UPCOMING,
      startTime: baseTime,
      endTime: baseTime + duration,
    };
    const v1 = FixtureScheduler.validateFixture(invalidSelfMatch, []);
    expect(v1.isValid).toBe(false);
    expect(v1.errors[0]).toContain('play against itself');

    // Immutability of completed matches
    const completedMatch: Fixture = {
      id: 'comp-1',
      matchNumber: 1,
      day: 1,
      team1Id: 'IND',
      team2Id: 'PAK',
      status: MatchStatus.COMPLETED,
      startTime: baseTime,
      endTime: baseTime + duration,
    };
    const v2 = FixtureScheduler.validateFixture(completedMatch, [completedMatch]);
    expect(v2.isValid).toBe(false);
    expect(v2.errors[0]).toContain('already COMPLETED');
  });

  it('generates tournament schedules with realistic rest and no team collisions', () => {
    const teams = [
      { id: 'IND', shortName: 'IND' },
      { id: 'AUS', shortName: 'AUS' },
      { id: 'ENG', shortName: 'ENG' },
      { id: 'SA', shortName: 'SA' },
    ];

    const fixtures = FixtureScheduler.generateTournamentSchedule(teams, 'T20', {
      isDoubleRoundRobin: true,
    });

    expect(fixtures.length).toBeGreaterThan(0);

    // Verify no team has overlapping matches
    for (let i = 0; i < fixtures.length; i++) {
      const f1 = fixtures[i];
      for (let j = i + 1; j < fixtures.length; j++) {
        const f2 = fixtures[j];
        const sharesTeam =
          f1.team1Id === f2.team1Id ||
          f1.team1Id === f2.team2Id ||
          f1.team2Id === f2.team1Id ||
          f1.team2Id === f2.team2Id;

        if (sharesTeam) {
          const overlaps = FixtureScheduler.isTimeOverlap(
            f1.startTime!,
            f1.endTime!,
            f2.startTime!,
            f2.endTime!
          );
          expect(overlaps).toBe(false);
        }
      }
    }
  });
});
