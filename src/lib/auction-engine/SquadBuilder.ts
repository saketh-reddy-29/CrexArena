import { Franchise } from '../../stores/useGameStore';
import { Player } from '../../types/common';
import { INITIAL_PLAYER_POOL } from '../../data/players';
import { INTL_PLAYER_POOL } from '../../data/intlPlayers';

const ALL_KNOWN_PLAYERS = [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL];

export interface SquadAnalysis {
  total: number;
  overseas: number;
  indian: number;
  
  // Specific Roles
  batsmen: number;
  bowlers: number;
  allRounders: number;
  wicketKeepers: number;
  
  // Sub-roles inferred from styles
  spinners: number;
  pacers: number;
  
  // Needs scores (0-100) where 100 is desperate need
  needs: {
    batting: number;
    spin: number;
    pace: number;
    wk: number;
    allRound: number;
    overseas: number; // Low if 8/8 full
  };
}

export function getFranchiseSquad(franchise: Franchise): Player[] {
  return franchise.squad
    .map((id) => ALL_KNOWN_PLAYERS.find((player) => player.id === id))
    .filter((player): player is Player => Boolean(player));
}

export function isSpinner(player: Player): boolean {
  if (!player.bowlingStyle) return false;
  const style = player.bowlingStyle.toLowerCase();
  return style.includes('spin') || style.includes('break') || style.includes('orthodox');
}

export function isPacer(player: Player): boolean {
  if (!player.bowlingStyle) return false;
  const style = player.bowlingStyle.toLowerCase();
  return style.includes('fast') || style.includes('medium') || style.includes('pace');
}

export function analyzeSquad(franchise: Franchise): SquadAnalysis {
  const squad = getFranchiseSquad(franchise);
  
  const analysis: SquadAnalysis = {
    total: squad.length,
    overseas: squad.filter(p => p.nationality === 'Overseas').length,
    indian: squad.filter(p => p.nationality === 'Indian').length,
    batsmen: squad.filter(p => p.role === 'Batsman').length,
    bowlers: squad.filter(p => p.role === 'Bowler').length,
    allRounders: squad.filter(p => p.role === 'All-rounder').length,
    wicketKeepers: squad.filter(p => p.role === 'Wicketkeeper').length,
    spinners: squad.filter(p => (p.role === 'Bowler' || p.role === 'All-rounder') && isSpinner(p)).length,
    pacers: squad.filter(p => (p.role === 'Bowler' || p.role === 'All-rounder') && isPacer(p)).length,
    needs: { batting: 0, spin: 0, pace: 0, wk: 0, allRound: 0, overseas: 0 },
  };

  // Calculate needs based on ideal squad composition (25 players max)
  // Ideal: 7-8 Batsmen, 3-4 WKs, 5-6 All-rounders, 4-5 Pacers, 3-4 Spinners
  
  const clamp = (val: number) => Math.min(100, Math.max(0, val));
  
  // Batting Need
  const battingDeficit = 8 - analysis.batsmen;
  analysis.needs.batting = clamp(battingDeficit * 20);
  
  // WK Need (Desperate if 0, okay if 2)
  const wkDeficit = 3 - analysis.wicketKeepers;
  analysis.needs.wk = clamp(wkDeficit * 35);
  if (analysis.wicketKeepers === 0) analysis.needs.wk = 100;
  
  // All-round Need
  const arDeficit = 5 - analysis.allRounders;
  analysis.needs.allRound = clamp(arDeficit * 20);
  
  // Pace Need
  const paceDeficit = 5 - analysis.pacers;
  analysis.needs.pace = clamp(paceDeficit * 25);
  if (analysis.pacers === 0) analysis.needs.pace = 100;
  
  // Spin Need
  const spinDeficit = 4 - analysis.spinners;
  analysis.needs.spin = clamp(spinDeficit * 25);
  
  // Overseas Capacity (Are we full?)
  const overseasRemaining = 8 - analysis.overseas;
  analysis.needs.overseas = clamp(overseasRemaining * 20);
  
  return analysis;
}

export function getSpecificRoleNeed(player: Player, analysis: SquadAnalysis): number {
  if (player.role === 'Wicketkeeper') return analysis.needs.wk;
  if (player.role === 'Batsman') return analysis.needs.batting;
  if (player.role === 'All-rounder') return analysis.needs.allRound;
  
  if (player.role === 'Bowler') {
    if (isSpinner(player)) return analysis.needs.spin;
    if (isPacer(player)) return analysis.needs.pace;
    return Math.max(analysis.needs.spin, analysis.needs.pace); // Fallback
  }
  
  return 50; // Neutral default
}
