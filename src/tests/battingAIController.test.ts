import { describe, it, expect } from 'vitest';
import { Player } from '../types/common';
import {
  selectAINextBatter,
  selectAIOpeningBatters,
  getAvailableAIBatters,
  decideAIBattingIntent,
  type BattingAIInput,
} from '../engine/ai/BattingAIController';

function makeBatter(
  id: string,
  opts: { batting?: number; aggression?: number; temperament?: number; role?: Player['role'] } = {},
): Player {
  return {
    id,
    name: id,
    role: opts.role ?? 'Batsman',
    nationality: 'Indian',
    rating: opts.batting ?? 70,
    basePrice: 100,
    battingStyle: 'RHB',
    aggression: opts.aggression ?? 50,
    temperament: opts.temperament ?? 50,
    stamina: 80,
    baseAbility: 75,
    form: 60,
    stats: { batting: opts.batting ?? 60, bowling: 40, fielding: 70 },
    careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
  };
}

const top = [
  makeBatter('open1', { batting: 84, aggression: 70, temperament: 60 }),
  makeBatter('open2', { batting: 80, aggression: 50, temperament: 70 }),
  makeBatter('mid1', { batting: 82, aggression: 40, temperament: 90 }),
  makeBatter('mid2', { batting: 76, aggression: 95, temperament: 30 }),
  makeBatter('fin1', { batting: 74, aggression: 88, temperament: 40 }),
];

function baseInput(extra: Partial<BattingAIInput> = {}): BattingAIInput {
  return {
    format: 'T20',
    squad: top,
    batters: {},
    strikerId: 'open1',
    nonStrikerId: 'open2',
    wickets: 1,
    runs: 40,
    balls: 24,
    recentBalls: ['1', '4', '1'],
    ...extra,
  };
}

describe('BattingAIController — autonomous opponent batting', () => {
  it('follows the batting order by default after a wicket', () => {
    const sel = selectAINextBatter(baseInput());
    expect(sel.player!.id).toBe('mid1');
    expect(sel.reason).toBe('BATTING_ORDER');
  });

  it('promotes an aggressor when the required rate climbs', () => {
    const sel = selectAINextBatter(
      baseInput({ balls: 108, runs: 120, target: 180, wickets: 2 }),
    );
    expect(sel.reason).toBe('ACCELERATE');
    expect(sel.player!.id).toBe('mid2');
  });

  it('sends in an anchor during a collapse', () => {
    const sel = selectAINextBatter(baseInput({ wickets: 7, recentBalls: ['W', '1', 'W'] }));
    expect(sel.reason).toBe('STABILISE');
    expect(sel.player!.id).toBe('mid1');
  });

  it('never selects a dismissed or crease batter', () => {
    const sel = selectAINextBatter(
      baseInput({ batters: { mid1: { runs: 4, balls: 6, out: true } } }),
    );
    expect(sel.player!.id).toBe('mid2');
    expect(getAvailableAIBatters(baseInput()).map((p) => p.id)).not.toContain('open1');
  });

  it('selects two valid, distinct openers with the aggressor on strike', () => {
    const openers = selectAIOpeningBatters(baseInput({ strikerId: null, nonStrikerId: null }));
    expect(openers.striker).not.toBeNull();
    expect(openers.nonStriker).not.toBeNull();
    expect(openers.striker!.id).not.toBe(openers.nonStriker!.id);
    expect(openers.striker!.aggression ?? 0).toBeGreaterThanOrEqual(openers.nonStriker!.aggression ?? 0);
  });

  it('produces a valid batting intent from the decision engine', () => {
    const batter = makeBatter('mid1', { batting: 82 });
    const intent = decideAIBattingIntent(null, {
      format: 'T20',
      batter,
      score: 120,
      wickets: 2,
      balls: 90,
      target: 180,
    });
    expect(typeof intent).toBe('string');
    expect(intent.length).toBeGreaterThan(0);
  });
});
