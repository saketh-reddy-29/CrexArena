import { RulesEngine } from '../rules/RulesEngine';
import { SquadEngine } from './SquadEngine';

export class CompetitionEngine {
  private rules: RulesEngine;
  private squadEngine: SquadEngine;
  private teams: any[];
  private schedule: any[];
  private standings: Map<string, any>;

  constructor(rules: RulesEngine) {
    this.rules = rules;
    this.squadEngine = new SquadEngine(rules);
    this.teams = [];
    this.schedule = [];
    this.standings = new Map();
  }

  initialize(teams: any[]) {
    this.teams = teams;
    
    // Validate all squads before starting
    for (const team of teams) {
      const validation = this.squadEngine.validateSquad(team.squad || []);
      if (!validation.isValid) {
        throw new Error(`Team ${team.name} has an invalid squad: ${validation.errors.join(', ')}`);
      }
      this.initStandingsForTeam(team.id);
    }

    this.generateSchedule();
    return true;
  }

  private initStandingsForTeam(teamId: string) {
    this.standings.set(teamId, {
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      tied: 0,
      noResult: 0,
      points: 0,
      nrr: 0, // Simplified Net Run Rate tracker
      percentage: 0 // For WTC
    });
  }

  private generateSchedule() {
    const isLeague = this.rules.isLeague();
    this.schedule = [];

    if (isLeague) {
      // Double round robin for leagues like IPL
      for (let i = 0; i < this.teams.length; i++) {
        for (let j = 0; j < this.teams.length; j++) {
          if (i !== j) {
            this.schedule.push({
              home: this.teams[i],
              away: this.teams[j],
              status: 'SCHEDULED'
            });
          }
        }
      }
    } else {
      // Standard Series logic (e.g. 3-match ODI series)
      // Usually configured dynamically by user
    }
  }

  updateStandings(matchResult: any) {
    const { winner, loser, isDraw, isTie, isNoResult } = matchResult;
    
    if (winner) {
      const wStats = this.standings.get(winner.id);
      wStats.played++;
      wStats.won++;
      wStats.points += this.rules.getPointsForWin();
      
      const lStats = this.standings.get(loser.id);
      lStats.played++;
      lStats.lost++;
      lStats.points += this.rules.getPointsForLoss();
    } else if (isDraw) {
      // Handle draw updates
    }
  }

  getStandings() {
    return Array.from(this.standings.entries()).map(([id, stats]) => ({
      teamId: id,
      ...stats
    })).sort((a, b) => {
      // Sort by points, then by tieBreaker rule
      if (b.points !== a.points) return b.points - a.points;
      
      const tieBreaker = this.rules.getTieBreaker();
      if (tieBreaker === 'NRR') {
        return b.nrr - a.nrr;
      }
      return 0;
    });
  }
}
