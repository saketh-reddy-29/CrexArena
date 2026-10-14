import { Player } from '../../types/common';
import { PitchType } from '../../types/match';
import { ArenaFormat } from '../models/ArenaState';

export type InjuryRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PlayerWorkloadState {
  playerId: string;
  fatigue: number; // 0 to 100
  riskLevel: InjuryRiskLevel;
  restRecommended: boolean;
  consecutiveMatches: number;
}

export interface SelectionResult {
  playingXI: string[];
  bench: string[];
  restedPlayers: string[];
  composition: {
    keepers: number;
    batsmen: number;
    allrounders: number;
    bowlers: number;
    bowlingOptions: number;
    paceOptions: number;
    spinOptions: number;
  };
  tacticalSummary: string;
}

export interface SelectionParams {
  squad: Player[];
  pitchType: PitchType;
  format: ArenaFormat;
  fatigueMap?: Record<string, number>;
  previousXI?: string[];
  mustIncludeIds?: string[];
}

export class WorkloadRotationEngine {
  /**
   * Fast bowler per-over fatigue: 2.8%
   * Spin bowler per-over fatigue: 1.8%
   * Ball faced fatigue: 0.15%
   * Keeping match workload: 5.0%
   */
  public static calculateMatchFatigue(
    player: Player,
    ballsFaced: number,
    oversBowled: number,
    isKeeper: boolean = false
  ): number {
    let fatigue = 0;

    // Batting load
    fatigue += ballsFaced * 0.15;

    // Bowling load
    const isSpinner = this.isSpinner(player);
    if (player.role === 'Bowler') {
      fatigue += oversBowled * (isSpinner ? 1.8 : 2.8);
    } else if (player.role === 'All-rounder') {
      fatigue += oversBowled * (isSpinner ? 1.6 : 2.4);
    } else if (oversBowled > 0) {
      fatigue += oversBowled * 1.5;
    }

    // Keeping load
    if (isKeeper || player.role === 'Wicketkeeper') {
      fatigue += 5.0;
    }

    return Math.min(100, Math.round(fatigue * 10) / 10);
  }

  /**
   * Recovers fatigue based on rest hours.
   * Standard 24h rest recovers ~30% fatigue.
   */
  public static calculateRestRecovery(currentFatigue: number, restHours: number): number {
    const recoveryRatePerHour = 1.25; // 30% per 24 hours
    const totalRecovery = restHours * recoveryRatePerHour;
    return Math.max(0, Math.round((currentFatigue - totalRecovery) * 10) / 10);
  }

  /**
   * Categorizes injury/workload risk based on cumulative fatigue.
   */
  public static determineInjuryRisk(fatigue: number): InjuryRiskLevel {
    if (fatigue >= 85) return 'CRITICAL';
    if (fatigue >= 65) return 'HIGH';
    if (fatigue >= 35) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Helper to identify spin vs pace bowlers based on style and name heuristics.
   */
  public static isSpinner(player: Player): boolean {
    const style = (player.bowlingStyle || '').toLowerCase();
    const name = player.name.toLowerCase();
    if (
      style.includes('spin') ||
      style.includes('leg') ||
      style.includes('off') ||
      style.includes('slow') ||
      style.includes('orthodox') ||
      style.includes('chinaman')
    ) {
      return true;
    }
    const knownSpinners = [
      'rashid', 'noor', 'varun', 'chahal', 'kuldeep', 'bishnoi', 'jadeja',
      'krunal', 'akeal', 'rahul chahar', 'axar', 'narine', 'sundar', 'ashwin',
      'santner', 'zampa', 'shakib', 'hasaranga', 'theekshana', 'maharaj', 'murphy'
    ];
    return knownSpinners.some((k) => name.includes(k));
  }

  /**
   * Selects a tactically balanced Playing XI from the squad:
   * 1. Exactly 11 players.
   * 2. At least 1 Wicketkeeper.
   * 3. At least 5 bowling options (Bowlers + All-rounders).
   * 4. Pitch conditions adaptation (pace on pace pitches, spin on spin pitches).
   * 5. Strategic rotation: Rests fatigued players (fatigue >= 70) and brings in bench players.
   */
  public static selectOptimalPlayingXI(params: SelectionParams): SelectionResult {
    const { squad, pitchType, format, fatigueMap = {}, previousXI = [], mustIncludeIds = [] } = params;

    if (squad.length <= 11) {
      const allIds = squad.map((p) => p.id);
      return {
        playingXI: allIds,
        bench: [],
        restedPlayers: [],
        composition: this.calculateComposition(squad),
        tacticalSummary: 'Full squad utilized (11 or fewer players available).',
      };
    }

    const restedPlayers: string[] = [];

    // Calculate effective tactical score for each player
    const scoredPlayers = squad.map((p) => {
      const fatigue = fatigueMap[p.id] || 0;
      const baseRating = p.rating || p.baseAbility || 75;
      let effectiveScore = baseRating;

      const isSpin = this.isSpinner(p);
      const isPacer = p.role === 'Bowler' && !isSpin;

      // Pitch conditions adaptation
      if (pitchType === PitchType.PACE) {
        if (isPacer) effectiveScore += 8;
        if (p.role === 'All-rounder' && !isSpin) effectiveScore += 4;
        if (isSpin) effectiveScore -= 4;
      } else if (pitchType === PitchType.SPIN) {
        if (isSpin) effectiveScore += 8;
        if (p.role === 'All-rounder' && isSpin) effectiveScore += 4;
        if (isPacer) effectiveScore -= 4;
      } else if (pitchType === PitchType.BATTING) {
        if (p.role === 'Batsman' || p.role === 'Wicketkeeper') effectiveScore += 5;
      }

      // Format weights
      if (format === 'TEST') {
        const temperament = p.temperament || (p.stats as any)?.temperament || 75;
        effectiveScore += (temperament - 75) * 0.2;
      } else if (format === 'T20' || (format as string) === 'IPL') {
        const aggression = p.aggression || (p.stats as any)?.aggression || 75;
        effectiveScore += (aggression - 75) * 0.2;
      }

      // Workload & fatigue penalty
      if (fatigue >= 70) {
        effectiveScore -= 18; // Heavy penalty encouraging squad rotation
      } else if (fatigue >= 45) {
        effectiveScore -= (fatigue - 45) * 0.3;
      }

      // Prioritize mustIncludeIds (e.g. Captain or locked players)
      if (mustIncludeIds.includes(p.id)) {
        effectiveScore += 100;
      }

      return {
        player: p,
        fatigue,
        effectiveScore,
        isSpin,
        isPacer,
      };
    });

    const keepers = scoredPlayers.filter((s) => s.player.role === 'Wicketkeeper');
    const pureBowlers = scoredPlayers.filter((s) => s.player.role === 'Bowler');
    const allrounders = scoredPlayers.filter((s) => s.player.role === 'All-rounder');
    const pureBatters = scoredPlayers.filter((s) => s.player.role === 'Batsman');

    const selectedIds = new Set<string>();

    // Step A: Pick 1 Wicketkeeper (highest effective score)
    const sortedKeepers = [...keepers].sort((a, b) => b.effectiveScore - a.effectiveScore);
    if (sortedKeepers.length > 0) {
      selectedIds.add(sortedKeepers[0].player.id);
    } else {
      // Fallback: pick highest rated batsman as keeper
      const bestBat = [...scoredPlayers].sort((a, b) => b.effectiveScore - a.effectiveScore)[0];
      if (bestBat) selectedIds.add(bestBat.player.id);
    }

    // Step B: Pick bowling core (ensure at least 5 bowling options)
    const bowlingPool = [...pureBowlers, ...allrounders].sort(
      (a, b) => b.effectiveScore - a.effectiveScore
    );

    // Pick top 4 dedicated bowling options
    let bowlingCount = 0;
    for (const b of bowlingPool) {
      if (selectedIds.has(b.player.id)) continue;
      if (bowlingCount >= 4) break;
      selectedIds.add(b.player.id);
      bowlingCount++;
    }

    // Step C: Ensure 5th bowling option if not already present
    const currentBowlers = scoredPlayers.filter((s) =>
      selectedIds.has(s.player.id) && (s.player.role === 'Bowler' || s.player.role === 'All-rounder')
    );
    if (currentBowlers.length < 5) {
      const remainingBowlers = bowlingPool.filter((b) => !selectedIds.has(b.player.id));
      if (remainingBowlers.length > 0) {
        selectedIds.add(remainingBowlers[0].player.id);
      }
    }

    // Step D: Pitch-specific bowling balance adjustment
    if (pitchType === PitchType.PACE) {
      const selectedPacers = scoredPlayers.filter(
        (s) => selectedIds.has(s.player.id) && s.isPacer
      );
      if (selectedPacers.length < 3) {
        const benchPacers = pureBowlers.filter(
          (b) => !selectedIds.has(b.player.id) && b.isPacer && b.fatigue < 70
        );
        if (benchPacers.length > 0) {
          selectedIds.add(benchPacers[0].player.id);
        }
      }
    } else if (pitchType === PitchType.SPIN) {
      const selectedSpinners = scoredPlayers.filter(
        (s) => selectedIds.has(s.player.id) && s.isSpin
      );
      if (selectedSpinners.length < 2) {
        const benchSpinners = [...pureBowlers, ...allrounders].filter(
          (b) => !selectedIds.has(b.player.id) && b.isSpin && b.fatigue < 70
        );
        if (benchSpinners.length > 0) {
          selectedIds.add(benchSpinners[0].player.id);
        }
      }
    }

    // Step E: Fill remaining spots with top scoring batsmen and all-rounders
    const remainingPlayers = [...scoredPlayers]
      .filter((s) => !selectedIds.has(s.player.id))
      .sort((a, b) => b.effectiveScore - a.effectiveScore);

    for (const candidate of remainingPlayers) {
      if (selectedIds.size >= 11) break;
      selectedIds.add(candidate.player.id);
    }

    // Step F: Workload Rotation Pass
    // If a starter from previous matches is fatigued (fatigue >= 70), and bench has a suitable backup (fatigue < 45)
    if (previousXI.length > 0) {
      for (const pId of Array.from(selectedIds)) {
        if (mustIncludeIds.includes(pId)) continue;
        const candidate = scoredPlayers.find((s) => s.player.id === pId);
        if (candidate && candidate.fatigue >= 70) {
          // Look for fresh backup on bench with same role
          const freshBench = scoredPlayers.find(
            (b) =>
              !selectedIds.has(b.player.id) &&
              b.player.role === candidate.player.role &&
              b.fatigue < 45 &&
              b.player.rating >= candidate.player.rating - 25
          );

          if (freshBench) {
            selectedIds.delete(pId);
            selectedIds.add(freshBench.player.id);
            restedPlayers.push(pId);
          }
        }
      }

      // Record any previous starters who were rested/omitted due to fatigue
      for (const prevId of previousXI) {
        if (!selectedIds.has(prevId)) {
          const candidate = scoredPlayers.find((s) => s.player.id === prevId);
          if (candidate && candidate.fatigue >= 65 && !restedPlayers.includes(prevId)) {
            restedPlayers.push(prevId);
          }
        }
      }
    }

    const playingXI = Array.from(selectedIds).slice(0, 11);
    const bench = squad.filter((p) => !playingXI.includes(p.id)).map((p) => p.id);
    const selectedPlayers = squad.filter((p) => playingXI.includes(p.id));
    const comp = this.calculateComposition(selectedPlayers);

    const tacticalSummary = `Tactical Playing XI configured for ${pitchType} conditions: ${comp.keepers} WK, ${comp.batsmen} Bat, ${comp.allrounders} AR, ${comp.bowlers} Bowl (${comp.paceOptions} Pace, ${comp.spinOptions} Spin options). ${
      restedPlayers.length > 0 ? `${restedPlayers.length} player(s) rested for workload management.` : 'Full-strength squad deployed.'
    }`;

    return {
      playingXI,
      bench,
      restedPlayers,
      composition: comp,
      tacticalSummary,
    };
  }

  private static calculateComposition(players: Player[]) {
    let keepers = 0;
    let batsmen = 0;
    let allrounders = 0;
    let bowlers = 0;
    let paceOptions = 0;
    let spinOptions = 0;

    for (const p of players) {
      if (p.role === 'Wicketkeeper') keepers++;
      if (p.role === 'Batsman') batsmen++;
      if (p.role === 'All-rounder') allrounders++;
      if (p.role === 'Bowler') bowlers++;

      if (p.role === 'Bowler' || p.role === 'All-rounder') {
        if (this.isSpinner(p)) {
          spinOptions++;
        } else {
          paceOptions++;
        }
      }
    }

    return {
      keepers,
      batsmen,
      allrounders,
      bowlers,
      bowlingOptions: bowlers + allrounders,
      paceOptions,
      spinOptions,
    };
  }
}
