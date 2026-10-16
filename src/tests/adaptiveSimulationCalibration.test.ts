import { describe, it, expect, vi, afterEach } from 'vitest';
import { Player } from '../types/common';
import { PitchType, WeatherCondition } from '../types/match';
import { ArenaFormat } from '../engine/models/ArenaState';
import { MatchEngine } from '../lib/matchEngine';
import { BowlerFieldStrategyEngine } from '../engine/strategy/BowlerFieldStrategyEngine';
import { buildDeliveryModel, neutralDeliveryModel } from '../engine/ai/AdaptiveCaptainEngine';
import { BatterDecisionEngine, BatterInningsState } from '../engine/ai/BatterDecisionEngine';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SECTION 12-G â€” ADAPTIVE CAPTAIN SIMULATION VALIDATION
//
//  Configurable, format-appropriate calibration ranges used as *diagnostics*.
//  Ranges are intentionally wide so the suite validates realism / fairness
//  without flaking; genuine regressions (forced wickets, guaranteed survival,
//  statistical manipulation) still breach them.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface CalibrationRange {
  wicketsPerInnings: [number, number];
  runRate: [number, number];
  dotPct: [number, number];
  boundaryPct: [number, number];
  ballsCap: number;
  inningsCount: number;
}

export const CALIBRATION: Record<string, CalibrationRange> = {
  T20: { wicketsPerInnings: [2, 10], runRate: [4.5, 13.5], dotPct: [15, 62], boundaryPct: [5, 34], ballsCap: 120, inningsCount: 80 },
  ODI: { wicketsPerInnings: [3, 10], runRate: [3.2, 8.5], dotPct: [28, 72], boundaryPct: [2, 20], ballsCap: 300, inningsCount: 45 },
  TEST: { wicketsPerInnings: [3, 10], runRate: [1.4, 5], dotPct: [42, 92], boundaryPct: [1, 14], ballsCap: 520, inningsCount: 26 },
};

function mkPlayer(overrides: Partial<Player> & Pick<Player, 'id' | 'name' | 'role' | 'stats'>): Player {
  return {
    nationality: 'Indian',
    rating: 84,
    basePrice: 0,
    baseAbility: 84,
    form: 80,
    careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
    ...overrides,
  };
}

function makeBatters(): Player[] {
  const names = ['A Open', 'B Anchor', 'C Stroke', 'D Finisher', 'E All', 'F All', 'G Keeper', 'H Spin', 'I Pace', 'J Pace', 'K Tail'];
  return names.map((name, i) => mkPlayer({
    id: `bat_${i}`,
    name,
    role: i < 5 ? 'Batsman' : i < 7 ? 'All-rounder' : i === 6 ? 'Wicketkeeper' : 'Bowler',
    stats: { batting: 88 - i * 5, bowling: 30 + i * 3, fielding: 70 },
    aggression: i < 5 ? 80 : 55,
    temperament: i < 5 ? 78 : 55,
    battingStyle: i === 3 ? 'Left-hand bat' : 'Right-hand bat',
  }));
}

function makeBowlers(): Player[] {
  const styles = ['Right-arm Fast', 'Left-arm Fast', 'Right-arm Medium', 'Right-arm Leg Spin', 'Left-arm Orthodox'];
  return styles.map((bowlingStyle, i) => mkPlayer({
    id: `bowl_${i}`,
    name: `Bowler ${i}`,
    role: 'Bowler',
    stats: { batting: 20, bowling: 84 - i * 3, fielding: 72 },
    bowlingStyle,
  }));
}

function emptyStats(playerId: string): any {
  return {
    playerId, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, overs: 0,
    runsConceded: 0, dots: 0, momentum: 0, consecutiveDots: 0, ballsSinceBoundary: 0,
    wicketBurst: 0, oversBowled: 0, legalBallsThisOver: 0, bouncersThisOver: 0,
  };
}

interface InningsMetrics {
  balls: number;
  runs: number;
  wickets: number;
  dots: number;
  boundaries: number;
  firstWicketBall: number | null;
  durations: number[];
  useModel: boolean;
}

function simulateInnings(format: ArenaFormat, opts: { useModel: boolean; cap?: number }): InningsMetrics {
  const batsmen = makeBatters();
  const bowlers = makeBowlers();
  const fieldingSquad = makeBowlers();
  const cfg = CALIBRATION[format];
  const cap = opts.cap ?? cfg.ballsCap;

  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  let dots = 0;
  let boundaries = 0;
  let firstWicketBall: number | null = null;
  let totalBalls = 0;

  const batterState = new Map<number, BatterInningsState>();
  const bowlerStats = new Map<string, any>();
  const recent: string[] = [];
  const pitch = PitchType.BALANCED;
  const weather = WeatherCondition.SUNNY;

  while (legalBalls < cap && wickets < 10) {
    const over = Math.floor(legalBalls / 6);
    const bowler = bowlers[over % bowlers.length];
    const striker = batsmen[strikerIdx];
    const nonStriker = batsmen[nonStrikerIdx];
    if (!striker || !bowler) break;

    const bState = batterState.get(strikerIdx) || BatterDecisionEngine.createInitialBatterState(striker.id, 'sim', striker);
    const bStats = emptyStats(striker.id);
    bStats.balls = bState.ballsFaced;
    bStats.runs = bState.runsScored;
    bStats.dots = bState.dots;
    bStats.consecutiveDots = bState.dots;
    const bowStats = bowlerStats.get(bowler.id) || emptyStats(bowler.id);
    bowlerStats.set(bowler.id, bowStats);

    const intent = BatterDecisionEngine.selectBattingIntent(bState, {
      format,
      batter: striker,
      bowler,
      inningsState: { score: runs, wickets, balls: legalBalls },
      pitchType: pitch,
    });

    const tacticalModel = opts.useModel
      ? buildDeliveryModel({
          format,
          field: BowlerFieldStrategyEngine.generateFieldConfiguration({
            format, bowler, striker, nonStriker, overs: over, balls: legalBalls,
            wickets, runs, pitch, weather, fieldingSquad,
          }),
          bowler, striker, overs: over, wickets, requiredRate: 0, recentOutcomes: recent,
        })
      : neutralDeliveryModel();

    const outcome = MatchEngine.simulateBall(
      striker, bowler, over, wickets, 0, pitch, weather,
      bStats, bowStats, recent, false, 0, format,
      intent, undefined, undefined, tacticalModel
    );

    totalBalls++;
    const legal = outcome.extraType !== 'Wide' && outcome.extraType !== 'No Ball';
    if (legal) legalBalls++;
    runs += outcome.runs;
    if (outcome.isWicket) {
      if (firstWicketBall === null) firstWicketBall = legalBalls;
      wickets++;
    } else if (outcome.runs === 0 && legal) {
      dots++;
    }
    if (legal && (outcome.runs === 4 || outcome.runs === 6)) boundaries++;
    recent.push(outcome.isWicket ? 'W' : outcome.extraType === 'Wide' ? 'Wd' : String(outcome.runs));
    if (recent.length > 24) recent.shift();

    batterState.set(strikerIdx, BatterDecisionEngine.updateBatterStateAfterDelivery(bState, {
      runs: outcome.runs, isWicket: outcome.isWicket, extraType: outcome.extraType,
    }));

    if (outcome.isWicket) {
      strikerIdx = Math.max(strikerIdx, nonStrikerIdx) + 1;
      if (strikerIdx >= batsmen.length) break;
    } else if (legal && outcome.runs % 2 === 1) {
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }
  }

  return { balls: legalBalls, runs, wickets, dots, boundaries, firstWicketBall, durations: [], useModel: opts.useModel };
}

function aggregate(metrics: InningsMetrics[]) {
  const n = metrics.length;
  const sum = (f: (m: InningsMetrics) => number) => metrics.reduce((s, m) => s + f(m), 0);
  return {
    n,
    wicketsPerInnings: sum((m) => m.wickets) / n,
    runRate: sum((m) => m.runs) / sum((m) => m.balls) * 6,
    dotPct: sum((m) => m.dots) / sum((m) => m.balls) * 100,
    boundaryPct: sum((m) => m.boundaries) / sum((m) => m.balls) * 100,
    firstWicketTimings: metrics.map((m) => m.firstWicketBall ?? m.balls),
  };
}

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function runFormat(format: ArenaFormat) {
  const cfg = CALIBRATION[format];
  const metrics: InningsMetrics[] = [];
  for (let i = 0; i < cfg.inningsCount; i++) metrics.push(simulateInnings(format, { useModel: true }));
  return { cfg, ...aggregate(metrics) };
}

describe('Section 12-G: format calibration diagnostics (T20 / ODI / Test)', () => {
  it('T20 innings stay inside realistic calibration bands', () => {
    const r = runFormat('T20');
    console.log('[T20]', r);
    expect(r.wicketsPerInnings).toBeGreaterThanOrEqual(r.cfg.wicketsPerInnings[0]);
    expect(r.wicketsPerInnings).toBeLessThanOrEqual(r.cfg.wicketsPerInnings[1]);
    expect(r.runRate).toBeGreaterThanOrEqual(r.cfg.runRate[0]);
    expect(r.runRate).toBeLessThanOrEqual(r.cfg.runRate[1]);
    expect(r.dotPct).toBeGreaterThanOrEqual(r.cfg.dotPct[0]);
    expect(r.dotPct).toBeLessThanOrEqual(r.cfg.dotPct[1]);
    expect(r.boundaryPct).toBeGreaterThanOrEqual(r.cfg.boundaryPct[0]);
    expect(r.boundaryPct).toBeLessThanOrEqual(r.cfg.boundaryPct[1]);
  }, 60000);

  it('ODI innings stay inside realistic calibration bands', () => {
    const r = runFormat('ODI');
    console.log('[ODI]', r);
    expect(r.wicketsPerInnings).toBeGreaterThanOrEqual(r.cfg.wicketsPerInnings[0]);
    expect(r.wicketsPerInnings).toBeLessThanOrEqual(r.cfg.wicketsPerInnings[1]);
    expect(r.runRate).toBeGreaterThanOrEqual(r.cfg.runRate[0]);
    expect(r.runRate).toBeLessThanOrEqual(r.cfg.runRate[1]);
    expect(r.dotPct).toBeGreaterThanOrEqual(r.cfg.dotPct[0]);
    expect(r.dotPct).toBeLessThanOrEqual(r.cfg.dotPct[1]);
    expect(r.boundaryPct).toBeGreaterThanOrEqual(r.cfg.boundaryPct[0]);
    expect(r.boundaryPct).toBeLessThanOrEqual(r.cfg.boundaryPct[1]);
  }, 60000);

  it('Test innings stay inside realistic calibration bands (patient, higher dot %)', () => {
    const r = runFormat('TEST');
    console.log('[TEST]', r);
    expect(r.wicketsPerInnings).toBeGreaterThanOrEqual(r.cfg.wicketsPerInnings[0]);
    expect(r.wicketsPerInnings).toBeLessThanOrEqual(r.cfg.wicketsPerInnings[1]);
    expect(r.runRate).toBeGreaterThanOrEqual(r.cfg.runRate[0]);
    expect(r.runRate).toBeLessThanOrEqual(r.cfg.runRate[1]);
    expect(r.dotPct).toBeGreaterThanOrEqual(r.cfg.dotPct[0]);
    expect(r.dotPct).toBeLessThanOrEqual(r.cfg.dotPct[1]);
    expect(r.boundaryPct).toBeGreaterThanOrEqual(r.cfg.boundaryPct[0]);
    expect(r.boundaryPct).toBeLessThanOrEqual(r.cfg.boundaryPct[1]);
    // Test cricket must be materially more patient than T20.
    expect(r.dotPct).toBeGreaterThan(45);
  }, 60000);

  it('format personality ordering holds: Test dots > ODI dots > T20 dots, and T20 boundaries are highest', () => {
    const t20 = runFormat('T20');
    const odi = runFormat('ODI');
    const test = runFormat('TEST');
    expect(test.dotPct).toBeGreaterThan(odi.dotPct);
    expect(odi.dotPct).toBeGreaterThan(t20.dotPct);
    expect(t20.boundaryPct).toBeGreaterThan(test.boundaryPct);
  }, 120000);
});

describe('Section 12-B: no forced wickets, no guaranteed survival', () => {
  it('does not guarantee a wicket in the first over, nor guarantee survival for an arbitrary period', () => {
    const total = 120;
    let wicketInFirstOver = 0;
    const firstWicketTimings: number[] = [];
    for (let i = 0; i < total; i++) {
      const m = simulateInnings('T20', { useModel: true });
      if (m.firstWicketBall !== null && m.firstWicketBall <= 6) wicketInFirstOver++;
      firstWicketTimings.push(m.firstWicketBall ?? m.balls);
    }
    // Wickets may fall early, but never in *every* innings (no guarantee)...
    expect(wicketInFirstOver).toBeLessThan(total);
    // ...and early wickets are the exception, not the rule.
    expect(wicketInFirstOver).toBeLessThan(total * 0.6);
    // ...and batters are never guaranteed survival either â€” wickets do fall.
    expect(firstWicketTimings.filter((b) => b < 120).length).toBeGreaterThan(total * 0.5);
    // First-wicket timing genuinely varies innings to innings.
    expect(stddev(firstWicketTimings)).toBeGreaterThan(3);
  }, 60000);

  it('produces long wicketless passages as well as collapse periods (unpredictable, not manipulated)', () => {
    const timings: number[] = [];
    const inningsWickets: number[] = [];
    for (let i = 0; i < 120; i++) {
      const m = simulateInnings('T20', { useModel: true });
      timings.push(m.firstWicketBall ?? m.balls);
      inningsWickets.push(m.wickets);
    }
    // Some innings see a long first-wicket stand; others lose one early.
    expect(Math.max(...timings)).toBeGreaterThan(24);
    expect(Math.min(...timings)).toBeLessThanOrEqual(12);
    expect(stddev(inningsWickets)).toBeGreaterThan(0.5);
  }, 60000);
});

describe('Section 12-E/F: one coordinated, deterministic decision per delivery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('applies the field model deterministically to a seeded delivery stream', () => {
    const makeSeed = () => {
      let s = 987654321;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    };
    const striker = makeBatters()[2];
    const bowler = makeBowlers()[0];
    const pitch = PitchType.BALANCED;
    const weather = WeatherCondition.SUNNY;

    const runWith = (model: any) => {
      const rng = makeSeed();
      vi.spyOn(Math, 'random').mockImplementation(rng);
      let boundaries = 0;
      let wickets = 0;
      for (let i = 0; i < 3000; i++) {
        const out = MatchEngine.simulateBall(
          striker, bowler, 10, 4, 8, pitch, weather,
          undefined, undefined, ['1', '0', '2'], false, 0, 'T20',
          'NORMAL', undefined, undefined, model
        );
        if (out.runs === 4 || out.runs === 6) boundaries++;
        if (out.isWicket) wickets++;
      }
      vi.restoreAllMocks();
      return { boundaries, wickets };
    };

    const suppressModel = { ...neutralDeliveryModel(), boundarySuppression: 0.7 };
    const inviteModel = { ...neutralDeliveryModel(), boundarySuppression: 1.22 };

    const suppressed = runWith(suppressModel);
    const invited = runWith(inviteModel);

    // A boundary-protecting field must suppress boundaries versus an open field,
    // on the exact same delivery stream.
    expect(suppressed.boundaries).toBeLessThan(invited.boundaries);
  });

  it('the wicket-opportunity factor nudges (never forces) dismissals on a seeded stream', () => {
    const makeSeed = () => {
      let s = 24681357;
      return () => {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
      };
    };
    const striker = makeBatters()[8]; // tail-ish
    const bowler = makeBowlers()[0];

    const runWith = (wicketOpportunity: number) => {
      const rng = makeSeed();
      vi.spyOn(Math, 'random').mockImplementation(rng);
      let wickets = 0;
      for (let i = 0; i < 4000; i++) {
        const out = MatchEngine.simulateBall(
          striker, bowler, 10, 4, 8, PitchType.BALANCED, WeatherCondition.SUNNY,
          undefined, undefined, [], false, 0, 'T20', 'NORMAL', undefined, undefined,
          { ...neutralDeliveryModel(), wicketOpportunity }
        );
        if (out.isWicket) wickets++;
      }
      vi.restoreAllMocks();
      return wickets;
    };

    const low = runWith(0.90);
    const high = runWith(1.12);
    // Bounded influence: the field can make wickets somewhat more/less likely,
    // but the difference stays modest (never a guarantee, never zero).
    expect(high).toBeGreaterThanOrEqual(low);
    expect(high / Math.max(1, low)).toBeLessThan(1.6);
  });
});
