import { describe, it, expect } from 'vitest';
import { QualificationEngine } from '../engine/analytics/QualificationEngine';
import { Standing, Fixture, MatchStatus } from '../types/match';
import { Franchise } from '../stores/useGameStore';

describe('QualificationEngine', () => {
  const dummyFranchises: Franchise[] = [
    { id: '1', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Aggressive' },
    { id: '2', name: 'Chennai Super Kings', shortName: 'CSK', color: '#FFFF00', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
    { id: '3', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#CE1126', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Aggressive' },
    { id: '4', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
    { id: '5', name: 'Gujarat Titans', shortName: 'GT', color: '#1B2133', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
    { id: '6', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Value' },
    { id: '7', name: 'Delhi Capitals', shortName: 'DC', color: '#00008B', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Value' },
    { id: '8', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#00BFFF', logo: '', purse: 0, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
  ];

  it('runs Monte Carlo simulations and assigns probabilities summing logically', () => {
    const standings: Standing[] = [
      { teamId: '1', played: 10, won: 8, lost: 2, points: 16, nrr: 0.85, runsScored: 1800, oversFaced: 200, runsConceded: 1600, oversBowled: 200, form: ['W', 'W', 'W', 'L', 'W'] },
      { teamId: '2', played: 10, won: 7, lost: 3, points: 14, nrr: 0.50, runsScored: 1750, oversFaced: 200, runsConceded: 1650, oversBowled: 200, form: ['W', 'L', 'W', 'W', 'L'] },
      { teamId: '3', played: 10, won: 6, lost: 4, points: 12, nrr: 0.20, runsScored: 1700, oversFaced: 200, runsConceded: 1650, oversBowled: 200, form: ['L', 'W', 'W', 'L', 'W'] },
      { teamId: '4', played: 10, won: 5, lost: 5, points: 10, nrr: 0.05, runsScored: 1650, oversFaced: 200, runsConceded: 1640, oversBowled: 200, form: ['W', 'L', 'L', 'W', 'L'] },
      { teamId: '5', played: 10, won: 5, lost: 5, points: 10, nrr: -0.10, runsScored: 1620, oversFaced: 200, runsConceded: 1640, oversBowled: 200, form: ['L', 'W', 'W', 'L', 'L'] },
      { teamId: '6', played: 10, won: 4, lost: 6, points: 8, nrr: -0.25, runsScored: 1600, oversFaced: 200, runsConceded: 1650, oversBowled: 200, form: ['L', 'L', 'W', 'L', 'W'] },
      { teamId: '7', played: 10, won: 3, lost: 7, points: 6, nrr: -0.55, runsScored: 1550, oversFaced: 200, runsConceded: 1680, oversBowled: 200, form: ['L', 'L', 'L', 'W', 'L'] },
      { teamId: '8', played: 10, won: 2, lost: 8, points: 4, nrr: -0.75, runsScored: 1500, oversFaced: 200, runsConceded: 1700, oversBowled: 200, form: ['L', 'L', 'L', 'L', 'L'] },
    ];

    const remainingFixtures: Fixture[] = [
      { id: 'fix-1', matchNumber: 41, day: 20, team1Id: '1', team2Id: '2', status: MatchStatus.UPCOMING },
      { id: 'fix-2', matchNumber: 42, day: 21, team1Id: '3', team2Id: '4', status: MatchStatus.UPCOMING },
      { id: 'fix-3', matchNumber: 43, day: 22, team1Id: '5', team2Id: '6', status: MatchStatus.UPCOMING },
      { id: 'fix-4', matchNumber: 44, day: 23, team1Id: '7', team2Id: '8', status: MatchStatus.UPCOMING },
    ];

    const result = QualificationEngine.calculateProbabilities(
      standings,
      remainingFixtures,
      dummyFranchises,
      [],
      { numSimulations: 500, targetTopN: 4, safeCutoff: 16 }
    );

    expect(result.projections).toHaveLength(8);
    expect(result.totalSimulations).toBe(500);

    // Rank 1 team (MI with 16 points) should have near 100% probability
    const mi = result.projections.find(p => p.shortName === 'MI');
    expect(mi).toBeDefined();
    expect(mi!.qualificationProbability).toBeGreaterThan(95);

    // Bottom team (LSG with 4 points and 1 match left) can only reach 6 points, cannot reach 4th place (10 pts)
    const lsg = result.projections.find(p => p.shortName === 'LSG');
    expect(lsg).toBeDefined();
    expect(lsg!.status).toBe('ELIMINATED');
    expect(lsg!.qualificationProbability).toBe(0);
  });

  it('correctly constructs playoff bracket predictions', () => {
    const standings: Standing[] = [
      { teamId: '1', played: 14, won: 10, lost: 4, points: 20, nrr: 0.90, runsScored: 2400, oversFaced: 280, runsConceded: 2200, oversBowled: 280, form: ['W', 'W', 'W', 'W', 'W'] },
      { teamId: '2', played: 14, won: 9, lost: 5, points: 18, nrr: 0.60, runsScored: 2350, oversFaced: 280, runsConceded: 2250, oversBowled: 280, form: ['W', 'W', 'L', 'W', 'W'] },
      { teamId: '3', played: 14, won: 8, lost: 6, points: 16, nrr: 0.30, runsScored: 2300, oversFaced: 280, runsConceded: 2240, oversBowled: 280, form: ['L', 'W', 'W', 'L', 'W'] },
      { teamId: '4', played: 14, won: 7, lost: 7, points: 14, nrr: 0.10, runsScored: 2250, oversFaced: 280, runsConceded: 2240, oversBowled: 280, form: ['W', 'L', 'L', 'W', 'L'] },
      { teamId: '5', played: 14, won: 6, lost: 8, points: 12, nrr: -0.20, runsScored: 2200, oversFaced: 280, runsConceded: 2240, oversBowled: 280, form: ['L', 'L', 'W', 'L', 'L'] },
      { teamId: '6', played: 14, won: 5, lost: 9, points: 10, nrr: -0.40, runsScored: 2150, oversFaced: 280, runsConceded: 2250, oversBowled: 280, form: ['L', 'W', 'L', 'L', 'L'] },
      { teamId: '7', played: 14, won: 4, lost: 10, points: 8, nrr: -0.60, runsScored: 2100, oversFaced: 280, runsConceded: 2260, oversBowled: 280, form: ['L', 'L', 'L', 'L', 'L'] },
      { teamId: '8', played: 14, won: 3, lost: 11, points: 6, nrr: -0.80, runsScored: 2050, oversFaced: 280, runsConceded: 2270, oversBowled: 280, form: ['L', 'L', 'L', 'L', 'L'] },
    ];

    // All fixtures completed
    const result = QualificationEngine.calculateProbabilities(
      standings,
      [],
      dummyFranchises,
      [],
      { numSimulations: 100, targetTopN: 4, safeCutoff: 16 }
    );

    expect(result.bracket).not.toBeNull();
    expect(result.bracket!.qualifier1.team1?.shortName).toBe('MI');
    expect(result.bracket!.qualifier1.team2?.shortName).toBe('CSK');
    expect(result.bracket!.eliminator.team1?.shortName).toBe('RCB');
    expect(result.bracket!.eliminator.team2?.shortName).toBe('KKR');
  });

  it('handles empty fixtures or missing standings gracefully', () => {
    const result = QualificationEngine.calculateProbabilities(
      [],
      [],
      dummyFranchises,
      []
    );

    expect(result.projections).toHaveLength(dummyFranchises.length);
    expect(result.bracket).not.toBeNull();
    result.projections.forEach(p => {
      expect(p.played).toBe(0);
      expect(p.currentPoints).toBe(0);
    });
  });
});
