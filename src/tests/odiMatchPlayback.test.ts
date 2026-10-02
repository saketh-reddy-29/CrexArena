import { describe, it, expect } from 'vitest';
import { ODIMatchPlaybackController } from '../engine/formats/odi/ODIMatchPlaybackController';
import { Player } from '../types/common';

const createMockSquad = (teamPrefix: string): Player[] => {
  return Array.from({ length: 11 }, (_, i) => ({
    id: `${teamPrefix}-p${i + 1}`,
    name: `${teamPrefix.toUpperCase()} Player ${i + 1}`,
    role: i < 5 ? 'BATTER' : i < 7 ? 'ALL_ROUNDER' : i === 7 ? 'WICKETKEEPER' : 'BOWLER',
    rating: 80 + (i % 10),
    technique: 82 + (i % 8),
    aggression: 65 + (i % 20),
    bowlingRating: i >= 5 ? 85 : 40,
    bowlingStyle: i === 8 || i === 9 ? 'Right-arm Off Spin' : 'Right-arm Fast Medium',
    nationality: 'Indian',
    basePrice: 10000000,
    stats: {
      matches: 40,
      runs: 1500,
      wickets: 35,
      strikeRate: 88.5,
      economy: 4.8,
      average: 44.0,
      bowlingAverage: 26.5,
    },
  }));
};

describe('CRICKET ARENA — Complete ODI Match Engine + 3D Playback', () => {
  const team1Squad = createMockSquad('ind');
  const team2Squad = createMockSquad('aus');

  const team1 = { id: 'team-ind', name: 'India', shortName: 'IND', squad: team1Squad };
  const team2 = { id: 'team-aus', name: 'Australia', shortName: 'AUS', squad: team2Squad };

  it('initializes a fresh 50-over ODI match with 2 innings and Powerplay phase', () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-1', team1, team2, team1.id);
    const summary = controller.getSummary();

    expect(summary.currentInningsIndex).toBe(0);
    expect(summary.currentPhase).toBe('POWERPLAY');
    expect(summary.innings.length).toBe(2);
    expect(summary.strikerId).toBe(team1Squad[0].id);
    expect(summary.nonStrikerId).toBe(team1Squad[1].id);
    expect(summary.bowlerId).toBeDefined();
    expect(summary.target).toBeNull();
  });

  it('generates unique deliveryId and rich physical trajectory per delivery', () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-2', team1, team2, team1.id);
    const delivery = controller.simulateDelivery();

    expect(delivery.deliveryId).toMatch(/^ODI_INNINGS_1_OVER_0_BALL_1$/);
    expect(delivery.trajectory.startPos).toBeDefined();
    expect(delivery.trajectory.bouncePos).toBeDefined();
    expect(delivery.trajectory.contactPos).toBeDefined();
    expect(delivery.trajectory.targetPos).toBeDefined();
    expect(delivery.stepMessages.length).toBeGreaterThan(0);
    expect(delivery.phase).toBe('POWERPLAY');
  });

  it('progresses ball by ball without skipping (0.1 -> 0.2 -> ... -> 0.6)', async () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-3', team1, team2, team1.id);
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

  it('correctly maps ODI phases (Powerplay 1-10, Middle 11-40, Death 41-50)', () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-4', team1, team2, team1.id);

    expect(controller.getPhase(0)).toBe('POWERPLAY');
    expect(controller.getPhase(9)).toBe('POWERPLAY');
    expect(controller.getPhase(10)).toBe('MIDDLE_OVERS');
    expect(controller.getPhase(28)).toBe('MIDDLE_OVERS');
    expect(controller.getPhase(39)).toBe('MIDDLE_OVERS');
    expect(controller.getPhase(40)).toBe('DEATH_OVERS');
    expect(controller.getPhase(49)).toBe('DEATH_OVERS');
  });

  it('enforces maximum 10 overs (60 legal balls) per bowler constraint', async () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-5', team1, team2, team1.id);
    controller.setFastSimulating(true);

    // Simulate 72 balls (12 overs)
    for (let i = 0; i < 72; i++) {
      await controller.playNextBallManual();
    }

    const summary = controller.getSummary();
    const inn1 = summary.innings[0];

    Object.values(inn1.bowlers).forEach((bowler) => {
      expect(bowler.balls).toBeLessThanOrEqual(60);
    });
  });

  it('supports deterministic replay of deliveries from history', async () => {
    const controller = new ODIMatchPlaybackController('odi-match-id-6', team1, team2, team1.id);
    controller.setFastSimulating(true);

    for (let i = 0; i < 12; i++) {
      await controller.playNextBallManual();
    }

    const replayList = controller.getReplayDeliveries(0);
    expect(replayList.length).toBe(12);

    replayList.forEach((del, idx) => {
      expect(del.deliveryId).toContain(`BALL_${(idx % 6) + 1}`);
      expect(del.trajectory.targetPos.x).toBeTypeOf('number');
      expect(del.trajectory.targetPos.z).toBeTypeOf('number');
    });
  });
});
