export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
  nationality: 'Indian' | 'Overseas';
  rating: number;
  basePrice: number;
  battingStyle?: string;
  bowlingStyle?: string;
  matches?: number;
  runs?: number;
  wickets?: number;
  strikeRate?: number;
  economy?: number;
  aggression?: number;
  temperament?: number;
  stamina?: number;
  baseAbility: number; // Permanent base ability rating (long term)
  form: number; // Dynamic form rating (0-100)
  intendedTeamId?: string;
  stats: {
    batting: number;
    bowling: number;
    fielding: number;
  };
  careerStats: {
    matches: number;
    runs: number;
    wickets: number;
    ballsFaced: number;
    ballsBowled: number;
    runsConceded: number;
    dismissals: number;
    catches: number;
  };
}
