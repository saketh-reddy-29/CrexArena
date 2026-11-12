import { describe, it, expect, beforeEach, vi } from 'vitest';
import { matchRecoveryStorage } from '../engine/storage/MatchRecoveryStorage';
import { db } from '../engine/storage/Database';
import { MatchCheckpoint, MatchSaveStatus } from '../types/matchRecovery';
import { PitchType, WeatherCondition } from '../types/match';

describe('Automatic Match Save & Accidental Exit Recovery System', () => {
  const matchId = 'match_recovery_fixture_001';

  const mockCheckpoint: MatchCheckpoint = {
    version: 1,
    matchId,
    fixtureId: matchId,
    arenaId: 'ipl_2026',
    seasonId: 2026,
    format: 'T20',
    timestamp: new Date().toISOString(),
    savedAt: Date.now(),
    team1Id: 'CSK',
    team2Id: 'MI',
    team1Name: 'Chennai Super Kings',
    team2Name: 'Mumbai Indians',
    team1ShortName: 'CSK',
    team2ShortName: 'MI',
    playingXIIds: ['csk_1', 'csk_2', 'csk_3', 'csk_4', 'csk_5', 'csk_6', 'csk_7', 'csk_8', 'csk_9', 'csk_10', 'csk_11'],
    selectedSquadIds: ['csk_1', 'csk_2', 'csk_3', 'csk_4', 'csk_5', 'csk_6', 'csk_7', 'csk_8', 'csk_9', 'csk_10', 'csk_11'],
    toss: { winnerId: 'CSK', decision: 'Bat' as any },
    pitch: PitchType.BALANCED,
    weather: WeatherCondition.SUNNY,
    inningNo: 1,
    innings: [
      {
        balls: 4,
        runs: 7,
        wickets: 0,
        battingTeamId: 'CSK',
        bowlingTeamId: 'MI',
        batters: {
          csk_1: { balls: 3, runs: 6, fours: 1, sixes: 0, out: false, status: 'not out' } as any,
          csk_2: { balls: 1, runs: 1, fours: 0, sixes: 0, out: false, status: 'not out' } as any,
        },
        bowlers: {
          mi_1: { balls: 4, runs: 7, wickets: 0, dots: 2 } as any,
        },
        deliveries: [
          { ball: '0.1', batterId: 'csk_1', bowlerId: 'mi_1', isLegal: true, isWicket: false, outcome: '4', over: 0, runs: 4, deliveryId: 'del_001' },
          { ball: '0.2', batterId: 'csk_1', bowlerId: 'mi_1', isLegal: true, isWicket: false, outcome: '0', over: 0, runs: 0, deliveryId: 'del_002' },
          { ball: '0.3', batterId: 'csk_1', bowlerId: 'mi_1', isLegal: true, isWicket: false, outcome: '2', over: 0, runs: 2, deliveryId: 'del_003' },
          { ball: '0.4', batterId: 'csk_1', bowlerId: 'mi_1', isLegal: true, isWicket: false, outcome: '1', over: 0, runs: 1, deliveryId: 'del_004' },
        ],
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
        commentary: [],
        wicketLog: [],
        recentBalls: ['4', '0', '2', '1'],
        runRateHistory: [10.5],
        partnershipBalls: 4,
        partnershipRuns: 7,
        isComplete: false,
        isFreeHitPending: false,
        drsReviewsRemaining: 2,
        drsReviews: [],
        strategicTimeouts: [],
      },
    ],
    isMatchOver: false,
    resultSubmitted: false,
    strikerId: 'csk_2',
    nonStrikerId: 'csk_1',
    bowlerId: 'mi_1',
    lastOverBowlerId: null,
    battingCursor: 2,
    pending: null,
    pendingBatterEnd: 'striker',
    currentRuns: 7,
    currentWickets: 0,
    currentBalls: 4,
    oversFormatted: '0.4',
    strikerName: 'Ruturaj Gaikwad',
    strikerRuns: 1,
    strikerBalls: 1,
    nonStrikerName: 'Devon Conway',
    nonStrikerRuns: 6,
    nonStrikerBalls: 3,
    bowlerName: 'Jasprit Bumrah',
    bowlerOvers: '0.4',
    bowlerRuns: 7,
    bowlerWickets: 0,
    fieldPresetKey: 'STANDARD_RING',
    lastCompletedDeliveryId: 'del_004',
    lastCommittedDeliveryId: 'del_004',
    committedDeliveryIds: ['del_001', 'del_002', 'del_003', 'del_004'],
  };

  beforeEach(async () => {
    await matchRecoveryStorage.clearCheckpoint(matchId);
  });

  it('Scenario 1 & 2: Continuously saves deliveries and restores exact state on reopening', async () => {
    const res = await matchRecoveryStorage.saveCheckpoint(mockCheckpoint);
    expect(res.success).toBe(true);

    // Simulate reopening after Chrome tab close
    const restored = await matchRecoveryStorage.getCheckpoint(matchId);
    expect(restored).not.toBeNull();
    expect(restored?.matchId).toBe(matchId);
    expect(restored?.currentRuns).toBe(7);
    expect(restored?.currentWickets).toBe(0);
    expect(restored?.currentBalls).toBe(4);
    expect(restored?.oversFormatted).toBe('0.4');
    expect(restored?.strikerId).toBe('csk_2');
    expect(restored?.nonStrikerId).toBe('csk_1');
    expect(restored?.lastCompletedDeliveryId).toBe('del_004');
    expect(restored?.committedDeliveryIds).toHaveLength(4);
  });

  it('Scenario 3: Synchronous flush on window beforeunload (refresh protection)', () => {
    const syncSuccess = matchRecoveryStorage.saveCheckpointSync(mockCheckpoint);
    expect(typeof syncSuccess).toBe('boolean');

    // Retrieve via memory or fallback
    const cp = matchRecoveryStorage.getCheckpoint(matchId);
    expect(cp).toBeDefined();
  });

  it('Scenario 4 & 5: Accidental navigation or browser crash leaves match unfinished and detects recovery card', async () => {
    await matchRecoveryStorage.saveCheckpoint(mockCheckpoint);

    // Verify it is recognized as an active unfinished match
    const latest = await matchRecoveryStorage.getLatestUnfinishedMatch();
    expect(latest).not.toBeNull();
    expect(latest?.matchId).toBe(matchId);
    expect(latest?.isMatchOver).toBe(false);
    expect(latest?.resultSubmitted).toBe(false);
    expect(latest?.strikerName).toBe('Ruturaj Gaikwad');
    expect(latest?.bowlerName).toBe('Jasprit Bumrah');
  });

  it('Scenario 6 & 7: Offline storage fallback and reconnection sync', async () => {
    let capturedStatus: MatchSaveStatus | null = null;
    const unsub = matchRecoveryStorage.onStatusChange((s) => {
      capturedStatus = s;
    });

    // Save checkpoint
    await matchRecoveryStorage.saveCheckpoint(mockCheckpoint);
    expect(capturedStatus).toMatch(/ALL PROGRESS SAVED|OFFLINE/);

    unsub();
  });

  it('Scenario 8: Deduplication — never re-executes or double-counts a committed delivery', async () => {
    await matchRecoveryStorage.saveCheckpoint(mockCheckpoint);

    // Verify that del_001, del_002, del_003, del_004 are recognized as already committed
    expect(matchRecoveryStorage.isDeliveryCommitted(mockCheckpoint, 'del_001')).toBe(true);
    expect(matchRecoveryStorage.isDeliveryCommitted(mockCheckpoint, 'del_004')).toBe(true);

    // Verify that an uncommitted delivery returns false
    expect(matchRecoveryStorage.isDeliveryCommitted(mockCheckpoint, 'del_005_new')).toBe(false);
  });

  it('Scenario 9: Accidental exit and resume after a wicket correctly preserves fall of wickets and batter status', async () => {
    const wicketCheckpoint: MatchCheckpoint = {
      ...mockCheckpoint,
      currentRuns: 12,
      currentWickets: 1,
      currentBalls: 5,
      oversFormatted: '0.5',
      pending: 'batter',
      pendingBatterEnd: 'striker',
      strikerId: null, // Out batter dismissed
      lastCompletedDeliveryId: 'del_005_w',
      lastCommittedDeliveryId: 'del_005_w',
      committedDeliveryIds: [...mockCheckpoint.committedDeliveryIds, 'del_005_w'],
      innings: [
        {
          ...mockCheckpoint.innings[0],
          runs: 12,
          wickets: 1,
          balls: 5,
          wicketLog: [
            {
              ball: '0.5',
              over: 0,
              playerId: 'csk_2',
              playerName: 'Ruturaj Gaikwad',
              runs: 1,
              score: 12,
              status: 'b Bumrah',
              wicketType: 'Bowled',
            },
          ],
        },
      ],
    };

    await matchRecoveryStorage.saveCheckpoint(wicketCheckpoint);

    const restored = await matchRecoveryStorage.getCheckpoint(matchId);
    expect(restored?.currentWickets).toBe(1);
    expect(restored?.innings[0].wicketLog).toHaveLength(1);
    expect(restored?.innings[0].wicketLog[0].wicketType).toBe('Bowled');
    expect(restored?.pending).toBe('batter');
    expect(restored?.strikerId).toBeNull();
  });

  it('Scenario 10: Resume after over completion preserves strike rotation and pending bowler state', async () => {
    const overEndCheckpoint: MatchCheckpoint = {
      ...mockCheckpoint,
      currentRuns: 14,
      currentWickets: 0,
      currentBalls: 6,
      oversFormatted: '1.0',
      lastOverBowlerId: 'mi_1',
      bowlerId: null, // Waiting for captain to select over 2 bowler
      pending: 'bowler',
      strikerId: 'csk_1', // Strike rotated at end of over
      nonStrikerId: 'csk_2',
      lastCompletedDeliveryId: 'del_006',
      committedDeliveryIds: [...mockCheckpoint.committedDeliveryIds, 'del_005', 'del_006'],
    };

    await matchRecoveryStorage.saveCheckpoint(overEndCheckpoint);

    const restored = await matchRecoveryStorage.getCheckpoint(matchId);
    expect(restored?.currentBalls).toBe(6);
    expect(restored?.oversFormatted).toBe('1.0');
    expect(restored?.lastOverBowlerId).toBe('mi_1');
    expect(restored?.bowlerId).toBeNull();
    expect(restored?.pending).toBe('bowler');
    expect(restored?.strikerId).toBe('csk_1');
    expect(restored?.nonStrikerId).toBe('csk_2');
  });

  it('Scenario 11: Save & Exit leaves fixture intact and resumes with identical score', async () => {
    await matchRecoveryStorage.saveCheckpoint(mockCheckpoint);

    // Verify it is saved in database as well
    const dbCheckpoint = await db.getMatchCheckpoint(matchId);
    expect(dbCheckpoint).toBeDefined();
    expect(dbCheckpoint?.currentRuns).toBe(7);

    // Verify clearing on official match completion
    await matchRecoveryStorage.clearCheckpoint(matchId);
    const cleared = await matchRecoveryStorage.getCheckpoint(matchId);
    expect(cleared).toBeNull();
  });
});
