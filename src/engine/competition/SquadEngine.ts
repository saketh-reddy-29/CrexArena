import { RulesEngine } from '../rules/RulesEngine';

export class SquadEngine {
  private rules: RulesEngine;

  constructor(rules: RulesEngine) {
    this.rules = rules;
  }

  validateSquad(squad: any[]) {
    const errors: string[] = [];
    const minSize = this.rules.getMinSquadSize();
    const maxSize = this.rules.getMaxSquadSize();
    const maxOverseasInXI = this.rules.getMaxOverseasPlayersInXI();

    if (squad.length < minSize) {
      errors.push(`Squad must have at least ${minSize} players.`);
    }
    
    if (squad.length > maxSize) {
      errors.push(`Squad exceeds maximum size of ${maxSize}.`);
    }

    if (this.rules.getConfig().type === 'IPL') {
      const overseas = squad.filter(p => p.nationality !== 'India'); // Simplification for now
      // Typically IPL limits overseas to 8 in the total squad (25 max)
      if (overseas.length > 8) {
        errors.push("Too many overseas players. Max allowed is 8.");
      }
    }

    if (!this.hasEnoughWicketkeepers(squad)) {
      errors.push("Need wicketkeeper coverage.");
    }
    
    if (!this.hasEnoughBowlers(squad)) {
      errors.push("Bowling department is insufficient.");
    }

    return { isValid: errors.length === 0, errors };
  }

  validatePlayingXI(playingXI: any[]) {
    const errors: string[] = [];
    const requiredSize = this.rules.getPlayingXISize();

    if (playingXI.length !== requiredSize) {
      errors.push(`Playing XI must contain exactly ${requiredSize} players.`);
    }

    const overseasLimit = this.rules.getMaxOverseasPlayersInXI();
    const overseas = playingXI.filter(p => p.nationality !== 'India'); // Simplification
    
    if (overseas.length > overseasLimit) {
      errors.push(`Playing XI cannot contain more than ${overseasLimit} overseas players.`);
    }

    return { isValid: errors.length === 0, errors };
  }

  private hasEnoughWicketkeepers(squad: any[]) {
    // Check if at least 1-2 WKs exist
    return squad.filter(p => p.role === 'WK-Batsman' || p.role === 'Wicketkeeper').length >= 1;
  }

  private hasEnoughBowlers(squad: any[]) {
    // Check if enough primary bowlers exist
    return squad.filter(p => p.role === 'Bowler' || p.role === 'All-rounder').length >= 5;
  }
}
