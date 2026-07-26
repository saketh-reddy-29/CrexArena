import { Franchise } from '../../stores/useGameStore';

export interface FranchiseDNA {
  name: string;
  // Core bidding traits
  aggression: number;           // How likely to overpay/bid aggressively (0-100)
  budgetDiscipline: number;     // How strict they are with reserved budgets (0-100)
  riskTolerance: number;        // Willingness to take risks on unproven/injured players
  patience: number;             // High patience = waits late to bid; Low patience = bids instantly
  
  // Roster preferences
  starPreference: number;       // Desire for elite/superstar players (90+ rating)
  youthPreference: number;      // Desire for young/high-potential players
  experiencePreference: number; // Desire for experienced veterans
  domesticPreference: number;   // Desire for Indian players
  
  // Tactical preferences
  preferredRoles: Array<'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper'>;
  primaryFocus: 'Pace' | 'Spin' | 'Batting' | 'All-round' | 'Balanced';
  
  // Psychology
  rivalTeams: string[];         // Franchise IDs they will fight harder against
  loyalty: number;              // How much they overpay for their own former players
}

// Map real IPL team personalities based on user requirements
export const FRANCHISE_PROFILES: Record<string, FranchiseDNA> = {
  // CSK - Experienced, patient, loyal, Indian-focused
  '1': { 
    name: 'CSK', aggression: 55, budgetDiscipline: 85, riskTolerance: 40, patience: 90, 
    starPreference: 70, youthPreference: 30, experiencePreference: 95, domesticPreference: 85, 
    preferredRoles: ['All-rounder', 'Batsman'], primaryFocus: 'Spin', rivalTeams: ['2', '3'], loyalty: 95 
  },
  // MI - Elite talent, aggressive, future stars, high spending
  '2': { 
    name: 'MI', aggression: 85, budgetDiscipline: 60, riskTolerance: 75, patience: 40, 
    starPreference: 95, youthPreference: 85, experiencePreference: 60, domesticPreference: 75, 
    preferredRoles: ['Batsman', 'Bowler'], primaryFocus: 'Pace', rivalTeams: ['1', '3'], loyalty: 80 
  },
  // RCB - High aggression, star-chasing, comfortable in bidding wars
  '3': { 
    name: 'RCB', aggression: 95, budgetDiscipline: 40, riskTolerance: 85, patience: 20, 
    starPreference: 98, youthPreference: 50, experiencePreference: 70, domesticPreference: 60, 
    preferredRoles: ['Batsman', 'All-rounder'], primaryFocus: 'Batting', rivalTeams: ['1', '2'], loyalty: 70 
  },
  // RR - Youth focused, bargains, data-driven, uncapped Indians
  '4': { 
    name: 'RR', aggression: 60, budgetDiscipline: 85, riskTolerance: 65, patience: 80, 
    starPreference: 50, youthPreference: 95, experiencePreference: 40, domesticPreference: 90, 
    preferredRoles: ['Bowler', 'Batsman'], primaryFocus: 'Balanced', rivalTeams: ['5', '8'], loyalty: 65 
  },
  // GT - Budget disciplined, logical bidding, rarely overpays
  '5': { 
    name: 'GT', aggression: 50, budgetDiscipline: 95, riskTolerance: 50, patience: 85, 
    starPreference: 60, youthPreference: 65, experiencePreference: 75, domesticPreference: 80, 
    preferredRoles: ['All-rounder', 'Bowler'], primaryFocus: 'Pace', rivalTeams: ['4', '10'], loyalty: 85 
  },
  // KKR - Explosive bidding, loves impact players/mystery spinners
  '6': { 
    name: 'KKR', aggression: 88, budgetDiscipline: 55, riskTolerance: 90, patience: 30, 
    starPreference: 85, youthPreference: 70, experiencePreference: 65, domesticPreference: 70, 
    preferredRoles: ['All-rounder', 'Batsman'], primaryFocus: 'Spin', rivalTeams: ['2', '3'], loyalty: 75 
  },
  // LSG - Balanced strategy, steady pacing
  '7': { 
    name: 'LSG', aggression: 65, budgetDiscipline: 75, riskTolerance: 60, patience: 65, 
    starPreference: 75, youthPreference: 60, experiencePreference: 70, domesticPreference: 75, 
    preferredRoles: ['Batsman', 'All-rounder'], primaryFocus: 'Balanced', rivalTeams: ['5', '10'], loyalty: 60 
  },
  // DC - Data driven, aggressive on specific targets
  '8': { 
    name: 'DC', aggression: 70, budgetDiscipline: 70, riskTolerance: 75, patience: 70, 
    starPreference: 75, youthPreference: 80, experiencePreference: 50, domesticPreference: 80, 
    preferredRoles: ['Batsman', 'Bowler'], primaryFocus: 'Batting', rivalTeams: ['4', '9'], loyalty: 65 
  },
  // PBKS - Highly aggressive, big purses, panic buying
  '9': { 
    name: 'PBKS', aggression: 90, budgetDiscipline: 30, riskTolerance: 80, patience: 10, 
    starPreference: 85, youthPreference: 60, experiencePreference: 65, domesticPreference: 65, 
    preferredRoles: ['Batsman', 'Bowler'], primaryFocus: 'Batting', rivalTeams: ['3', '8'], loyalty: 50 
  },
  // SRH - Bowling focused, calculated aggression
  '10': { 
    name: 'SRH', aggression: 75, budgetDiscipline: 65, riskTolerance: 70, patience: 60, 
    starPreference: 80, youthPreference: 65, experiencePreference: 60, domesticPreference: 70, 
    preferredRoles: ['Bowler', 'All-rounder'], primaryFocus: 'Pace', rivalTeams: ['1', '3'], loyalty: 70 
  },
};

/**
 * Returns the DNA profile for a given franchise.
 */
export function getFranchiseDNA(franchise: Franchise): FranchiseDNA {
  return FRANCHISE_PROFILES[franchise.id] ?? FRANCHISE_PROFILES['1']; // Fallback to safe defaults
}
