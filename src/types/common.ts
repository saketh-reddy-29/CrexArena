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
  form?: number;
  intendedTeamId?: string;
  stats: {
    batting: number;
    bowling: number;
    fielding: number;
  };
}
