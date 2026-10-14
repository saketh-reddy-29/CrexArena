import { Fixture, MatchStatus, MatchFormat, FixtureStatus } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';

export interface ScheduleOptions {
  startDate?: number;
  tournamentId?: string;
  isDoubleRoundRobin?: boolean;
  customVenues?: string[];
  enforceRestDays?: boolean;
}

export const IPL_VENUES: Record<string, string> = {
  MI: 'Wankhede Stadium, Mumbai',
  CSK: 'MA Chidambaram Stadium, Chennai',
  RCB: 'M. Chinnaswamy Stadium, Bengaluru',
  KKR: 'Eden Gardens, Kolkata',
  GT: 'Narendra Modi Stadium, Ahmedabad',
  RR: 'Sawai Mansingh Stadium, Jaipur',
  DC: 'Arun Jaitley Stadium, Delhi',
  LSG: 'BRSABV Ekana Cricket Stadium, Lucknow',
  SRH: 'Rajiv Gandhi International Cricket Stadium, Hyderabad',
  PBKS: 'PCA Stadium, Mohali',
};

export const INTL_VENUES: Record<string, string> = {
  IND: 'Eden Gardens, Kolkata',
  AUS: 'Melbourne Cricket Ground, Melbourne',
  ENG: "Lord's, London",
  SA: 'SuperSport Park, Centurion',
  NZ: 'Basin Reserve, Wellington',
  PAK: 'Gaddafi Stadium, Lahore',
  SL: 'R. Premadasa Stadium, Colombo',
  WI: 'Kensington Oval, Barbados',
  BAN: 'Sher-e-Bangla National Cricket Stadium, Dhaka',
  AFG: 'Dubai International Cricket Stadium, Dubai',
};

export const NEUTRAL_VENUES = [
  'Wankhede Stadium, Mumbai',
  'Eden Gardens, Kolkata',
  "Lord's, London",
  'Melbourne Cricket Ground, Melbourne',
  'Dubai International Cricket Stadium, Dubai',
  'The Oval, London',
  'Sydney Cricket Ground, Sydney',
  'Newlands, Cape Town',
];

export class FixtureScheduler {
  public static readonly T20_DURATION_MS = 3.5 * 60 * 60 * 1000; // 3.5 hours = 12,600,000 ms
  public static readonly ODI_DURATION_MS = 8.0 * 60 * 60 * 1000; // 8 hours = 28,800,000 ms
  public static readonly TEST_DURATION_MS = 5 * 24 * 60 * 60 * 1000; // 5 days = 120 hours = 432,000,000 ms

  public static readonly T20_MIN_REST_MS = 16 * 60 * 60 * 1000; // 16 hours
  public static readonly ODI_MIN_REST_MS = 24 * 60 * 60 * 1000; // 24 hours
  public static readonly TEST_MIN_REST_MS = 48 * 60 * 60 * 1000; // 48 hours (2 days)

  /**
   * Returns standard match duration in milliseconds based on format.
   */
  public static calculateMatchDuration(format?: ArenaFormat | MatchFormat | 'IPL'): number {
    const f = (format || 'T20').toUpperCase();
    if (f === 'TEST') return this.TEST_DURATION_MS;
    if (f === 'ODI') return this.ODI_DURATION_MS;
    return this.T20_DURATION_MS;
  }

  /**
   * Returns minimum rest time required in milliseconds between fixtures for a team.
   */
  public static getMinimumRestDuration(format?: ArenaFormat | MatchFormat | 'IPL'): number {
    const f = (format || 'T20').toUpperCase();
    if (f === 'TEST') return this.TEST_MIN_REST_MS;
    if (f === 'ODI') return this.ODI_MIN_REST_MS;
    return this.T20_MIN_REST_MS;
  }

  /**
   * Checks if two time windows [startA, endA] and [startB, endB] overlap.
   */
  public static isTimeOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return startA < endB && endA > startB;
  }

  /**
   * Checks if a team is already committed to another active/live fixture during the given time window.
   * Multi-day Test matches occupy the team for all 5 days.
   */
  public static isTeamOverlapping(
    teamId: string,
    startTime: number,
    endTime: number,
    existingFixtures: Fixture[],
    excludeFixtureId?: string
  ): boolean {
    return existingFixtures.some((f) => {
      if (f.id === excludeFixtureId) return false;
      if (f.status === MatchStatus.ABANDONED || f.status === MatchStatus.POSTPONED) return false;
      if (f.team1Id !== teamId && f.team2Id !== teamId) return false;

      const fStart = f.startTime ?? 0;
      const fEnd = f.endTime ?? (fStart + this.calculateMatchDuration(f.format));
      return this.isTimeOverlap(startTime, endTime, fStart, fEnd);
    });
  }

  /**
   * Checks if a specific player is already participating in another active/live fixture during the given time window.
   */
  public static isPlayerOverlapping(
    playerId: string,
    startTime: number,
    endTime: number,
    existingFixtures: Fixture[],
    excludeFixtureId?: string
  ): boolean {
    return existingFixtures.some((f) => {
      if (f.id === excludeFixtureId) return false;
      if (f.status === MatchStatus.ABANDONED || f.status === MatchStatus.POSTPONED) return false;

      const hasPlayer =
        (f.team1PlayingXI && f.team1PlayingXI.includes(playerId)) ||
        (f.team2PlayingXI && f.team2PlayingXI.includes(playerId));

      if (!hasPlayer) return false;

      const fStart = f.startTime ?? 0;
      const fEnd = f.endTime ?? (fStart + this.calculateMatchDuration(f.format));
      return this.isTimeOverlap(startTime, endTime, fStart, fEnd);
    });
  }

  /**
   * Verifies if a team has enough rest before and after a proposed start time.
   */
  public static hasSufficientRest(
    teamId: string,
    startTime: number,
    existingFixtures: Fixture[],
    format?: ArenaFormat | MatchFormat | 'IPL',
    excludeFixtureId?: string
  ): { sufficient: boolean; hoursGap: number; minHoursRequired: number } {
    const minRestMs = this.getMinimumRestDuration(format);
    const minHours = minRestMs / (60 * 60 * 1000);
    const proposedDuration = this.calculateMatchDuration(format);
    const proposedEnd = startTime + proposedDuration;

    let smallestGapMs = Number.MAX_SAFE_INTEGER;

    for (const f of existingFixtures) {
      if (f.id === excludeFixtureId) continue;
      if (f.status === MatchStatus.ABANDONED || f.status === MatchStatus.POSTPONED) continue;
      if (f.team1Id !== teamId && f.team2Id !== teamId) continue;

      const fStart = f.startTime ?? 0;
      const fEnd = f.endTime ?? (fStart + this.calculateMatchDuration(f.format));

      if (proposedEnd <= fStart) {
        // Proposed match is before existing fixture
        const gap = fStart - proposedEnd;
        if (gap < smallestGapMs) smallestGapMs = gap;
      } else if (fEnd <= startTime) {
        // Proposed match is after existing fixture
        const gap = startTime - fEnd;
        if (gap < smallestGapMs) smallestGapMs = gap;
      } else {
        // Directly overlapping
        return { sufficient: false, hoursGap: 0, minHoursRequired: minHours };
      }
    }

    if (smallestGapMs === Number.MAX_SAFE_INTEGER) {
      return { sufficient: true, hoursGap: 999, minHoursRequired: minHours };
    }

    const gapHours = smallestGapMs / (60 * 60 * 1000);
    return {
      sufficient: smallestGapMs >= minRestMs,
      hoursGap: Math.round(gapHours * 10) / 10,
      minHoursRequired: minHours,
    };
  }

  /**
   * Validates all scheduling constraints for a fixture.
   */
  public static validateFixture(
    fixture: Fixture,
    existingFixtures: Fixture[]
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (fixture.team1Id === fixture.team2Id) {
      errors.push(`Team cannot play against itself (team ID: ${fixture.team1Id})`);
    }

    const existingMatch = existingFixtures.find((f) => f.id === fixture.id);
    if (existingMatch && existingMatch.status === MatchStatus.COMPLETED) {
      errors.push(`Match ${fixture.id} is already COMPLETED and cannot be rescheduled or modified.`);
      return { isValid: false, errors };
    }

    const duration = this.calculateMatchDuration(fixture.format);
    const startTime = fixture.startTime ?? Date.now();
    const endTime = fixture.endTime ?? (startTime + duration);

    if (startTime >= endTime) {
      errors.push(`Match start time (${startTime}) must be strictly earlier than end time (${endTime}).`);
    }

    // Check team 1 conflict
    if (this.isTeamOverlapping(fixture.team1Id, startTime, endTime, existingFixtures, fixture.id)) {
      errors.push(`Team ${fixture.team1Id} has an overlapping fixture scheduled during this time window.`);
    }

    // Check team 2 conflict
    if (this.isTeamOverlapping(fixture.team2Id, startTime, endTime, existingFixtures, fixture.id)) {
      errors.push(`Team ${fixture.team2Id} has an overlapping fixture scheduled during this time window.`);
    }

    // Check player conflicts if Playing XIs are declared
    if (fixture.team1PlayingXI && fixture.team1PlayingXI.length > 0) {
      for (const pId of fixture.team1PlayingXI) {
        if (this.isPlayerOverlapping(pId, startTime, endTime, existingFixtures, fixture.id)) {
          errors.push(`Player ${pId} in Team 1 Playing XI is already scheduled in an overlapping fixture.`);
          break;
        }
      }
    }

    if (fixture.team2PlayingXI && fixture.team2PlayingXI.length > 0) {
      for (const pId of fixture.team2PlayingXI) {
        if (this.isPlayerOverlapping(pId, startTime, endTime, existingFixtures, fixture.id)) {
          errors.push(`Player ${pId} in Team 2 Playing XI is already scheduled in an overlapping fixture.`);
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generates a realistic, conflict-free tournament schedule with dates, venues, and rest windows.
   */
  public static generateTournamentSchedule(
    teams: Array<{ id: string; name?: string; shortName?: string }>,
    format: ArenaFormat | 'IPL' | MatchFormat = 'T20',
    options?: ScheduleOptions
  ): Fixture[] {
    if (teams.length < 2) return [];

    const isTest = (format || 'T20').toUpperCase() === 'TEST';
    const isODI = (format || 'T20').toUpperCase() === 'ODI';
    const duration = this.calculateMatchDuration(format);
    const tournamentId = options?.tournamentId || `tourney_${format.toLowerCase()}_${Date.now()}`;
    const baseDate = options?.startDate || new Date(2026, 3, 1, 14, 0, 0).getTime(); // April 1, 2026 14:00

    const matchPairs: Array<{ t1: string; t2: string; venue?: string }> = [];

    // Determine home venues helper
    const getVenue = (teamShort: string = ''): string => {
      return (
        IPL_VENUES[teamShort] ||
        INTL_VENUES[teamShort] ||
        NEUTRAL_VENUES[Math.floor(Math.random() * NEUTRAL_VENUES.length)]
      );
    };

    const teamMap = new Map(teams.map((t) => [t.id, t]));

    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const t1 = teams[i];
        const t2 = teams[j];

        // Match 1: t1 home
        matchPairs.push({
          t1: t1.id,
          t2: t2.id,
          venue: getVenue(t1.shortName),
        });

        // If double round robin or limited teams
        if (options?.isDoubleRoundRobin || teams.length <= 4) {
          matchPairs.push({
            t1: t2.id,
            t2: t1.id,
            venue: getVenue(t2.shortName),
          });
        }
      }
    }

    // Schedule matches onto timeline with rest days and zero team overlap
    const fixtures: Fixture[] = [];
    const teamLastPlayedEnd: Record<string, number> = {};
    teams.forEach((t) => (teamLastPlayedEnd[t.id] = 0));

    const dayDurationMs = 24 * 60 * 60 * 1000;
    let currentDayNumber = 1;
    let matchCounter = 1;

    // Daily match slots:
    // T20: Slot 1: 15:30 (on double header days), Slot 2: 19:30
    // ODI: Slot 1: 13:30
    // TEST: Slot 1: 09:30 (runs 5 full days)
    const queue = [...matchPairs];

    // For Test matches: sequential or multi-series
    if (isTest) {
      let testCurrentTime = baseDate;
      for (const pair of queue) {
        const start = testCurrentTime;
        const end = start + duration;

        fixtures.push({
          id: `m${matchCounter}`,
          matchNumber: matchCounter,
          day: currentDayNumber,
          team1Id: pair.t1,
          team2Id: pair.t2,
          venue: pair.venue || "Lord's, London",
          status: MatchStatus.UPCOMING,
          fixtureStatus: 'SCHEDULED' as FixtureStatus,
          format: MatchFormat.TEST,
          startTime: start,
          endTime: end,
          tournamentId,
        });

        matchCounter++;
        currentDayNumber += 5; // 5 days of Test match
        // 3 rest days between tests
        testCurrentTime = end + 3 * dayDurationMs;
        currentDayNumber += 3;
      }
      return fixtures;
    }

    // Limited overs (T20 / ODI / IPL):
    let calendarTime = baseDate;
    while (queue.length > 0) {
      const isWeekend = currentDayNumber % 7 === 4 || currentDayNumber % 7 === 5; // e.g. weekend slots
      const maxMatchesToday = !isODI && isWeekend ? 2 : 1;
      let matchesScheduledToday = 0;

      for (let i = 0; i < queue.length && matchesScheduledToday < maxMatchesToday; i++) {
        const item = queue[i];
        const lastEnd1 = teamLastPlayedEnd[item.t1] || 0;
        const lastEnd2 = teamLastPlayedEnd[item.t2] || 0;

        // Check if teams had at least minimum rest
        const minRest = isODI ? this.ODI_MIN_REST_MS : this.T20_MIN_REST_MS;
        if (calendarTime - lastEnd1 >= minRest && calendarTime - lastEnd2 >= minRest) {
          const matchStart = calendarTime + (matchesScheduledToday === 1 ? 4 * 60 * 60 * 1000 : 0);
          const matchEnd = matchStart + duration;

          fixtures.push({
            id: `m${matchCounter}`,
            matchNumber: matchCounter,
            day: currentDayNumber,
            team1Id: item.t1,
            team2Id: item.t2,
            venue: item.venue || 'Wankhede Stadium, Mumbai',
            status: MatchStatus.UPCOMING,
            fixtureStatus: 'SCHEDULED' as FixtureStatus,
            format: (format === 'IPL' ? MatchFormat.T20 : (format as MatchFormat)) || MatchFormat.T20,
            startTime: matchStart,
            endTime: matchEnd,
            tournamentId,
          });

          teamLastPlayedEnd[item.t1] = matchEnd;
          teamLastPlayedEnd[item.t2] = matchEnd;

          queue.splice(i, 1);
          i--;
          matchesScheduledToday++;
          matchCounter++;
        }
      }

      // If no match could be scheduled due to rest, move calendar forward by 1 day
      calendarTime += dayDurationMs;
      currentDayNumber++;
    }

    return fixtures;
  }
}
