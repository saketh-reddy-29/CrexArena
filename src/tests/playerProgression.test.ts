import { describe, it, expect } from 'vitest';
import { ProgressionEngine, PerformanceInput } from '../engine/players/progressionEngine';
import { ArenaDatabase } from '../engine/storage/Database';
import { MatchTransactionPipeline } from '../engine/core/MatchTransactionPipeline';
import { RulesEngine } from '../engine/rules/RulesEngine';
import { getRulesEngineForFormat } from '../engine/rules/FormatRules';
import { Player } from '../types/common';
import { testBattingAI } from '../engine/formats/test/testBattingAI';
import { testDeliveryEngine } from '../engine/formats/test/TestDeliveryEngine';
import { getPlayerRating, getPlayerForm } from '../lib/ratingEngine';

const mockPlayer: Player = {
  id: 'kohli-1',
  name: 'Virat Kohli',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 88,
  baseAbility: 88,
  form: 80,
  basePrice: 20000000,
  stats: { batting: 88, bowling: 25, fielding: 84 },
  careerStats: {
    matches: 0,
    runs: 0,
    wickets: 0,
    ballsFaced: 0,
    ballsBowled: 0,
    runsConceded: 0,
    dismissals: 0,
    catches: 0,
  }
};

describe('Player Development & Arena Isolation System', () => {
  it('initializes a fresh player state for a new Arena with 0 matches and no-data form', () => {
    const arenaA = 'arena_A';
    const stateA = ProgressionEngine.createInitialState(arenaA, mockPlayer, 'ODI');

    expect(stateA.arenaId).toBe('arena_A');
    expect(stateA.playerId).toBe('kohli-1');
    expect(stateA.format).toBe('ODI');
    expect(stateA.recentMatchCount).toBe(0);
    expect(stateA.hasRecentMatches).toBe(false);
    expect(stateA.recentRuns).toBe(0);
    expect(stateA.recentWickets).toBe(0);
    expect(stateA.currentRating).toBe(88);

    const formStatus = getPlayerForm(mockPlayer, 'ODI', stateA);
    expect(formStatus.value).toBeNull();
    expect(formStatus.label).toBe('NO MATCHES');
    expect(formStatus.recentMatches).toBe(0);
  });

  it('updates recent matches and form deterministically after 1 match and 5 matches', () => {
    const arenaA = 'arena_A';
    let state = ProgressionEngine.createInitialState(arenaA, mockPlayer, 'ODI');

    // 1st Match: Scored 85 off 90 balls
    const match1: PerformanceInput = {
      matchId: 'm1',
      date: 1000,
      format: 'ODI',
      runs: 85,
      balls: 90,
      fours: 8,
      sixes: 1,
      isOut: false,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      catches: 1,
      stumpings: 0,
      runOuts: 0,
    };

    const res1 = ProgressionEngine.processMatchPerformance(state, match1, 'Batsman');
    state = res1.updatedState;

    expect(state.recentMatchCount).toBe(1);
    expect(state.hasRecentMatches).toBe(true);
    expect(state.recentRuns).toBe(85);
    expect(state.careerStats.runs).toBe(85);
    expect(state.careerStats.matches).toBe(1);
    expect(state.formRating).toBeGreaterThan(75); // improved form
    expect(state.currentRating).toBeGreaterThanOrEqual(88); // good performance gives small rating increase

    // Simulate 4 more matches
    for (let i = 2; i <= 5; i++) {
      const matchInput: PerformanceInput = {
        matchId: `m${i}`,
        date: 1000 + i,
        format: 'ODI',
        runs: 60,
        balls: 65,
        fours: 5,
        sixes: 0,
        isOut: true,
        overs: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        catches: 0,
        stumpings: 0,
        runOuts: 0,
      };
      state = ProgressionEngine.processMatchPerformance(state, matchInput, 'Batsman').updatedState;
    }

    expect(state.recentMatchCount).toBe(5);
    expect(state.recentMatches.length).toBe(5);
    expect(state.careerStats.matches).toBe(5);
    expect(state.recentRuns).toBe(85 + 4 * 60);

    const form5 = getPlayerForm(mockPlayer, 'ODI', state);
    expect(form5.value).toBe(state.formRating);
    expect(form5.recentMatches).toBe(5);
    expect(form5.label).toBeDefined();
  });

  it('keeps Arena A and Arena B completely isolated for the same real-world player', () => {
    const arenaA = 'arena_alpha';
    const arenaB = 'arena_beta';

    // In Arena A, player plays 3 high-scoring matches
    let stateA = ProgressionEngine.createInitialState(arenaA, mockPlayer, 'T20');
    for (let i = 1; i <= 3; i++) {
      stateA = ProgressionEngine.processMatchPerformance(stateA, {
        matchId: `mA_${i}`,
        format: 'T20',
        runs: 75,
        balls: 40,
        fours: 8,
        sixes: 4,
        isOut: false,
        overs: 0,
        maidens: 0,
        runsConceded: 0,
        wickets: 0,
        catches: 1,
        stumpings: 0,
        runOuts: 0,
      }, 'Batsman').updatedState;
    }

    // In Arena B, create fresh arena
    const stateB = ProgressionEngine.createInitialState(arenaB, mockPlayer, 'T20');

    // Verify Arena A has 3 matches and high rating/form
    expect(stateA.recentMatchCount).toBe(3);
    expect(stateA.recentRuns).toBe(225);
    expect(stateA.careerStats.matches).toBe(3);

    // Verify Arena B is completely fresh and unaffected
    expect(stateB.recentMatchCount).toBe(0);
    expect(stateB.hasRecentMatches).toBe(false);
    expect(stateB.recentRuns).toBe(0);
    expect(stateB.careerStats.matches).toBe(0);
    expect(stateB.currentRating).toBe(88);

    // Global player remains unmodified
    expect(mockPlayer.baseAbility).toBe(88);
  });

  it('supports format-independent development across IPL, T20, ODI, and TEST', () => {
    const arenaId = 'arena_multi_format';

    const stateIPL = ProgressionEngine.createInitialState(arenaId, mockPlayer, 'IPL');
    const stateT20 = ProgressionEngine.createInitialState(arenaId, mockPlayer, 'T20');
    const stateODI = ProgressionEngine.createInitialState(arenaId, mockPlayer, 'ODI');
    const stateTEST = ProgressionEngine.createInitialState(arenaId, mockPlayer, 'TEST');

    // Simulate match in IPL only
    const updatedIPL = ProgressionEngine.processMatchPerformance(stateIPL, {
      matchId: 'ipl_1',
      format: 'IPL',
      runs: 95,
      balls: 50,
      fours: 10,
      sixes: 5,
      isOut: false,
      overs: 0,
      maidens: 0,
      runsConceded: 0,
      wickets: 0,
      catches: 2,
      stumpings: 0,
      runOuts: 0,
    }, 'Batsman').updatedState;

    // IPL should advance
    expect(updatedIPL.recentMatchCount).toBe(1);
    expect(updatedIPL.recentRuns).toBe(95);

    // Other formats remain at 0 matches
    expect(stateT20.recentMatchCount).toBe(0);
    expect(stateODI.recentMatchCount).toBe(0);
    expect(stateTEST.recentMatchCount).toBe(0);
  });

  it('verifies Test batter settling phases based on balls faced', () => {
    // 0-5 balls: SURVIVAL
    expect(testBattingAI.getBattingIntentCategory(0)).toBe('SURVIVAL');
    expect(testBattingAI.getBattingIntentCategory(3)).toBe('SURVIVAL');
    expect(testBattingAI.getBattingIntentCategory(5)).toBe('SURVIVAL');

    // 6-15 balls: SETTLING
    expect(testBattingAI.getBattingIntentCategory(6)).toBe('SETTLING');
    expect(testBattingAI.getBattingIntentCategory(15)).toBe('SETTLING');

    // 16-30 balls: CONTROLLED_ATTACK
    expect(testBattingAI.getBattingIntentCategory(16)).toBe('CONTROLLED_ATTACK');
    expect(testBattingAI.getBattingIntentCategory(30)).toBe('CONTROLLED_ATTACK');

    // 31+ balls: NORMAL
    expect(testBattingAI.getBattingIntentCategory(31)).toBe('NORMAL');
    expect(testBattingAI.getBattingIntentCategory(100)).toBe('NORMAL');

    // Settledness increases with balls survived
    const set0 = testBattingAI.calculateSettledness(0);
    const set5 = testBattingAI.calculateSettledness(5);
    const set15 = testBattingAI.calculateSettledness(15);
    const set30 = testBattingAI.calculateSettledness(30);
    const set50 = testBattingAI.calculateSettledness(50);

    expect(set0).toBe(0);
    expect(set5).toBe(15);
    expect(set15).toBe(45);
    expect(set30).toBe(75);
    expect(set50).toBe(90);
  });

  it('transactional database rolls back cleanly on error', async () => {
    const testDb = new ArenaDatabase();
    await testDb.beginTransaction();

    const state = ProgressionEngine.createInitialState('t_arena', mockPlayer, 'ODI');
    await testDb.savePlayerState(state);

    // Rollback
    await testDb.rollbackTransaction();

    const retrieved = await testDb.getPlayerState('t_arena', mockPlayer.id, 'ODI');
    expect(retrieved).toBeUndefined();
  });
});
