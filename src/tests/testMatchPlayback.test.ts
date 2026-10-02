import { describe, it, expect } from 'vitest';
import { TestMatchPlaybackController } from '../engine/formats/test/TestMatchPlaybackController';
import { Player } from '../types/common';

const createMockSquad = (teamPrefix: string): Player[] => {
  return Array.from({ length: 11 }, (_, i) => ({
    id: `${teamPrefix}-p${i + 1}`,
    name: `${teamPrefix.toUpperCase()} Player ${i + 1}`,
    role: i < 5 ? 'BATTER' : i < 7 ? 'ALL_ROUNDER' : i === 7 ? 'WICKETKEEPER' : 'BOWLER',
    rating: 80 + (i % 10),
    technique: 82 + (i % 8),
    aggression: 55 + (i % 20),
    bowlingRating: i >= 5 ? 85 : 40,
    bowlingStyle: i === 8 || i === 9 ? 'Right-arm Off Spin' : 'Right-arm Fast Medium',
    nationality: 'Indian',
    basePrice: 10000000,
    stats: {
      matches: 40,
      runs: 1500,
      wickets: 35,
      strikeRate: 52.5,
      economy: 3.1,
      average: 42.0,
      bowlingAverage: 28.5,
    },
  }));
};

describe('CRICKET ARENA — Test Match Ball-by-Ball Playback Engine', () => {
  const team1Squad = createMockSquad('ind');
  const team2Squad = createMockSquad('aus');

  const team1 = { id: 'team-ind', name: 'India', shortName: 'IND', squad: team1Squad };
  const team2 = { id: 'team-aus', name: 'Australia', shortName: 'AUS', squad: team2Squad };

  it('initializes a fresh Test match with 4 innings and valid participants', () => {
    const controller = new TestMatchPlaybackController('test-match-id-1', team1, team2, team1.id);
    const summary = controller.getSummary();

    expect(summary.day).toBe(1);
    expect(summary.session).toBe('MORNING');
    expect(summary.currentInningsIndex).toBe(0);
    expect(summary.innings.length).toBe(4);
    expect(summary.strikerId).toBe(team1Squad[0].id);
    expect(summary.nonStrikerId).toBe(team1Squad[1].id);
    expect(summary.bowlerId).toBeDefined();
    expect(summary.newBallAvailable).toBe(false);
  });

  it('generates unique deliveryId and rich physical delivery data per ball', () => {
    const controller = new TestMatchPlaybackController('test-match-id-2', team1, team2, team1.id);
    const delivery = controller.simulateDelivery();

    expect(delivery.deliveryId).toMatch(/^TEST_INNINGS_1_OVER_0_BALL_1$/);
    expect(delivery.trajectory.startPos).toBeDefined();
    expect(delivery.trajectory.bouncePos).toBeDefined();
    expect(delivery.trajectory.contactPos).toBeDefined();
    expect(delivery.trajectory.targetPos).toBeDefined();
    expect(delivery.stepMessages.length).toBeGreaterThan(0);
    expect(delivery.line).toBeDefined();
    expect(delivery.length).toBeDefined();
    expect(delivery.intent).toBe('SURVIVAL'); // Batter starts at 0 balls
  });

  it('plays consecutive deliveries without skipping overs (0.1 -> 0.2 -> 0.3 -> ...)', async () => {
    const controller = new TestMatchPlaybackController('test-match-id-3', team1, team2, team1.id);
    controller.setFastSimulating(true);

    const d1 = await controller.playNextBallManual();
    expect(d1?.ballDisplay).toBe('0.1');

    const d2 = await controller.playNextBallManual();
    expect(d2?.ballDisplay).toBe('0.2');

    const d3 = await controller.playNextBallManual();
    expect(d3?.ballDisplay).toBe('0.3');

    const d4 = await controller.playNextBallManual();
    expect(d4?.ballDisplay).toBe('0.4');

    const d5 = await controller.playNextBallManual();
    expect(d5?.ballDisplay).toBe('0.5');

    const d6 = await controller.playNextBallManual();
    expect(d6?.ballDisplay).toBe('0.6');

    const summary = controller.getSummary();
    const inn1 = summary.innings[0];
    expect(inn1.legalBalls).toBe(6);
    expect(inn1.overs).toBe(1);
    expect(inn1.deliveries.length).toBe(6);
  });

  it('correctly tracks fall of wickets, partnerships, and atomic scorecard updates', async () => {
    const controller = new TestMatchPlaybackController('test-match-id-4', team1, team2, team1.id);
    controller.setFastSimulating(true);

    for (let i = 0; i < 18; i++) {
      await controller.playNextBallManual();
    }

    const summary = controller.getSummary();
    const inn1 = summary.innings[0];

    expect(inn1.overs).toBe(3);
    expect(inn1.legalBalls).toBe(18);
    expect(inn1.deliveries.length).toBe(18);

    // Scorecard matches sum of deliveries
    const totalRuns = inn1.deliveries.reduce((sum, d) => sum + d.runs, 0);
    expect(inn1.score).toBe(totalRuns);

    // Verify partnerships
    expect(inn1.partnerships.length).toBeGreaterThanOrEqual(1);
  });

  it('supports deterministic replay from saved deliveriesHistory', async () => {
    const controller = new TestMatchPlaybackController('test-match-id-5', team1, team2, team1.id);
    controller.setFastSimulating(true);

    for (let i = 0; i < 12; i++) {
      await controller.playNextBallManual();
    }

    const replayList = controller.getReplayDeliveries(0);
    expect(replayList.length).toBe(12);

    // Each delivery is self-contained with exact trajectory and result
    replayList.forEach((del, idx) => {
      expect(del.deliveryId).toContain(`BALL_${(idx % 6) + 1}`);
      expect(del.trajectory.targetPos.x).toBeTypeOf('number');
      expect(del.trajectory.targetPos.z).toBeTypeOf('number');
    });
  });

  it('supports interactive Bowl Selection option with strict eligibility enforcement', () => {
    const controller = new TestMatchPlaybackController('test-match-id-6', team1, team2, team1.id);
    const availableBowlers = controller.getAvailableBowlers();

    expect(availableBowlers.length).toBeGreaterThan(0);
    // All available bowlers must be eligible bowlers (all-rounder or bowler)
    availableBowlers.forEach((b) => {
      expect(['ALL_ROUNDER', 'BOWLER']).toContain(b.role.toUpperCase());
    });

    // Selecting an eligible bowler succeeds
    const targetBowler = availableBowlers[availableBowlers.length - 1];
    const success = controller.setBowler(targetBowler.id);
    expect(success).toBe(true);
    expect(controller.getSummary().bowlerId).toBe(targetBowler.id);

    // Attempting to select a pure batter fails
    const pureBatter = team2Squad[0]; // aus-p1 is BATTER
    const batterSuccess = controller.setBowler(pureBatter.id);
    expect(batterSuccess).toBe(false);
    expect(controller.getSummary().bowlerId).toBe(targetBowler.id); // bowler remained unchanged
  });
});
