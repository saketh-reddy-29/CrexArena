import { describe, it, expect } from 'vitest';
import { generateDoubleRoundRobinSchedule } from '../lib/scheduleGenerator';
import { Franchise } from '../stores/useGameStore';

describe("Schedule and Competition Engine", () => {
  it("generates correct number of matches for a 10 team double round robin", () => {
    const teams: Franchise[] = Array.from({length: 10}).map((_, i) => ({
      id: `T${i}`,
      name: `Team ${i}`,
      shortName: `T${i}`,
      color: "#000",
      logoUrl: "",
      squad: []
    }));

    const schedule = generateDoubleRoundRobinSchedule(teams, 'T20');
    
    // 10 teams double round robin = 10 * 9 = 90 matches
    expect(schedule.length).toBe(90);

    // Each team should play exactly 18 matches
    const matchesForTeam0 = schedule.filter(m => m.team1Id === 'T0' || m.team2Id === 'T0');
    expect(matchesForTeam0.length).toBe(18);
  });
});
