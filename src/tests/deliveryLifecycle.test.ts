import { describe, it, expect } from 'vitest';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { Player } from '../types/common';
import { DeliveryLifecycle, DeliveryResult } from '../types/delivery';

describe('Authoritative Delivery Lifecycle & DeliveryResult Verification', () => {
  const dummyStriker: Player = {
    id: 'bat_1',
    name: 'Virat Kohli',
    role: 'Batsman',
    nationality: 'Indian',
    rating: 94,
    basePrice: 200,
    baseAbility: 94,
    form: 90,
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm medium',
    stats: { batting: 92, bowling: 40, fielding: 88 },
    careerStats: { matches: 250, runs: 12000, wickets: 4, ballsFaced: 13000, ballsBowled: 200, runsConceded: 220, dismissals: 0, catches: 110 },
  };

  const dummyNonStriker: Player = {
    id: 'bat_2',
    name: 'Rohit Sharma',
    role: 'Batsman',
    nationality: 'Indian',
    rating: 92,
    basePrice: 200,
    baseAbility: 92,
    form: 88,
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm offbreak',
    stats: { batting: 90, bowling: 45, fielding: 82 },
    careerStats: { matches: 240, runs: 10500, wickets: 15, ballsFaced: 11500, ballsBowled: 600, runsConceded: 580, dismissals: 0, catches: 95 },
  };

  const dummyBowler: Player = {
    id: 'bowl_1',
    name: 'Jasprit Bumrah',
    role: 'Bowler',
    nationality: 'Indian',
    rating: 95,
    basePrice: 200,
    baseAbility: 95,
    form: 92,
    battingStyle: 'Right-hand bat',
    bowlingStyle: 'Right-arm fast',
    stats: { batting: 25, bowling: 95, fielding: 80 },
    careerStats: { matches: 130, runs: 450, wickets: 280, ballsFaced: 380, ballsBowled: 7000, runsConceded: 5200, dismissals: 0, catches: 30 },
  };

  it('1. DOT BALL: 0 runs, legal delivery, strike not rotated', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'DOT',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('DOT');
    expect(res.totalRuns).toBe(0);
    expect(res.batterRuns).toBe(0);
    expect(res.extraRuns).toBe(0);
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(false);
    expect(res.strikeRotated).toBe(false);
    expect(res.ballPath).toBeDefined();
    expect(res.ballPath.start.y).toBe(190);
    expect(res.ballPath.contact.y).toBe(410);
  });

  it('2. SINGLE: 1 run, legal delivery, strike rotated', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'SINGLE',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('SINGLE');
    expect(res.totalRuns).toBe(1);
    expect(res.batterRuns).toBe(1);
    expect(res.extraRuns).toBe(0);
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(false);
    expect(res.strikeRotated).toBe(true);
  });

  it('3. TWO: 2 runs, legal delivery, strike not rotated', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'TWO',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('TWO');
    expect(res.totalRuns).toBe(2);
    expect(res.batterRuns).toBe(2);
    expect(res.extraRuns).toBe(0);
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(false);
    expect(res.strikeRotated).toBe(false);
  });

  it('4. FOUR: 4 runs, legal delivery, ground boundary, strike not rotated', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'FOUR',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('FOUR');
    expect(res.totalRuns).toBe(4);
    expect(res.batterRuns).toBe(4);
    expect(res.extraRuns).toBe(0);
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(false);
    expect(res.strikeRotated).toBe(false);
  });

  it('5. SIX: 6 runs, legal delivery, aerial trajectory, strike not rotated', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'SIX',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('SIX');
    expect(res.totalRuns).toBe(6);
    expect(res.batterRuns).toBe(6);
    expect(res.extraRuns).toBe(0);
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(false);
    expect(res.strikeRotated).toBe(false);
    expect(res.ballPath.isAerial).toBe(true);
    expect(res.ballPath.apexHeight).toBeGreaterThan(50);
  });

  it('6. WIDE: illegal delivery (not legal), 1 extra run, over does not advance', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WIDE',
      extraType: 'Wide',
      runs: 1,
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 5, // 5 balls bowled
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WIDE');
    expect(res.legalBall).toBe(false);
    expect(res.totalRuns).toBe(1);
    expect(res.batterRuns).toBe(0);
    expect(res.extraRuns).toBe(1);
    expect(res.extraType).toBe('Wide');
    expect(res.overCompleted).toBe(false); // Illegal ball cannot complete the over
    expect(res.strikeRotated).toBe(false);
  });

  it('7. NO BALL: illegal delivery, 1 extra run, triggers Free Hit', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'NO_BALL',
      extraType: 'No Ball',
      runs: 1,
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 5,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('NO_BALL');
    expect(res.legalBall).toBe(false);
    expect(res.totalRuns).toBe(1);
    expect(res.batterRuns).toBe(0);
    expect(res.extraRuns).toBe(1);
    expect(res.triggeredFreeHit).toBe(true);
    expect(res.overCompleted).toBe(false);
  });

  it('8. CAUGHT: legal delivery, wicket=true, aerial trajectory to catching fielder', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'Caught',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 2,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WICKET');
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(true);
    expect(res.wicketType).toBe('Caught');
    expect(res.dismissedPlayerId).toBe(dummyStriker.id);
  });

  it('9. BOWLED: legal delivery, wicket=true, ball targets stumps', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'Bowled',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 2,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WICKET');
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(true);
    expect(res.wicketType).toBe('Bowled');
    expect(res.targetZone).toBe('STUMPS');
  });

  it('10. LBW: legal delivery, wicket=true, ball intercepted on pitch', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'LBW',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 2,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WICKET');
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(true);
    expect(res.wicketType).toBe('LBW');
    expect(res.targetZone).toBe('STUMPS');
  });

  it('11. RUN OUT: legal delivery, wicket=true, but bowler credit check excludes Run Out', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'Run Out',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 2,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WICKET');
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(true);
    expect(res.wicketType).toBe('Run Out');

    // Rule: Run outs are NOT credited to the bowler in cricket
    const creditedToBowler = res.wicket && res.wicketType !== 'Run Out' && res.wicketType !== 'Timed Out';
    expect(creditedToBowler).toBe(false);
  });

  it('12. STUMPING: legal delivery, wicket=true, target is keeper, credited to bowler', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'Stumped',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 2,
      currentWickets: 0,
    });

    expect(res.resultType).toBe('WICKET');
    expect(res.legalBall).toBe(true);
    expect(res.wicket).toBe(true);
    expect(res.wicketType).toBe('Stumped');
    expect(res.targetZone).toBe('WICKETKEEPER');

    const creditedToBowler = res.wicket && res.wicketType !== 'Run Out' && res.wicketType !== 'Timed Out';
    expect(creditedToBowler).toBe(true);
  });

  it('13. Over completion logic: 6th legal delivery completes over', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'DOT',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 5, // Ball 6 in over
      currentWickets: 0,
    });

    expect(res.legalBall).toBe(true);
    expect(res.overCompleted).toBe(true);
  });

  it('14. Immutability guarantee: DeliveryResult is frozen', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'FOUR',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    expect(Object.isFrozen(res)).toBe(true);
    // Mutation attempt should throw in strict mode
    expect(() => {
      (res as any).totalRuns = 10;
    }).toThrow();
  });

  it('15. Continuous 2D coordinates normalization: all coords in [0, 1] bounds', () => {
    const res = DeliveryResultFactory.createDeterministicResult({
      resultType: 'SIX',
      striker: dummyStriker,
      nonStriker: dummyNonStriker,
      bowler: dummyBowler,
      currentBalls: 0,
      currentWickets: 0,
    });

    const norm = res.ballPath.normalizedTarget;
    expect(norm).toBeDefined();
    expect(norm!.x).toBeGreaterThanOrEqual(0);
    expect(norm!.x).toBeLessThanOrEqual(1);
    expect(norm!.y).toBeGreaterThanOrEqual(0);
    expect(norm!.y).toBeLessThanOrEqual(1);
  });
});
