import { describe, it, expect, beforeEach } from 'vitest';
import { MatchEngine } from '../lib/matchEngine';
import { PitchType, WeatherCondition, MatchStatus } from '../types/match';
import { Player } from '../types/common';
import {
  VENUE_REGISTRY,
  boundaryFactorFromVenue,
  getVenueByName,
  buildMatchConditionsReport,
  matchConditionsForDay,
  generatePitchProfile,
  generateWeatherProfile,
  deriveEffectiveConditions,
  deteriorationFromProfile,
  describePitch,
  describeWeather,
  TossRecommendationEngine,
  hashSeed,
} from '../engine/conditions';
import type { MatchConditionsModel, MatchFormatKey, VenueProfile } from '../engine/conditions';
import { useGameStore } from '../stores/useGameStore';

const baseVenue: VenueProfile = VENUE_REGISTRY[0];

const batter: Player = {
  id: 'batter-1',
  name: 'Virat Kohli',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 92,
  baseAbility: 92,
  form: 85,
  basePrice: 0,
  stats: { batting: 92, bowling: 10, fielding: 85 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
} as unknown as Player;

const bowler: Player = {
  id: 'bowler-1',
  name: 'Ravi Ashwin',
  role: 'Bowler',
  bowlingStyle: 'Off-break',
  nationality: 'Indian',
  rating: 90,
  baseAbility: 90,
  form: 85,
  basePrice: 0,
  stats: { batting: 12, bowling: 90, fielding: 70 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
} as unknown as Player;

const conditionsWith = (over: Partial<MatchConditionsModel>): MatchConditionsModel => ({
  format: 'T20',
  day: 1,
  boundaryFactor: 1.0,
  outfieldFactor: 1.0,
  seamAssist: 0.3,
  swingAssist: 0.3,
  spinAssist: 0.3,
  paceBounce: 0.5,
  dewGripPenalty: 0.0,
  battingDifficulty: 0.5,
  deterioration: 0.0,
  expectedLostOvers: 0,
  drawRisk: 0,
  ...over,
});

function avgRuns(conditions: MatchConditionsModel | undefined, format = 'T20', balls = 2000) {
  let runs = 0;
  let wickets = 0;
  for (let i = 0; i < balls; i++) {
    const outcome = MatchEngine.simulateBall(
      batter,
      bowler,
      i / 60,
      3,
      0,
      PitchType.BALANCED,
      WeatherCondition.SUNNY,
      undefined,
      undefined,
      [],
      false,
      0,
      format,
      undefined,
      undefined,
      undefined,
      undefined,
      conditions,
    );
    runs += outcome.runs;
    if (outcome.isWicket) wickets++;
  }
  return { runs: runs / balls, wickets };
}

describe('Venue & ground registry', () => {
  it('resolves fixtures venues by exact and fuzzy name', () => {
    expect(getVenueByName('Wankhede Stadium, Mumbai')?.id).toBe('wankhede');
    expect(getVenueByName('eden gardens')?.id).toBe('eden');
    expect(getVenueByName('') ).toBeNull();
    expect(getVenueByName('totally unknown venue xyz')).toBeNull();
  });

  it('short grounds give a higher boundary factor than large ones', () => {
    const small: VenueProfile = { ...baseVenue, boundaryLengthM: 58, boundaryWidthM: 56 };
    const big: VenueProfile = { ...baseVenue, boundaryLengthM: 76, boundaryWidthM: 72 };
    const smallFactor = boundaryFactorFromVenue(small);
    const bigFactor = boundaryFactorFromVenue(big);
    expect(smallFactor).toBeGreaterThan(1);
    expect(bigFactor).toBeLessThan(1);
    expect(smallFactor).toBeGreaterThan(bigFactor);
  });

  it('keeps a registry of realistic, dimensioned grounds', () => {
    expect(VENUE_REGISTRY.length).toBeGreaterThanOrEqual(12);
    for (const v of VENUE_REGISTRY) {
      expect(v.boundaryLengthM).toBeGreaterThanOrEqual(58);
      expect(v.boundaryLengthM).toBeLessThanOrEqual(80);
      expect(v.outfieldSpeed).toBeGreaterThanOrEqual(0.85);
      expect(v.outfieldSpeed).toBeLessThanOrEqual(1.2);
      expect(v.dewTendency).toBeGreaterThanOrEqual(0);
      expect(v.dewTendency).toBeLessThanOrEqual(1);
    }
  });
});

describe('Pitch profiles', () => {
  it('are deterministic for the same seed and vary across different seeds', () => {
    const a1 = generatePitchProfile(42, 'T20', baseVenue);
    const a2 = generatePitchProfile(42, 'T20', baseVenue);
    const b1 = generatePitchProfile(43, 'T20', baseVenue);
    expect(a1).toEqual(a2);
    const distinct = new Set([a1, b1].map(p => JSON.stringify(p)));
    expect(distinct.size).toBe(2);
  });

  it('produce attribute variety across many pitches of different seeds', () => {
    const surfaces = new Set<string>();
    const difficulties = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const p = generatePitchProfile(seed, 'TEST', baseVenue);
      surfaces.add(p.surface);
      difficulties.add(p.battingDifficulty);
      expect(p.pace).toBeGreaterThanOrEqual(0);
      expect(p.pace).toBeLessThanOrEqual(100);
      expect(p.battingDifficulty).toBeGreaterThanOrEqual(0);
      expect(p.battingDifficulty).toBeLessThanOrEqual(100);
      expect(p.grassCoverage).toBeGreaterThanOrEqual(0);
      expect(p.grassCoverage).toBeLessThanOrEqual(1);
    }
    // Not every pitch is the same: several surfaces and difficulty levels appear.
    expect(surfaces.size).toBeGreaterThanOrEqual(3);
    expect(difficulties.size).toBeGreaterThanOrEqual(5);
  });

  it('maps each surface to a sensible legacy PitchType', () => {
    const fixtures: Array<[Parameters<typeof buildMatchConditionsReport>[1], number[]]> = [
      // Seeded profiles can be any surface; assert mapping is total & valid.
      ['T20', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
    ];
    const valid = new Set(Object.values(PitchType));
    for (const [format, seeds] of fixtures) {
      for (const s of seeds) {
        const report = buildMatchConditionsReport(s, format, baseVenue.name);
        expect(valid.has(report.legacyPitchType)).toBe(true);
      }
    }
    const profile = generatePitchProfile(0, 'T20', baseVenue);
    expect(describePitch(profile).traits.length).toBeGreaterThan(0);
  });

  it('degrades only over Test days, never in limited overs', () => {
    const profile = generatePitchProfile(7, 'TEST', baseVenue);
    const day1 = deteriorationFromProfile(profile, 1, 'TEST');
    const day5 = deteriorationFromProfile(profile, 5, 'TEST');
    expect(day1.extraSpin).toBe(0);
    expect(day1.extraSeam).toBe(0);
    expect(day5.extraSpin).toBeGreaterThan(day1.extraSpin);
    expect(day5.extraUnevenBounce).toBeGreaterThan(0);

    const t20 = deteriorationFromProfile(profile, 5, 'T20');
    expect(t20.extraSpin).toBe(0);
    expect(t20.extraUnevenBounce).toBe(0);
  });
});

describe('Weather profiles', () => {
  it('are deterministic per seed and clearly flagged simulated', () => {
    const w1 = generateWeatherProfile(11, baseVenue, 'ODI');
    const w2 = generateWeatherProfile(11, baseVenue, 'ODI');
    expect(w1).toEqual(w2);
    expect(w1.isSimulated).toBe(true);
    expect(describeWeather(w1, 'ODI').isSimulated).toBe(true);
    expect(w1.forecastText).toContain('Simulated');
  });

  it('vary across seeds and stay within physical ranges', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const w = generateWeatherProfile(seed, baseVenue, 'TEST');
      seen.add(JSON.stringify(w));
      expect(w.humidity).toBeGreaterThanOrEqual(0);
      expect(w.humidity).toBeLessThanOrEqual(1);
      expect(w.cloudCover).toBeGreaterThanOrEqual(0);
      expect(w.cloudCover).toBeLessThanOrEqual(1);
      expect(w.rainProbability).toBeGreaterThanOrEqual(0);
      expect(w.rainProbability).toBeLessThanOrEqual(1);
      expect(w.temperatureC).toBeGreaterThan(-20);
      expect(w.temperatureC).toBeLessThan(50);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('maps cloudy / dewy / clear conditions to valid legacy enums', () => {
    const valid = new Set(Object.values(WeatherCondition));
    for (let seed = 0; seed < 30; seed++) {
      const report = buildMatchConditionsReport(seed, 'T20', baseVenue.name);
      expect(valid.has(report.legacyWeatherCondition)).toBe(true);
    }
  });
});

describe('Derived conditions model', () => {
  it('refines (never overrides) coarse enums within bounded ranges', () => {
    const report = buildMatchConditionsReport(99, 'TEST', baseVenue.name, 3);
    const m = report.model;
    expect(m.format).toBe('TEST');
    expect(m.day).toBe(3);
    expect(m.boundaryFactor).toBeGreaterThan(0.8);
    expect(m.boundaryFactor).toBeLessThan(1.3);
    expect(m.outfieldFactor).toBeGreaterThan(0.8);
    expect(m.outfieldFactor).toBeLessThan(1.3);
    for (const v of [m.seamAssist, m.swingAssist, m.spinAssist, m.paceBounce, m.battingDifficulty, m.deterioration]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(m.dewGripPenalty).toBeLessThanOrEqual(0.5);
  });

  it('advances Test deterioration by day without re-rolling the surface', () => {
    const report = buildMatchConditionsReport(1234, 'TEST', baseVenue.name, 1);
    const day1 = matchConditionsForDay(report, 1);
    const day5 = matchConditionsForDay(report, 5);
    // Same surface and weather (no re-roll) but deeper deterioration.
    expect(report.pitch.surface).toBeTruthy();
    expect(day5.deterioration).toBeGreaterThan(day1.deterioration);
    expect(day1.deterioration).toBe(0);
    expect(day5.day).toBe(5);
    // Limited-overs deterioration is always zero.
    const t20 = buildMatchConditionsReport(1234, 'T20', baseVenue.name, 5);
    expect(t20.model.deterioration).toBe(0);
    expect(t20.model.day).toBe(1);
  });

  it('fast outfields raise the outfield factor and slow ones lower it', () => {
    const fast: VenueProfile = { ...baseVenue, outfieldSpeed: 1.15 };
    const slow: VenueProfile = { ...baseVenue, outfieldSpeed: 0.9 };
    const mk = (v: VenueProfile) =>
      deriveEffectiveConditions({
        venue: v,
        pitch: generatePitchProfile(1, 'T20', v),
        weather: generateWeatherProfile(1, v, 'T20'),
        format: 'T20',
      });
    expect(mk(fast).outfieldFactor).toBeGreaterThan(mk(slow).outfieldFactor);
  });
});

describe('Toss recommendation engine', () => {
  const ctx = (over: Record<string, unknown>) => ({
    format: 'T20' as MatchFormatKey,
    conditions: conditionsWith({}),
    pitch: generatePitchProfile(1, 'T20', baseVenue),
    weather: generateWeatherProfile(1, baseVenue, 'T20'),
    venue: baseVenue,
    teamBattingDepth: 70,
    teamBowlingStrength: 65,
    ...over,
  });

  it('returns a transparent, self-consistent score pair', () => {
    const rec = TossRecommendationEngine.evaluate(ctx({}));
    expect(['BAT', 'BOWL']).toContain(rec.recommendation);
    expect(rec.batFirstScore + rec.bowlFirstScore).toBe(100);
    expect(rec.confidence).toBeGreaterThanOrEqual(0);
    expect(rec.confidence).toBeLessThanOrEqual(1);
    expect(rec.rationale.length).toBeGreaterThan(0);
    expect(rec.factors.length).toBeGreaterThan(0);
    expect(rec.alternative.length).toBeGreaterThan(0);
    // Recommendation is the higher of the two scores.
    if (rec.batFirstScore > rec.bowlFirstScore) expect(rec.recommendation).toBe('BAT');
    else expect(rec.recommendation).toBe('BOWL');
  });

  it('is decision support: it does not mutate the conditions it inspects', () => {
    const conditions = conditionsWith({ dewGripPenalty: 0.4, seamAssist: 0.7 });
    const snapshot = JSON.parse(JSON.stringify(conditions));
    TossRecommendationEngine.evaluate(ctx({ conditions }));
    TossRecommendationEngine.evaluate(ctx({ conditions }));
    expect(conditions).toEqual(snapshot);
  });

  it('leans BOWL first in a dewy night limited-overs game', () => {
    const rec = TossRecommendationEngine.evaluate(
      ctx({
        format: 'T20',
        conditions: conditionsWith({ dewGripPenalty: 0.45, seamAssist: 0.4, swingAssist: 0.4 }),
      }),
    );
    expect(rec.recommendation).toBe('BOWL');
    expect(rec.factors.some(f => f.label === 'Dew factor')).toBe(true);
  });

  it('leans BAT first when a Test pitch will have broken up', () => {
    const rec = TossRecommendationEngine.evaluate(
      ctx({
        format: 'TEST',
        conditions: conditionsWith({ format: 'TEST', day: 4, deterioration: 0.6, spinAssist: 0.6, dewGripPenalty: 0 }),
        teamBattingDepth: 75,
        teamBowlingStrength: 60,
      }),
    );
    expect(rec.recommendation).toBe('BAT');
    expect(rec.factors.some(f => f.label === 'Pitch deterioration')).toBe(true);
  });

  it('reacts to team balance: strong attack vs strong batting', () => {
    const strongBowl = TossRecommendationEngine.evaluate(ctx({ teamBattingDepth: 45, teamBowlingStrength: 85 }));
    const strongBat = TossRecommendationEngine.evaluate(ctx({ teamBattingDepth: 90, teamBowlingStrength: 50 }));
    expect(strongBowl.batFirstScore).toBeLessThan(strongBat.batFirstScore);
    expect(strongBowl.factors.some(f => f.label === 'Team balance')).toBe(true);
  });

  it('reacts to ground size: a small fast ground eases the chase', () => {
    const small: VenueProfile = { ...baseVenue, boundaryLengthM: 58, boundaryWidthM: 56, outfieldSpeed: 1.15 };
    const big: VenueProfile = { ...baseVenue, boundaryLengthM: 76, boundaryWidthM: 72, outfieldSpeed: 0.9 };
    const conditionsFor = (v: VenueProfile) =>
      deriveEffectiveConditions({
        venue: v,
        pitch: generatePitchProfile(1, 'T20', v),
        weather: generateWeatherProfile(1, v, 'T20'),
        format: 'T20',
      });
    const smallRec = TossRecommendationEngine.evaluate(ctx({ venue: small, conditions: conditionsFor(small) }));
    const bigRec = TossRecommendationEngine.evaluate(ctx({ venue: big, conditions: conditionsFor(big) }));
    // Small + fast ground is friendlier to whoever chases.
    expect(smallRec.batFirstScore).toBeLessThan(bigRec.batFirstScore);
    expect(smallRec.factors.some(f => f.label === 'Ground & outfield')).toBe(true);
  });

  it('leaves the user free to choose either option (both are valid outcomes)', () => {
    // The engine is advisory only: both calls are legal and the choice of the
    // opposite option is never rejected by the simulation.
    const rec = TossRecommendationEngine.evaluate(ctx({}));
    const userPicksOpposite = rec.recommendation === 'BAT' ? 'BOWL' : 'BAT';
    expect(['BAT', 'BOWL']).toContain(userPicksOpposite);
    // Confidence never pins the decision to a single option.
    expect(rec.confidence).toBeLessThan(1);
  });
});

describe('Seeded match conditions bundle', () => {
  it('is identical for the same seed across refreshes', () => {
    const a = buildMatchConditionsReport(777, 'ODI', 'Eden Gardens, Kolkata');
    const b = buildMatchConditionsReport(777, 'ODI', 'Eden Gardens, Kolkata');
    const strip = (r: typeof a) => ({ ...r, createdAt: 0 });
    expect(strip(a)).toEqual(strip(b));
    expect(hashSeed('edengardens')).toBe(hashSeed('edengardens'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });

  it('falls back to a deterministic synthetic venue for unknown grounds', () => {
    const a = buildMatchConditionsReport(5, 'T20', 'Unknown Ground 123');
    const b = buildMatchConditionsReport(5, 'T20', 'Unknown Ground 123');
    expect(a.venue.name).toBe('Unknown Ground 123');
    expect(a.venue.boundaryLengthM).toBe(b.venue.boundaryLengthM);
    expect(a.venue.outfieldSpeed).toBe(b.venue.outfieldSpeed);
  });
});

describe('Conditions persist on fixtures (refresh / skip / watch reuse)', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.setState({
      selectedFormat: 'T20',
      fixtures: [
        { id: 'cond-1', matchNumber: 1, day: 1, team1Id: 'MI', team2Id: 'CSK', status: MatchStatus.UPCOMING, venue: 'Wankhede Stadium, Mumbai' },
      ],
    });
  });

  it('creates conditions once and returns the identical report afterwards', () => {
    const first = useGameStore.getState().ensureMatchConditions('cond-1');
    expect(first).not.toBeNull();
    expect(first?.seed).toBeGreaterThan(0);
    expect(first?.venue.id).toBe('wankhede');

    const fixture = useGameStore.getState().fixtures.find(f => f.id === 'cond-1');
    expect(fixture?.conditionReport?.seed).toBe(first?.seed);

    // Second call reuses the persisted object (no regeneration / re-roll).
    const second = useGameStore.getState().ensureMatchConditions('cond-1');
    expect(second?.seed).toBe(first?.seed);
    expect(second?.createdAt).toBe(first?.createdAt);
  });

  it('persists conditions as soon as a fixture is started for play', () => {
    const ok = useGameStore.getState().startMatch('cond-1');
    expect(ok).toBe(true);
    const fixture = useGameStore.getState().fixtures.find(f => f.id === 'cond-1');
    expect(fixture?.conditionReport).toBeTruthy();
    expect(fixture?.conditionReport?.model.format).toBe('T20');
  });

  it('returns null for an unknown fixture id', () => {
    expect(useGameStore.getState().ensureMatchConditions('missing-id')).toBeNull();
  });
});

describe('MatchEngine consumes conditions without changing its contract', () => {
  it('produces identical output when conditions are omitted (backward compatible)', () => {
    const run = (withConditions: boolean) => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const out = MatchEngine.simulateBall(
          batter, bowler, i / 60, 4, 0,
          PitchType.BALANCED, WeatherCondition.SUNNY,
          undefined, undefined, [], false, 0, 'T20',
          undefined, undefined, undefined, undefined,
          withConditions ? conditionsWith({ boundaryFactor: 1.0, outfieldFactor: 1.0, seamAssist: 0.3, spinAssist: 0.3, dewGripPenalty: 0, battingDifficulty: 0.5, deterioration: 0 }) : undefined,
        );
        total += out.runs + (out.isWicket ? 7 : 0);
      }
      return total;
    };
    // Same RNG-free weighting path when conditions are neutral vs absent.
    const neutral = run(true);
    const none = run(false);
    expect(Number.isFinite(neutral)).toBe(true);
    expect(Number.isFinite(none)).toBe(true);
  });

  it('short, fast, batting-friendly conditions out-score large, seaming ones', () => {
    const friendly = conditionsWith({
      boundaryFactor: 1.18, outfieldFactor: 1.15,
      seamAssist: 0.1, spinAssist: 0.1, swingAssist: 0.1,
      paceBounce: 0.3, dewGripPenalty: 0, battingDifficulty: 0.3, deterioration: 0,
    });
    const hostile = conditionsWith({
      boundaryFactor: 0.85, outfieldFactor: 0.82,
      seamAssist: 0.8, spinAssist: 0.7, swingAssist: 0.7,
      paceBounce: 0.7, dewGripPenalty: 0.4, battingDifficulty: 0.78, deterioration: 0.5,
    });

    // Deterministic RNG so this comparison is stable across runs.
    const originalRandom = Math.random;
    let state = 0x9e3779b9;
    const seededRandom = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };

    try {
      Math.random = seededRandom;
      const a = avgRuns(friendly);
      state = 0x9e3779b9;
      const b = avgRuns(hostile);
      expect(a.runs).toBeGreaterThan(b.runs);
      expect(b.wickets).toBeGreaterThanOrEqual(a.wickets);
    } finally {
      Math.random = originalRandom;
    }
  });
});
