import { RulesEngine } from '../rules/RulesEngine';

export class TeamStrengthEngine {
  private rules: RulesEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
  }

  calculateTeamStrength(playingXI: any[]) {
    const format = this.rules.getConfig().type;
    
    // Base aggregation (simplified)
    const stats = this.aggregateSquadStats(playingXI);
    
    let strength = 0;

    if (format === 'T20' || format === 'IPL') {
      strength = (stats.batting * 0.25) + 
                 (stats.bowling * 0.25) + 
                 (stats.power * 0.10) + 
                 (stats.deathBowling * 0.10) + 
                 (stats.fielding * 0.10) + 
                 (stats.allRounders * 0.10) + 
                 (stats.form * 0.10);
    } else if (format === 'ODI') {
      strength = (stats.batting * 0.25) + 
                 (stats.bowling * 0.25) + 
                 (stats.allRounders * 0.15) + 
                 (stats.fielding * 0.10) + 
                 (stats.depth * 0.10) + 
                 (stats.form * 0.10) + 
                 (stats.balance * 0.05);
    } else if (format === 'TEST') {
      strength = (stats.batting * 0.30) + 
                 (stats.bowling * 0.30) + 
                 (stats.battingDepth * 0.10) + 
                 (stats.fastBowling * 0.10) + 
                 (stats.spin * 0.08) + 
                 (stats.fielding * 0.05) + 
                 (stats.form * 0.07);
    }

    return Math.round(strength);
  }

  private aggregateSquadStats(playingXI: any[]) {
    // In a real app, this would iterate through the 11 players
    // and compute these specialized aggregate values based on player stats/roles
    return {
      batting: 85,
      bowling: 82,
      power: 80,
      deathBowling: 75,
      fielding: 80,
      allRounders: 70,
      form: 85,
      depth: 75,
      balance: 80,
      battingDepth: 75,
      fastBowling: 85,
      spin: 80
    };
  }
}
