import { describe, it, expect } from 'vitest';
import { 
  DeliveryResult, 
  MatchState, 
  applyDeliveryResult, 
  BatterInningsStats,
  BowlerInningsStats
} from '../engine/models/DeliveryResult';
import { 
  BowlerFieldStrategyEngine 
} from '../engine/bowling/BowlerFieldStrategyEngine';
import { FieldMovementController } from '../engine/fielding/FieldMovementController';
import { DeliveryStateMachine } from '../engine/timeline/DeliveryStateMachine';
import { FullGroundScoringEngine } from '../engine/scoring/FullGroundScoringEngine';

function createMockMatchState(format: string = 'T20'): MatchState {
  const striker: BatterInningsStats = {
    id: 'p1',
    name: 'Batter 1',
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false,
    scoringZonesMap: {}
  };

  const nonStriker: BatterInningsStats = {
    id: 'p2',
    name: 'Batter 2',
    runs: 0,
    ballsFaced: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false,
    scoringZonesMap: {}
  };

  const bowler: BowlerInningsStats = {
    id: 'b1',
    name: 'Bowler 1',
    overs: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    economy: 0,
    dots: 0,
    boundaries: 0
  };

  return {
    matchId: 'm1',
    format,
    phase: 'POWERPLAY',
    inningsNumber: 1,
    overs: 0,
    balls: 0,
    score: 0,
    wickets: 0,
    legalBalls: 0,
    currentOver: 0,
    striker,
    nonStriker,
    bowler,
    batters: { p1: striker, p2: nonStriker },
    bowlers: { b1: bowler },
    currentPartnership: { runs: 0, balls: 0 },
    target: null,
    runsRequired: null,
    ballsRemaining: null,
    requiredRunRate: null,
    currentRunRate: 0,
    fieldConfigurationId: 'field_initial',
    deliveriesHistory: [],
    isCompleted: false
  };
}

describe('Complete Real-Time Match Engine Fix Integration Tests', () => {
  describe('1. Single Source of Truth & Atomic applyDeliveryResult', () => {
    it('applies standard scoring delivery atomically', () => {
      const state = createMockMatchState('T20');
      const delivery: DeliveryResult = {
        deliveryId: 'del_1',
        inningsNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        legalBall: true,
        batterRuns: 4,
        extraRuns: 0,
        totalRuns: 4,
        wicket: false,
        shotType: 'COVER_DRIVE',
        targetZone: 'DEEP_COVER',
        batterOutcome: 'FOUR',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const newState = applyDeliveryResult(state, delivery);
      expect(newState.score).toBe(4);
      expect(newState.wickets).toBe(0);
      expect(newState.legalBalls).toBe(1);
      expect(newState.batters['p1'].runs).toBe(4);
      expect(newState.batters['p1'].ballsFaced).toBe(1);
      expect(newState.batters['p1'].fours).toBe(1);
      expect(newState.bowlers['b1'].runsConceded).toBe(4);
      expect(newState.bowlers['b1'].boundaries).toBe(1);
      expect(newState.currentPartnership.runs).toBe(4);
      expect(newState.deliveriesHistory.length).toBe(1);
      // Striker unchanged on even runs
      expect(newState.striker.id).toBe('p1');
    });

    it('rotates strike on odd runs and at over end', () => {
      let state = createMockMatchState('T20');
      const singleDelivery: DeliveryResult = {
        deliveryId: 'del_1',
        inningsNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        legalBall: true,
        batterRuns: 1,
        extraRuns: 0,
        totalRuns: 1,
        wicket: false,
        batterOutcome: 'SINGLE',
        confidence: 0.8,
        timestamp: Date.now()
      };

      state = applyDeliveryResult(state, singleDelivery);
      expect(state.striker.id).toBe('p2');
      expect(state.nonStriker.id).toBe('p1');
    });

    it('updates wickets and falls of wicket correctly', () => {
      let state = createMockMatchState('T20');
      const wicketDelivery: DeliveryResult = {
        deliveryId: 'del_w1',
        inningsNumber: 1,
        overNumber: 0,
        ballNumber: 1,
        strikerId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        legalBall: true,
        batterRuns: 0,
        extraRuns: 0,
        totalRuns: 0,
        wicket: true,
        wicketType: 'BOWLED',
        batterOutcome: 'WICKET',
        confidence: 0.95,
        timestamp: Date.now()
      };

      state = applyDeliveryResult(state, wicketDelivery);
      expect(state.wickets).toBe(1);
      expect(state.batters['p1'].isOut).toBe(true);
      expect(state.batters['p1'].dismissalInfo).toBe('BOWLED');
      expect(state.bowlers['b1'].wickets).toBe(1);
      expect(state.currentPartnership.runs).toBe(0);
    });
  });

  describe('2. Bowler-Specific Field Strategy Engine & Memory', () => {
    const engine = new BowlerFieldStrategyEngine();

    it('creates distinct field strategies for different bowler archetypes', () => {
      const fastSwingBowler = {
        id: 'bowler_swing',
        name: 'James Anderson',
        bowlingStyle: 'Fast-Medium',
        pace: 84,
        accuracy: 90,
        swing: 92,
        seam: 80,
        variation: 60,
        bouncerAbility: 65,
        yorkerAbility: 75,
        spinAbility: 10,
        control: 88,
        wicketAbility: 88,
        fatigue: 10,
      };

      const spinnerBowler = {
        id: 'bowler_spin',
        name: 'Ravichandran Ashwin',
        bowlingStyle: 'Off-Spin',
        pace: 50,
        accuracy: 88,
        swing: 10,
        seam: 10,
        variation: 85,
        bouncerAbility: 10,
        yorkerAbility: 40,
        spinAbility: 92,
        control: 88,
        wicketAbility: 86,
        fatigue: 15,
      };

      const fastField = engine.generateField(fastSwingBowler, {}, 'TEST', 2, 0, false);
      const spinField = engine.generateField(spinnerBowler, {}, 'TEST', 35, 3, false);

      expect(fastField.strategy).toBe('SWING_ATTACK');
      expect(spinField.strategy).toBe('SPIN_PRESSURE');
      expect(fastField.positions.length).toBe(9);
      expect(spinField.positions.length).toBe(9);

      // Fast swing has slips and gully
      const fastSlips = fastField.positions.filter(p => p.name.includes('Slip') || p.name.includes('Gully'));
      expect(fastSlips.length).toBeGreaterThanOrEqual(2);

      // Spinner has close catchers
      const spinCatchers = spinField.positions.filter(p => p.name.includes('Silly Point') || p.name.includes('Short Leg') || p.name.includes('Slip'));
      expect(spinCatchers.length).toBeGreaterThanOrEqual(1);
    });

    it('adapts field when batter repeatedly attacks a specific zone in death overs', () => {
      const deathBowler = {
        id: 'bowler_death',
        name: 'Jasprit Bumrah',
        bowlingStyle: 'Fast',
        pace: 92,
        accuracy: 92,
        swing: 60,
        seam: 80,
        variation: 85,
        bouncerAbility: 85,
        yorkerAbility: 95,
        spinAbility: 10,
        control: 90,
        wicketAbility: 90,
        fatigue: 20,
      };

      // Record multiple deliveries in memory
      for (let i = 0; i < 3; i++) {
        engine.recordDeliveryOutcome('bowler_death', 'batter_power', 4, false, false);
      }

      const deathField = engine.generateField(
        deathBowler,
        { cover: 15, midwicket: 5 },
        'T20',
        18,
        4,
        true
      );

      expect(deathField.strategy).toBe('DEATH_BOUNDARY_LOCK');
      expect(deathField.reason).toContain('death over');
      expect(deathField.deepFieldersCount).toBe(5);
    });
  });

  describe('3. FieldMovementController (No Teleportation)', () => {
    it('smoothly transitions fielders between positions across progress 0.0 to 1.0', () => {
      const controller = new FieldMovementController();

      const currentFielders = [
        { name: 'Point', pos: { x: -12.5, y: 0.04, z: 8.5 } },
        { name: 'Cover', pos: { x: -15.0, y: 0.04, z: -5.0 } }
      ];

      const newPositions = [
        { name: 'Deep Point', x: -28.0, z: 9.5, isDeep: true },
        { name: 'Extra Cover', x: -11.0, z: -1.5, isDeep: false }
      ];

      const transitions = controller.planFieldTransition(currentFielders, newPositions);
      expect(transitions.length).toBe(2);
      expect(controller.isFieldReady()).toBe(false);

      // Mid transition at progress = 0.5
      const midTransitions = controller.updateProgress(0.5);
      expect(midTransitions[0].currentPos.x).toBeLessThan(-12.5);
      expect(midTransitions[0].currentPos.x).toBeGreaterThan(-28.0);
      expect(['WALKING', 'RUNNING', 'POSITIONING']).toContain(midTransitions[0].state);

      // Complete transition at progress = 1.0
      const finalTransitions = controller.updateProgress(1.0);
      expect(controller.isFieldReady()).toBe(true);
      expect(finalTransitions[0].currentPos.x).toBeCloseTo(-28.0, 1);
      expect(finalTransitions[0].state).toBe('READY');
    });
  });

  describe('4. DeliveryStateMachine & Format Pacing', () => {
    it('executes 19-state timeline with strict locking and format-aware durations', () => {
      const machine = new DeliveryStateMachine();

      const deliverySix: DeliveryResult = {
        deliveryId: 'del_six',
        inningsNumber: 1,
        overNumber: 1,
        ballNumber: 2,
        strikerId: 'p1',
        nonStrikerId: 'p2',
        bowlerId: 'b1',
        legalBall: true,
        batterRuns: 6,
        extraRuns: 0,
        totalRuns: 6,
        wicket: false,
        batterOutcome: 'SIX',
        confidence: 0.9,
        timestamp: Date.now()
      };

      const t20Pacing = machine.getPacingConfig('T20', deliverySix);
      const testPacing = machine.getPacingConfig('TEST', deliverySix);

      // Test format pacing is longer than T20
      expect(testPacing.totalDurationMs).toBeGreaterThan(t20Pacing.totalDurationMs);
      expect(t20Pacing.totalDurationMs).toBeGreaterThanOrEqual(5000);

      machine.startDelivery(deliverySix);
      expect(machine.isLocked()).toBe(true);
      expect(machine.getState()).toBe('PRE_DELIVERY');

      // Update through phases
      const early = machine.updateProgress(0.25, t20Pacing);
      expect(early.state).toBe('BOWLER_RUNUP');
      expect(early.shouldApplyScorecard).toBe(false);

      const contact = machine.updateProgress(0.55, t20Pacing);
      expect(contact.state).toBe('BATTER_ACTION');
      expect(contact.shouldApplyScorecard).toBe(false);

      const scorecardUpdate = machine.updateProgress(0.82, t20Pacing);
      expect(scorecardUpdate.state).toBe('SCORECARD_UPDATE');
      expect(scorecardUpdate.shouldApplyScorecard).toBe(true);

      const finish = machine.updateProgress(1.0, t20Pacing);
      expect(finish.state).toBe('DELIVERY_COMPLETE');
      expect(finish.isDeliveryComplete).toBe(true);
      expect(machine.isLocked()).toBe(false);
    });
  });

  describe('5. Multi-Delivery Simulation Invariant Validation', () => {
    it('executes 60 consecutive deliveries without NaN or invalid states', () => {
      let state = createMockMatchState('ODI');
      const scoringEngine = new FullGroundScoringEngine();

      const fielders = [
        { name: 'Cover', x: -15, z: -5, isDeep: false },
        { name: 'Deep Cover', x: -28, z: 9.5, isDeep: true },
        { name: 'Mid Wicket', x: 12, z: 2, isDeep: false },
        { name: 'Long On', x: 12, z: -27, isDeep: true }
      ];

      for (let i = 0; i < 60; i++) {
        const outcome = scoringEngine.simulate(
          'OUTSIDE_OFF_GOOD_LENGTH',
          fielders,
          'RIGHT_HAND',
          { cover: 80, midwicket: 70 },
          { technique: 80, timing: 80, power: 75, settledness: Math.min(100, i * 2) },
          { speedKph: 138, movementScore: 65 },
          'BALANCED'
        );

        const deliveryResult: DeliveryResult = {
          deliveryId: `del_${i}`,
          inningsNumber: 1,
          overNumber: Math.floor(state.legalBalls / 6),
          ballNumber: (state.legalBalls % 6) + 1,
          strikerId: state.striker.id,
          nonStrikerId: state.nonStriker.id,
          bowlerId: state.bowler.id,
          legalBall: true,
          batterRuns: outcome.runs,
          extraRuns: 0,
          totalRuns: outcome.runs,
          wicket: outcome.isWicket,
          wicketType: outcome.isWicket ? (outcome.wicketType as any || 'CAUGHT') : undefined,
          targetZone: outcome.targetZone,
          batterOutcome: outcome.isWicket ? 'WICKET' : (outcome.runs === 6 ? 'SIX' : outcome.runs === 4 ? 'FOUR' : outcome.runs === 1 ? 'SINGLE' : 'DOT'),
          confidence: 0.85,
          timestamp: Date.now()
        };

        state = applyDeliveryResult(state, deliveryResult);

        expect(Number.isFinite(state.score)).toBe(true);
        expect(state.score).toBeGreaterThanOrEqual(0);
        expect(state.wickets).toBeLessThanOrEqual(10);
        expect(Number.isFinite(state.legalBalls)).toBe(true);

        if (state.wickets >= 10) {
          break;
        }
      }
    });
  });
});
