import { describe, it, expect } from 'vitest';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { Player } from '../types/common';
import { PitchType, WeatherCondition } from '../types/match';

const mockStriker: Player = {
  id: 'striker_1',
  name: 'V. Kohli',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 92,
  basePrice: 1500,
  baseAbility: 92,
  form: 88,
  stats: { batting: 94, bowling: 35, fielding: 88 },
  careerStats: { matches: 250, runs: 8000, wickets: 4, ballsFaced: 6000, ballsBowled: 120, runsConceded: 160, dismissals: 190, catches: 110 },
};

const mockNonStriker: Player = {
  id: 'striker_2',
  name: 'R. Sharma',
  role: 'Batsman',
  nationality: 'Indian',
  rating: 90,
  basePrice: 1500,
  baseAbility: 90,
  form: 85,
  stats: { batting: 92, bowling: 30, fielding: 82 },
  careerStats: { matches: 240, runs: 7500, wickets: 2, ballsFaced: 5500, ballsBowled: 90, runsConceded: 120, dismissals: 180, catches: 95 },
};

const mockBowler: Player = {
  id: 'bowler_1',
  name: 'J. Bumrah',
  role: 'Bowler',
  nationality: 'Indian',
  rating: 95,
  basePrice: 1500,
  baseAbility: 95,
  form: 92,
  stats: { batting: 25, bowling: 96, fielding: 84 },
  careerStats: { matches: 120, runs: 120, wickets: 150, ballsFaced: 100, ballsBowled: 2800, runsConceded: 3200, dismissals: 60, catches: 30 },
};

describe('Single Source of Truth Delivery Results', () => {
  it('creates an immutable frozen DeliveryResult object', () => {
    const delivery = DeliveryResultFactory.createDeliveryResult({
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 12,
      currentWickets: 1,
      requiredRate: 8.5,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
    });

    expect(Object.isFrozen(delivery)).toBe(true);
    expect(delivery.id).toBeDefined();
    expect(delivery.ballPath).toBeDefined();
    expect(delivery.ballPath.start).toBeDefined();
    expect(delivery.ballPath.bounce).toBeDefined();
    expect(delivery.ballPath.contact).toBeDefined();
    expect(delivery.ballPath.target).toBeDefined();
  });

  it('guarantees unique IDs across distinct deliveries', () => {
    const d1 = DeliveryResultFactory.createDeliveryResult({
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 0,
      currentWickets: 0,
      requiredRate: 0,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
    });

    const d2 = DeliveryResultFactory.createDeliveryResult({
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 1,
      currentWickets: 0,
      requiredRate: 0,
      pitchType: PitchType.BALANCED,
      weather: WeatherCondition.SUNNY,
      format: 'T20',
    });

    expect(d1.id).not.toBe(d2.id);
  });

  it('deterministic result helper generates predictable test results without side effects', () => {
    const dot = DeliveryResultFactory.createDeterministicResult({
      resultType: 'DOT',
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 5,
      currentWickets: 0,
    });
    expect(dot.totalRuns).toBe(0);
    expect(dot.wicket).toBe(false);

    const six = DeliveryResultFactory.createDeterministicResult({
      resultType: 'SIX',
      runs: 6,
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 6,
      currentWickets: 0,
    });
    expect(six.totalRuns).toBe(6);
    expect(six.ballPath.isAerial).toBe(true);

    const wkt = DeliveryResultFactory.createDeterministicResult({
      resultType: 'WICKET',
      wicketType: 'Bowled',
      striker: mockStriker,
      nonStriker: mockNonStriker,
      bowler: mockBowler,
      currentBalls: 7,
      currentWickets: 1,
    });
    expect(wkt.wicket).toBe(true);
    expect(wkt.wicketType).toBe('Bowled');
  });
});
