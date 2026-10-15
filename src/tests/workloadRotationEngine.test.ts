import { describe, it, expect } from 'vitest';
import { WorkloadRotationEngine } from '../engine/ai/WorkloadRotationEngine';
import { Player } from '../types/common';
import { PitchType } from '../types/match';

const mockPlayer = (
  id: string,
  name: string,
  role: Player['role'],
  rating: number,
  bowlingStyle?: string
): Player => ({
  id,
  name,
  role,
  nationality: 'Indian',
  rating,
  baseAbility: rating,
  form: 85,
  basePrice: 10000000,
  bowlingStyle,
  stats: { batting: 75, bowling: 75, fielding: 75 },
  careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 },
});

describe('WorkloadRotationEngine', () => {
  it('calculates higher fatigue for fast bowlers than spin bowlers per over', () => {
    const pacer = mockPlayer('p1', 'Jasprit Bumrah', 'Bowler', 95, 'Right-arm fast');
    const spinner = mockPlayer('p2', 'Rashid Khan', 'Bowler', 92, 'Right-arm legbreak');

    const pacerFatigue = WorkloadRotationEngine.calculateMatchFatigue(pacer, 0, 4, false);
    const spinnerFatigue = WorkloadRotationEngine.calculateMatchFatigue(spinner, 0, 4, false);

    expect(pacerFatigue).toBeGreaterThan(spinnerFatigue);
    expect(pacerFatigue).toBeCloseTo(4 * 2.8, 1);
    expect(spinnerFatigue).toBeCloseTo(4 * 1.8, 1);
  });

  it('calculates batting and keeping fatigue', () => {
    const batter = mockPlayer('p3', 'Virat Kohli', 'Batsman', 95);
    const keeper = mockPlayer('p4', 'MS Dhoni', 'Wicketkeeper', 90);

    const batFatigue = WorkloadRotationEngine.calculateMatchFatigue(batter, 60, 0, false);
    expect(batFatigue).toBeCloseTo(60 * 0.15, 1);

    const keepFatigue = WorkloadRotationEngine.calculateMatchFatigue(keeper, 30, 0, true);
    expect(keepFatigue).toBeCloseTo(30 * 0.15 + 5.0, 1);
  });

  it('calculates rest recovery over time and never drops below zero', () => {
    const initialFatigue = 60;
    const after24h = WorkloadRotationEngine.calculateRestRecovery(initialFatigue, 24);
    expect(after24h).toBeLessThan(initialFatigue);
    expect(after24h).toBeCloseTo(initialFatigue - 24 * 1.25, 1);

    const fullRecovery = WorkloadRotationEngine.calculateRestRecovery(20, 48);
    expect(fullRecovery).toBe(0);
  });

  it('selects balanced Playing XI with min 1 WK and min 5 bowling options', () => {
    const squad: Player[] = [
      mockPlayer('b1', 'Batter 1', 'Batsman', 88),
      mockPlayer('b2', 'Batter 2', 'Batsman', 86),
      mockPlayer('b3', 'Batter 3', 'Batsman', 84),
      mockPlayer('b4', 'Batter 4', 'Batsman', 82),
      mockPlayer('b5', 'Batter 5', 'Batsman', 80),
      mockPlayer('wk1', 'Keeper 1', 'Wicketkeeper', 85),
      mockPlayer('wk2', 'Keeper 2', 'Wicketkeeper', 78),
      mockPlayer('ar1', 'All-rounder 1', 'All-rounder', 85, 'Right-arm medium-fast'),
      mockPlayer('ar2', 'All-rounder 2', 'All-rounder', 83, 'Left-arm orthodox'),
      mockPlayer('bw1', 'Pacer 1', 'Bowler', 90, 'Right-arm fast'),
      mockPlayer('bw2', 'Pacer 2', 'Bowler', 88, 'Left-arm fast'),
      mockPlayer('bw3', 'Spinner 1', 'Bowler', 87, 'Right-arm legbreak'),
      mockPlayer('bw4', 'Pacer 3', 'Bowler', 82, 'Right-arm fast'),
      mockPlayer('b6', 'Batter 6', 'Batsman', 75),
      mockPlayer('bw5', 'Spinner 2', 'Bowler', 76, 'Slow left-arm orthodox'),
    ];

    const selection = WorkloadRotationEngine.selectOptimalPlayingXI({
      squad,
      pitchType: PitchType.BALANCED,
      format: 'T20',
    });

    expect(selection.playingXI.length).toBe(11);
    expect(selection.composition.keepers).toBeGreaterThanOrEqual(1);
    expect(selection.composition.bowlingOptions).toBeGreaterThanOrEqual(5);
  });

  it('adapts bowling selection to PACE vs SPIN pitch conditions', () => {
    const squad: Player[] = [
      mockPlayer('b1', 'Batter 1', 'Batsman', 88),
      mockPlayer('b2', 'Batter 2', 'Batsman', 86),
      mockPlayer('b3', 'Batter 3', 'Batsman', 84),
      mockPlayer('b4', 'Batter 4', 'Batsman', 82),
      mockPlayer('wk1', 'Keeper 1', 'Wicketkeeper', 85),
      mockPlayer('ar1', 'Pace AR', 'All-rounder', 84, 'Right-arm fast-medium'),
      mockPlayer('ar2', 'Spin AR', 'All-rounder', 84, 'Left-arm orthodox'),
      mockPlayer('pacer1', 'Express Pacer 1', 'Bowler', 86, 'Right-arm fast'),
      mockPlayer('pacer2', 'Express Pacer 2', 'Bowler', 85, 'Left-arm fast'),
      mockPlayer('pacer3', 'Express Pacer 3', 'Bowler', 83, 'Right-arm fast'),
      mockPlayer('spin1', 'Mystery Spin 1', 'Bowler', 86, 'Right-arm legbreak'),
      mockPlayer('spin2', 'Mystery Spin 2', 'Bowler', 85, 'Right-arm offbreak'),
      mockPlayer('spin3', 'Mystery Spin 3', 'Bowler', 83, 'Slow left-arm orthodox'),
    ];

    // On Pace pitch
    const paceSelection = WorkloadRotationEngine.selectOptimalPlayingXI({
      squad,
      pitchType: PitchType.PACE,
      format: 'T20',
    });

    // On Spin pitch
    const spinSelection = WorkloadRotationEngine.selectOptimalPlayingXI({
      squad,
      pitchType: PitchType.SPIN,
      format: 'T20',
    });

    expect(paceSelection.composition.paceOptions).toBeGreaterThanOrEqual(
      spinSelection.composition.paceOptions
    );
    expect(spinSelection.composition.spinOptions).toBeGreaterThanOrEqual(
      paceSelection.composition.spinOptions
    );
  });

  it('rotates fatigued starters out and brings fresh bench players in', () => {
    const squad: Player[] = [
      mockPlayer('b1', 'Batter 1', 'Batsman', 88),
      mockPlayer('b2', 'Batter 2', 'Batsman', 86),
      mockPlayer('b3', 'Batter 3', 'Batsman', 84),
      mockPlayer('b4', 'Batter 4', 'Batsman', 82),
      mockPlayer('b5', 'Batter 5', 'Batsman', 80),
      mockPlayer('wk1', 'Keeper 1', 'Wicketkeeper', 85),
      mockPlayer('ar1', 'All-rounder 1', 'All-rounder', 85, 'Right-arm medium-fast'),
      mockPlayer('pacer1', 'Star Pacer', 'Bowler', 92, 'Right-arm fast'),
      mockPlayer('pacer2', 'Pacer 2', 'Bowler', 88, 'Left-arm fast'),
      mockPlayer('spin1', 'Spinner 1', 'Bowler', 87, 'Right-arm legbreak'),
      mockPlayer('bw4', 'Pacer 3', 'Bowler', 86, 'Right-arm fast'),
      // Bench backup
      mockPlayer('benchPacer', 'Fresh Backup Pacer', 'Bowler', 84, 'Right-arm fast'),
    ];

    // Star Pacer has played 3 consecutive matches and is fatigued (fatigue = 85%)
    const fatigueMap = {
      pacer1: 85,
      benchPacer: 5,
    };

    const selection = WorkloadRotationEngine.selectOptimalPlayingXI({
      squad,
      pitchType: PitchType.BALANCED,
      format: 'T20',
      fatigueMap,
      previousXI: ['pacer1', 'pacer2', 'spin1', 'bw4', 'ar1', 'b1', 'b2', 'b3', 'b4', 'b5', 'wk1'],
    });

    // Fatigued pacer1 should be rested, and fresh benchPacer should be promoted
    expect(selection.restedPlayers).toContain('pacer1');
    expect(selection.playingXI).toContain('benchPacer');
    expect(selection.playingXI).not.toContain('pacer1');
  });
});

