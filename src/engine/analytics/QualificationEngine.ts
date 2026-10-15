import { Standing, Fixture, MatchStatus } from '../../types/match';
import { Franchise } from '../../stores/useGameStore';
import { Player } from '../../types/common';

export interface TeamQualificationProjection {
  teamId: string;
  teamName: string;
  shortName: string;
  logo: string;
  color: string;
  currentPoints: number;
  currentNRR: number;
  currentRank: number;
  played: number;
  remainingMatches: number;
  maxPossiblePoints: number;
  minPossiblePoints: number;
  qualificationProbability: number; // 0 to 100 (%)
  top2Probability: number;          // 0 to 100 (%)
  eliminationProbability: number;   // 0 to 100 (%)
  pointsNeededSafe: number;
  status: 'QUALIFIED' | 'CONTENTION' | 'ELIMINATED';
  nextFixtures: {
    fixtureId: string;
    opponentId: string;
    opponentShortName: string;
    opponentLogo: string;
    venue?: string;
  }[];
}

export interface PlayoffBracketProjection {
  qualifier1: { team1?: Franchise; team2?: Franchise; confidence: number };
  eliminator: { team1?: Franchise; team2?: Franchise; confidence: number };
  safeCutoffPoints: number;
  totalRemainingMatches: number;
}

export interface QualificationAnalysisResult {
  projections: TeamQualificationProjection[];
  bracket: PlayoffBracketProjection | null;
  totalSimulations: number;
  generatedAt: number;
}

export class QualificationEngine {
  /**
   * Run Monte Carlo simulation of remaining league fixtures to calculate
   * playoff qualification probabilities, top-2 finish probabilities, and bracket projections.
   */
  public static calculateProbabilities(
    standings: Standing[],
    fixtures: Fixture[],
    franchises: Franchise[],
    players: Player[] = [],
    options: {
      numSimulations?: number;
      targetTopN?: number;
      safeCutoff?: number;
    } = {}
  ): QualificationAnalysisResult {
    const numSimulations = options.numSimulations ?? 1000;
    const targetTopN = options.targetTopN ?? 4;
    const safeCutoff = options.safeCutoff ?? 16;

    const franchiseMap = new Map<string, Franchise>(franchises.map(f => [f.id, f]));
    const playerMap = new Map<string, Player>(players.map(p => [p.id, p]));

    // 1. Identify remaining league fixtures (exclude playoffs and completed)
    const remainingFixtures = fixtures.filter(
      f => !f.isPlayoff && f.status !== MatchStatus.COMPLETED
    );

    // 2. Pre-calculate baseline team ratings
    const teamRatings = new Map<string, number>();
    franchises.forEach(f => {
      let rating = 75; // baseline rating
      if (f.squad && f.squad.length > 0) {
        const squadPlayers = f.squad.map(id => playerMap.get(id)).filter(Boolean) as Player[];
        if (squadPlayers.length > 0) {
          const avgBatting = squadPlayers.reduce((acc, p) => acc + (p.stats?.batting || 70), 0) / squadPlayers.length;
          const avgBowling = squadPlayers.reduce((acc, p) => acc + (p.stats?.bowling || 70), 0) / squadPlayers.length;
          rating = (avgBatting * 0.5) + (avgBowling * 0.5);
        }
      }
      teamRatings.set(f.id, rating);
    });

    // 3. Map current standings
    const currentStandingsMap = new Map<string, Standing>();
    standings.forEach(s => currentStandingsMap.set(s.teamId, s));

    // Fill missing franchise standings if any
    franchises.forEach(f => {
      if (!currentStandingsMap.has(f.id)) {
        currentStandingsMap.set(f.id, {
          teamId: f.id,
          played: 0,
          won: 0,
          lost: 0,
          points: 0,
          nrr: 0,
          runsScored: 0,
          oversFaced: 0,
          runsConceded: 0,
          oversBowled: 0,
          form: [],
        });
      }
    });

    // Determine current rankings (sorted by points descending, then NRR descending)
    const sortedCurrent = Array.from(currentStandingsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.nrr - a.nrr;
    });

    const currentRankMap = new Map<string, number>();
    sortedCurrent.forEach((s, idx) => currentRankMap.set(s.teamId, idx + 1));

    // Calculate remaining matches per team
    const remainingCountMap = new Map<string, number>();
    const nextFixturesMap = new Map<string, TeamQualificationProjection['nextFixtures']>();

    franchises.forEach(f => {
      remainingCountMap.set(f.id, 0);
      nextFixturesMap.set(f.id, []);
    });

    remainingFixtures.forEach(fix => {
      remainingCountMap.set(fix.team1Id, (remainingCountMap.get(fix.team1Id) || 0) + 1);
      remainingCountMap.set(fix.team2Id, (remainingCountMap.get(fix.team2Id) || 0) + 1);

      const f1 = franchiseMap.get(fix.team1Id);
      const f2 = franchiseMap.get(fix.team2Id);

      if (f1 && f2) {
        nextFixturesMap.get(fix.team1Id)?.push({
          fixtureId: fix.id,
          opponentId: f2.id,
          opponentShortName: f2.shortName,
          opponentLogo: f2.logo,
          venue: fix.venue,
        });
        nextFixturesMap.get(fix.team2Id)?.push({
          fixtureId: fix.id,
          opponentId: f1.id,
          opponentShortName: f1.shortName,
          opponentLogo: f1.logo,
          venue: fix.venue,
        });
      }
    });

    // 4. Run Monte Carlo Simulation
    const topNCount = new Map<string, number>();
    const top2Count = new Map<string, number>();
    const rankAccumulator = new Map<string, number[]>(); // track ranks across iterations

    franchises.forEach(f => {
      topNCount.set(f.id, 0);
      top2Count.set(f.id, 0);
      rankAccumulator.set(f.id, Array(franchises.length + 1).fill(0));
    });

    if (remainingFixtures.length === 0) {
      // League already completed
      sortedCurrent.forEach((s, idx) => {
        if (idx < targetTopN) topNCount.set(s.teamId, numSimulations);
        if (idx < 2) top2Count.set(s.teamId, numSimulations);
      });
    } else {
      // Fast simulation iterations
      for (let sim = 0; sim < numSimulations; sim++) {
        // Clone current points and simulated NRR
        const simPoints = new Map<string, number>();
        const simNRR = new Map<string, number>();

        franchises.forEach(f => {
          const st = currentStandingsMap.get(f.id)!;
          simPoints.set(f.id, st.points);
          simNRR.set(f.id, st.nrr);
        });

        // Simulate each remaining match
        for (const match of remainingFixtures) {
          const r1 = teamRatings.get(match.team1Id) || 75;
          const r2 = teamRatings.get(match.team2Id) || 75;

          // Win probability based on rating difference
          const p1 = 1 / (1 + Math.pow(10, (r2 - r1) / 40));
          const roll = Math.random();

          if (roll < p1) {
            // Team 1 wins
            simPoints.set(match.team1Id, (simPoints.get(match.team1Id) || 0) + 2);
            // Slight NRR delta perturbation
            simNRR.set(match.team1Id, (simNRR.get(match.team1Id) || 0) + 0.05);
            simNRR.set(match.team2Id, (simNRR.get(match.team2Id) || 0) - 0.05);
          } else {
            // Team 2 wins
            simPoints.set(match.team2Id, (simPoints.get(match.team2Id) || 0) + 2);
            simNRR.set(match.team2Id, (simNRR.get(match.team2Id) || 0) + 0.05);
            simNRR.set(match.team1Id, (simNRR.get(match.team1Id) || 0) - 0.05);
          }
        }

        // Sort simulated standings
        const simTable = franchises.map(f => ({
          teamId: f.id,
          points: simPoints.get(f.id) || 0,
          nrr: simNRR.get(f.id) || 0,
        })).sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.nrr - a.nrr;
        });

        // Record outcomes
        simTable.forEach((item, rankIdx) => {
          const rank = rankIdx + 1;
          const ranks = rankAccumulator.get(item.teamId)!;
          ranks[rank] += 1;

          if (rank <= targetTopN) {
            topNCount.set(item.teamId, (topNCount.get(item.teamId) || 0) + 1);
          }
          if (rank <= 2) {
            top2Count.set(item.teamId, (top2Count.get(item.teamId) || 0) + 1);
          }
        });
      }
    }

    // 5. Construct Projections
    const projections: TeamQualificationProjection[] = franchises.map(f => {
      const st = currentStandingsMap.get(f.id)!;
      const rem = remainingCountMap.get(f.id) || 0;
      const maxPts = st.points + (rem * 2);
      const minPts = st.points;
      const qualCount = topNCount.get(f.id) || 0;
      const t2Count = top2Count.get(f.id) || 0;

      let qualPct = (qualCount / numSimulations) * 100;
      let top2Pct = (t2Count / numSimulations) * 100;

      // Mathematical verification
      // 4th place team currently
      const fourthTeamCurrentPts = sortedCurrent[Math.min(targetTopN - 1, sortedCurrent.length - 1)]?.points || 0;
      
      let status: 'QUALIFIED' | 'CONTENTION' | 'ELIMINATED' = 'CONTENTION';

      if (maxPts < fourthTeamCurrentPts && qualPct === 0) {
        status = 'ELIMINATED';
        qualPct = 0;
      } else if (qualPct >= 99.5) {
        status = 'QUALIFIED';
        qualPct = 100;
      } else if (qualPct <= 0.1 && rem <= 2) {
        status = 'ELIMINATED';
        qualPct = 0;
      }

      const pointsNeeded = Math.max(0, safeCutoff - st.points);

      return {
        teamId: f.id,
        teamName: f.name,
        shortName: f.shortName,
        logo: f.logo,
        color: f.color,
        currentPoints: st.points,
        currentNRR: Number(st.nrr.toFixed(3)),
        currentRank: currentRankMap.get(f.id) || 1,
        played: st.played,
        remainingMatches: rem,
        maxPossiblePoints: maxPts,
        minPossiblePoints: minPts,
        qualificationProbability: Number(qualPct.toFixed(1)),
        top2Probability: Number(top2Pct.toFixed(1)),
        eliminationProbability: Number((100 - qualPct).toFixed(1)),
        pointsNeededSafe: pointsNeeded,
        status,
        nextFixtures: nextFixturesMap.get(f.id) || [],
      };
    });

    // Sort projections by current rank
    projections.sort((a, b) => a.currentRank - b.currentRank);

    // 6. Playoff Bracket Projection (Top 4 most probable seeds)
    const sortedByProb = [...projections].sort((a, b) => {
      if (b.qualificationProbability !== a.qualificationProbability) {
        return b.qualificationProbability - a.qualificationProbability;
      }
      return a.currentRank - b.currentRank;
    });

    const rank1 = franchiseMap.get(sortedByProb[0]?.teamId);
    const rank2 = franchiseMap.get(sortedByProb[1]?.teamId);
    const rank3 = franchiseMap.get(sortedByProb[2]?.teamId);
    const rank4 = franchiseMap.get(sortedByProb[3]?.teamId);

    const bracket: PlayoffBracketProjection = {
      qualifier1: {
        team1: rank1,
        team2: rank2,
        confidence: Math.round(((sortedByProb[0]?.top2Probability || 50) + (sortedByProb[1]?.top2Probability || 50)) / 2),
      },
      eliminator: {
        team1: rank3,
        team2: rank4,
        confidence: Math.round(((sortedByProb[2]?.qualificationProbability || 50) + (sortedByProb[3]?.qualificationProbability || 50)) / 2),
      },
      safeCutoffPoints: safeCutoff,
      totalRemainingMatches: remainingFixtures.length,
    };

    return {
      projections,
      bracket,
      totalSimulations: numSimulations,
      generatedAt: Date.now(),
    };
  }
}
