import { Fixture, MatchStatus } from '../types/match';
import { Franchise } from '../stores/useGameStore';

/**
 * IPL 2026 Schedule Generator
 * 10 teams → 70 league matches
 * Each team plays exactly 14 matches:
 *   - Home & Away vs each of the other 4 teams in their group (4×2 = 8 matches)
 *   - Once vs each of the 5 teams in the opposing group (5×1 = 6 matches)
 *   - Slightly adjust home/away for cross-group for balance
 *
 * Followed by Qualifier 1, Eliminator, Qualifier 2, Final (generated later)
 */
export function generateDoubleRoundRobinSchedule(teams: Franchise[], format: 'T20' | 'ODI' | 'TEST' | 'IPL' = 'T20'): Fixture[] {
  const matchPairs: { t1: string; t2: string }[] = [];

  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchPairs.push({ t1: teams[i].id, t2: teams[j].id });
      matchPairs.push({ t1: teams[j].id, t2: teams[i].id });
    }
  }

  // Shuffle for variety
  for (let i = matchPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matchPairs[i], matchPairs[j]] = [matchPairs[j], matchPairs[i]];
  }

  // Generate Fixtures
  return matchPairs.map((pair, index) => {
    // 1 match per day for simplicity, or 2 if you prefer.
    const day = Math.floor(index / 2) + 1;
    return {
      id: `m${index + 1}`,
      matchNumber: index + 1,
      day,
      team1Id: pair.t1,
      team2Id: pair.t2,
      status: MatchStatus.UPCOMING,
      format: (format === 'IPL' ? 'T20' : format) as any,
    };
  });
}

export function generateIPLSchedule(teams: Franchise[]): Fixture[] {
  if (teams.length !== 10) return [];

  const groupA = teams.slice(0, 5);
  const groupB = teams.slice(5, 10);
  const matchPairs: { t1: string; t2: string }[] = [];

  // Within Group A – each pair plays twice (home and away) = 10 pairs × 2 = 20 matches
  for (let i = 0; i < groupA.length; i++) {
    for (let j = i + 1; j < groupA.length; j++) {
      matchPairs.push({ t1: groupA[i].id, t2: groupA[j].id });
      matchPairs.push({ t1: groupA[j].id, t2: groupA[i].id });
    }
  }

  // Within Group B – same, 20 matches
  for (let i = 0; i < groupB.length; i++) {
    for (let j = i + 1; j < groupB.length; j++) {
      matchPairs.push({ t1: groupB[i].id, t2: groupB[j].id });
      matchPairs.push({ t1: groupB[j].id, t2: groupB[i].id });
    }
  }

  // Cross-group:
  // Each A team plays each B team once (5×5 = 25 matches)
  // Each A team plays one specific B team (same index) twice (+5 matches) = 30 matches
  for (let i = 0; i < groupA.length; i++) {
    for (let j = 0; j < groupB.length; j++) {
      if ((i + j) % 2 === 0) {
        matchPairs.push({ t1: groupA[i].id, t2: groupB[j].id });
      } else {
        matchPairs.push({ t1: groupB[j].id, t2: groupA[i].id });
      }
      // Play same-index team from other group twice
      if (i === j) {
        if ((i + j) % 2 === 0) {
          matchPairs.push({ t1: groupB[j].id, t2: groupA[i].id });
        } else {
          matchPairs.push({ t1: groupA[i].id, t2: groupB[j].id });
        }
      }
    }
  }

  // Shuffle for variety
  for (let i = matchPairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [matchPairs[i], matchPairs[j]] = [matchPairs[j], matchPairs[i]];
  }

  // ── Schedule matches onto days ──
  // Weekdays: 1 match/day, Weekends (Sat/Sun): 2 matches/day
  const scheduledMatches: { t1: string; t2: string; day: number }[] = [];
  const pool = [...matchPairs];

  const lastPlayed: Record<string, number> = {};
  teams.forEach(t => (lastPlayed[t.id] = -99));

  const isWeekend = (d: number) => d % 7 === 0 || d % 7 === 6; // day 6&7 of each week = Sat/Sun

  let day = 1;
  while (pool.length > 0) {
    const matchesThisDay = isWeekend(day) ? 2 : 1;
    const teamsToday = new Set<string>();
    let scheduled = 0;

    for (let attempt = 0; attempt < 2; attempt++) {
      for (let i = 0; i < pool.length && scheduled < matchesThisDay; i++) {
        const m = pool[i];
        if (teamsToday.has(m.t1) || teamsToday.has(m.t2)) continue;
        // Prefer teams with more rest (first pass: ≥3 days; second pass: any)
        const rest1 = day - lastPlayed[m.t1];
        const rest2 = day - lastPlayed[m.t2];
        if (attempt === 0 && (rest1 < 3 || rest2 < 3)) continue;

        pool.splice(i, 1);
        i--;
        scheduledMatches.push({ t1: m.t1, t2: m.t2, day });
        teamsToday.add(m.t1);
        teamsToday.add(m.t2);
        lastPlayed[m.t1] = day;
        lastPlayed[m.t2] = day;
        scheduled++;
      }
      if (scheduled > 0) break;
    }

    // Force-schedule remaining if stuck
    if (scheduled === 0 && pool.length > 0) {
      const m = pool.shift()!;
      scheduledMatches.push({ t1: m.t1, t2: m.t2, day });
      lastPlayed[m.t1] = day;
      lastPlayed[m.t2] = day;
    }

    day++;
  }

  return scheduledMatches.map((m, index) => ({
    id: `m${index + 1}`,
    matchNumber: index + 1,
    day: m.day,
    team1Id: m.t1,
    team2Id: m.t2,
    status: MatchStatus.UPCOMING,
  }));
}
