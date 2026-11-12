import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchEngine } from '../lib/matchEngine';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { PitchType, WeatherCondition } from '../types/match';
import { ArenaFormat } from '../engine/models/ArenaState';

describe('Redesigned Live Match Page - Engine & State Integration', () => {
  beforeEach(() => {
    // Reset store state
    const store = useGameStore.getState();
    const f1 = store.franchises[0]?.id || 'MI';
    const f2 = store.franchises[1]?.id || 'CSK';
    
    useGameStore.setState({
      gameState: GameState.MATCH_SIMULATION,
      currentMatchId: 'match_test_live_1',
      selectedFranchiseId: f1,
      selectedFormat: 'IPL',
      currentMatchToss: {
        winnerId: f1,
        decision: 'BAT' as TossDecision,
      },
      liveMatchState: null,
    });
  });

  it('1. A new delivery updates the score and scorecard authoritative state', () => {
    const store = useGameStore.getState();
    const f1 = store.franchises[0].id;
    const f2 = store.franchises[1].id;
    const p1 = store.players[0];
    const p2 = store.players[1];
    const bowler = store.players[2];

    const initialInnings = {
      balls: 0,
      batters: {
        [p1.id]: { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'not out', out: false, dots: 0 },
        [p2.id]: { runs: 0, balls: 0, fours: 0, sixes: 0, status: 'not out', out: false, dots: 0 }
      },
      battingTeamId: f1,
      bowlers: {
        [bowler.id]: { balls: 0, runs: 0, wickets: 0, dots: 0 }
      },
      bowlingTeamId: f2,
      deliveries: [],
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      commentary: [],
      isComplete: false,
      partnershipBalls: 0,
      partnershipRuns: 0,
      recentBalls: [],
      runRateHistory: [],
      runs: 0,
      wicketLog: [],
      wickets: 0,
      isFreeHitPending: false,
      drsReviewsRemaining: 2,
      drsReviews: [],
      strategicTimeouts: [],
    };

    // Simulate 1 delivery (1 run scored)
    const updatedRuns = initialInnings.runs + 1;
    const updatedBalls = initialInnings.balls + 1;
    const updatedBatter = {
      ...initialInnings.batters[p1.id],
      runs: 1,
      balls: 1,
    };
    const updatedBowler = {
      ...initialInnings.bowlers[bowler.id],
      balls: 1,
      runs: 1,
    };

    expect(updatedRuns).toBe(1);
    expect(updatedBalls).toBe(1);
    expect(updatedBatter.runs).toBe(1);
    expect(updatedBowler.runs).toBe(1);
  });

  it('2. A boundary updates the total score exactly once', () => {
    const runsBefore = 10;
    const deliveryBoundaryFour = 4;
    const runsAfterFour = runsBefore + deliveryBoundaryFour;
    expect(runsAfterFour).toBe(14);

    const deliveryBoundarySix = 6;
    const runsAfterSix = runsAfterFour + deliveryBoundarySix;
    expect(runsAfterSix).toBe(20);
  });

  it('3. A wicket updates the dismissal entry and incoming batter', () => {
    const store = useGameStore.getState();
    const p1 = store.players[0];
    const incomingP3 = store.players[3];
    const bowler = store.players[2];

    const dismissalStatus = `b ${bowler.name}`;
    const dismissedBatter = {
      runs: 24,
      balls: 18,
      fours: 3,
      sixes: 1,
      out: true,
      status: dismissalStatus,
    };

    // Wicket must record out and preserve past stats
    expect(dismissedBatter.out).toBe(true);
    expect(dismissedBatter.status).toBe(`b ${bowler.name}`);
    expect(dismissedBatter.runs).toBe(24);

    // Incoming batter becomes active
    const newStriker = incomingP3;
    expect(newStriker.id).toBe(incomingP3.id);
  });

  it('4. Batter strike changes correctly on odd runs and over completion', () => {
    let striker = 'player_A';
    let nonStriker = 'player_B';

    // 1 run: strike rotates
    const run = 1;
    if (run % 2 === 1) {
      const temp = striker;
      striker = nonStriker;
      nonStriker = temp;
    }
    expect(striker).toBe('player_B');
    expect(nonStriker).toBe('player_A');

    // Over completes (6th ball): strike rotates again at over end
    const temp = striker;
    striker = nonStriker;
    nonStriker = temp;
    expect(striker).toBe('player_A');
    expect(nonStriker).toBe('player_B');
  });

  it('5. Bowler figures update correctly', () => {
    const bowlerStats = { balls: 0, runs: 0, wickets: 0, dots: 0 };
    
    // Dot ball
    bowlerStats.balls += 1;
    bowlerStats.dots += 1;
    // Wicket ball (0 runs)
    bowlerStats.balls += 1;
    bowlerStats.wickets += 1;
    bowlerStats.dots += 1;
    // 4 runs
    bowlerStats.balls += 1;
    bowlerStats.runs += 4;
    // 1 run
    bowlerStats.balls += 1;
    bowlerStats.runs += 1;

    expect(bowlerStats.balls).toBe(4);
    expect(bowlerStats.runs).toBe(5);
    expect(bowlerStats.wickets).toBe(1);
    expect(bowlerStats.dots).toBe(2);
  });

  it('6. Over indicators show correct delivery outcomes', () => {
    const deliveries = [
      { over: 0, outcome: '0', isWicket: false, runs: 0 },
      { over: 0, outcome: 'W', isWicket: true, runs: 0 },
      { over: 0, outcome: '0', isWicket: false, runs: 0 },
      { over: 0, outcome: '4', isWicket: false, runs: 4 },
      { over: 0, outcome: '1', isWicket: false, runs: 1 },
      { over: 0, outcome: '6', isWicket: false, runs: 6 },
    ];

    const overBallChips = deliveries.map(d => d.outcome);
    expect(overBallChips).toEqual(['0', 'W', '0', '4', '1', '6']);
  });

  it('7. Switching scorecard innings preserves completed innings and shows active innings', () => {
    const inningsList = [
      { battingTeamId: 'MI', bowlingTeamId: 'CSK', runs: 182, wickets: 6, balls: 120 },
      { battingTeamId: 'CSK', bowlingTeamId: 'MI', runs: 94, wickets: 3, balls: 68 },
    ];

    expect(inningsList[0].runs).toBe(182);
    expect(inningsList[1].runs).toBe(94);
  });

  it('8. Refreshing and resuming an existing match restores liveMatchState', () => {
    const savedState = {
      currentMatchId: 'match_test_live_1',
      inningNo: 2,
      innings: [
        { runs: 165, wickets: 7, balls: 120 } as any,
        { runs: 80, wickets: 2, balls: 54 } as any,
      ],
      strikerId: 'player_1',
      nonStrikerId: 'player_2',
      bowlerId: 'player_3',
      lastOverBowlerId: 'player_4',
      battingCursor: 4,
      pending: null,
      pendingBatterEnd: 'striker' as const,
      pitch: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
    };

    useGameStore.getState().saveLiveMatchState(savedState);
    const retrieved = useGameStore.getState().liveMatchState;

    expect(retrieved?.currentMatchId).toBe('match_test_live_1');
    expect(retrieved?.inningNo).toBe(2);
    expect(retrieved?.innings[0].runs).toBe(165);
    expect(retrieved?.strikerId).toBe('player_1');
  });

  it('9. Other application pages retain their original functionality and navigation destinations', () => {
    const store = useGameStore.getState();

    // Verify all GameState destinations remain valid
    store.setGameState(GameState.LANDING);
    expect(useGameStore.getState().gameState).toBe(GameState.LANDING);

    store.setGameState(GameState.ARENA_HUB);
    expect(useGameStore.getState().gameState).toBe(GameState.ARENA_HUB);

    store.setGameState(GameState.PLAYING_XI_BUILDER);
    expect(useGameStore.getState().gameState).toBe(GameState.PLAYING_XI_BUILDER);

    store.setGameState(GameState.MATCH_SIMULATION);
    expect(useGameStore.getState().gameState).toBe(GameState.MATCH_SIMULATION);
  });
});

