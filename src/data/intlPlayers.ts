import { Player } from '../types/common';
import { PLAYER_RATINGS } from './playerRatings';

// ─── International Player Creation Helper ──────────────────────────────
const intlPlayer = (
  id: string,
  name: string,
  role: Player['role'],
  rating: number,
  intendedTeamId: string,
  batting = role === 'Bowler' ? 30 : 82,
  bowling = role === 'Batsman' || role === 'Wicketkeeper' ? 0 : 78,
  extra?: Partial<Player>,
): Player => {
  const balanced = PLAYER_RATINGS[name];
  const finalBatting = balanced?.batting ?? batting;
  const finalBowling = balanced?.bowling ?? bowling;
  const finalFielding = balanced?.fielding ?? extra?.fielding ?? 80;
  const finalForm = balanced?.form ?? extra?.form ?? 85;

  return {
    id,
    name,
    role,
    nationality: 'Indian', // Default overridden below if needed (though the current file hardcodes Indian initially)
    rating,
    baseAbility: rating,
    form: finalForm,
    basePrice: 0,
    intendedTeamId,
    stats: {
      matches: extra?.matches || 0,
      runs: extra?.runs || 0,
      wickets: extra?.wickets || 0,
      highestScore: extra?.highestScore || 0,
      bestBowling: extra?.bestBowling || '',
      fifties: extra?.fifties || 0,
      hundreds: extra?.hundreds || 0,
      strikeRate: extra?.strikeRate || (role === 'Bowler' ? 85 : 125),
      economy: extra?.economy || (role === 'Batsman' ? 9.5 : 7.5),
    },
    attributes: {
      battingAbility: finalBatting,
      bowlingAbility: finalBowling,
      fielding: finalFielding,
      experience: extra?.experience || 75,
      form: finalForm,
      aggression: extra?.aggression || 75,
      temperament: extra?.temperament || 80,
    }
  };
};

// ═══════════════════════════════════════════════════════════════════════
//  IND
// ═══════════════════════════════════════════════════════════════════════
const IND_PLAYERS: Player[] = [
  intlPlayer('ind3', 'Shubman Gill', 'Batsman', 92, 'IND', 93, 0, { aggression: 78, temperament: 88, form: 88, matches: 48, runs: 2328, strikeRate: 98.3 }),
  intlPlayer('ind1', 'Rohit Sharma', 'Batsman', 97, 'IND', 97, 0, { aggression: 88, temperament: 92, form: 82, matches: 264, runs: 10709, strikeRate: 89.9 }),
  intlPlayer('ind2', 'Virat Kohli', 'Batsman', 98, 'IND', 98, 0, { aggression: 82, temperament: 96, form: 90, matches: 292, runs: 13906, strikeRate: 93.6 }),
  intlPlayer('ind4', 'Shreyas Iyer', 'Batsman', 88, 'IND', 90, 0, { aggression: 80, temperament: 84, form: 78, matches: 62, runs: 2330, strikeRate: 96.5 }),
  intlPlayer('ind15', 'Yashasvi Jaiswal', 'Batsman', 90, 'IND', 92, 0, { aggression: 86, temperament: 82, form: 88, matches: 20, runs: 740, strikeRate: 161.8 }),
  intlPlayer('ind5', 'KL Rahul', 'Wicketkeeper', 91, 'IND', 92, 0, { aggression: 74, temperament: 90, form: 82, matches: 83, runs: 3318, strikeRate: 86.7 }),
  intlPlayer('ind7', 'Dhruv Jurel', 'Wicketkeeper', 81, 'IND', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ind9', 'Axar Patel', 'All-rounder', 87, 'IND', 78, 87, { aggression: 72, temperament: 82, form: 80, matches: 60, runs: 601, wickets: 72 }),
  intlPlayer('ind23', 'Nitish Kumar Reddy', 'All-rounder', 85, 'IND', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ind16', 'Washington Sundar', 'All-rounder', 85, 'IND', 72, 85, { aggression: 65, temperament: 82, form: 78, matches: 29, wickets: 24 }),
  intlPlayer('ind10', 'Kuldeep Yadav', 'Bowler', 90, 'IND', 35, 93, { aggression: 45, temperament: 80, form: 88, matches: 93, wickets: 152 }),
  intlPlayer('ind12', 'Harshit Rana', 'Bowler', 83, 'IND', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ind13', 'Mohammed Siraj', 'Bowler', 88, 'IND', 20, 90, { aggression: 65, temperament: 78, form: 80, matches: 40, wickets: 67, economy: 5.4 }),
  intlPlayer('ind14', 'Arshdeep Singh', 'Bowler', 83, 'IND', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ind30', 'Prasidh Krishna', 'Bowler', 83, 'IND', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ind29', 'Suryakumar Yadav', 'Batsman', 95, 'IND', 96, 0, { aggression: 92, temperament: 80, form: 90, matches: 72, runs: 2500, strikeRate: 168.0 }),
  intlPlayer('ind17', 'Abhishek Sharma', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind18', 'Rinku Singh', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind19', 'Tilak Varma', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind20', 'Jitesh Sharma', 'Wicketkeeper', 81, 'IND', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ind21', 'Sanju Samson', 'Wicketkeeper', 81, 'IND', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ind22', 'Shivam Dube', 'All-rounder', 85, 'IND', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ind11', 'Jasprit Bumrah', 'Bowler', 99, 'IND', 15, 99, { aggression: 60, temperament: 95, form: 95, matches: 89, wickets: 149, economy: 4.6 }),
  intlPlayer('ind24', 'Varun Chakravarthy', 'Bowler', 83, 'IND', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ind25', 'Sai Sudharsan', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind26', 'Devdutt Padikkal', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind27', 'Abhimanyu Easwaran', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind28', 'Karun Nair', 'Batsman', 82, 'IND', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ind6', 'Rishabh Pant', 'Wicketkeeper', 90, 'IND', 91, 0, { aggression: 90, temperament: 72, form: 85, matches: 33, runs: 871, strikeRate: 105.4 }),
  intlPlayer('ind8', 'Ravindra Jadeja', 'All-rounder', 92, 'IND', 82, 90, { aggression: 75, temperament: 88, form: 80, matches: 197, runs: 2756, wickets: 220 }),
  intlPlayer('ind31', 'Shardul Thakur', 'All-rounder', 85, 'IND', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ind32', 'Akash Deep', 'Bowler', 83, 'IND', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ind33', 'Hardik Pandya', 'All-rounder', 93, 'IND', 88, 86, { aggression: 90, temperament: 84, form: 90, matches: 86, runs: 1348, wickets: 84 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  AUS
// ═══════════════════════════════════════════════════════════════════════
const AUS_PLAYERS: Player[] = [
  intlPlayer('aus6', 'Mitchell Marsh', 'All-rounder', 88, 'AUS', 86, 78, { aggression: 82, temperament: 76, form: 78, matches: 73, runs: 1721, wickets: 33 }),
  intlPlayer('aus1', 'Travis Head', 'Batsman', 94, 'AUS', 95, 0, { aggression: 90, temperament: 82, form: 92, matches: 48, runs: 2222, strikeRate: 105.5 }),
  intlPlayer('aus4', 'Marnus Labuschagne', 'Batsman', 90, 'AUS', 90, 15, { aggression: 68, temperament: 90, form: 80, matches: 45, runs: 1886, strikeRate: 85.1 }),
  intlPlayer('aus36', 'Mitchell Owen', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus37', 'Matthew Renshaw', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus38', 'Matthew Short', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus7', 'Alex Carey', 'Wicketkeeper', 86, 'AUS', 85, 0, { aggression: 78, temperament: 80, form: 78, matches: 50, runs: 1380 }),
  intlPlayer('aus40', 'Josh Philippe', 'Wicketkeeper', 81, 'AUS', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('aus14', 'Josh Inglis', 'Wicketkeeper', 84, 'AUS', 84, 0, { aggression: 80, temperament: 78, form: 80, matches: 20, runs: 500 }),
  intlPlayer('aus42', 'Cooper Connolly', 'All-rounder', 85, 'AUS', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('aus9', 'Mitchell Starc', 'Bowler', 95, 'AUS', 25, 96, { aggression: 70, temperament: 88, form: 92, matches: 113, wickets: 222, economy: 5.1 }),
  intlPlayer('aus10', 'Josh Hazlewood', 'Bowler', 92, 'AUS', 15, 94, { aggression: 55, temperament: 90, form: 85, matches: 59, wickets: 96, economy: 4.9 }),
  intlPlayer('aus15', 'Nathan Ellis', 'Bowler', 84, 'AUS', 20, 86, { aggression: 60, temperament: 78, form: 78, matches: 15, wickets: 20, economy: 7.8 }),
  intlPlayer('aus46', 'Xavier Bartlett', 'Bowler', 83, 'AUS', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('aus11', 'Adam Zampa', 'Bowler', 90, 'AUS', 30, 92, { aggression: 48, temperament: 84, form: 86, matches: 82, wickets: 131, economy: 5.3 }),
  intlPlayer('aus48', 'Matt Short', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus49', 'Tim David', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus13', 'Marcus Stoinis', 'All-rounder', 87, 'AUS', 86, 76, { aggression: 86, temperament: 74, form: 80, matches: 46, runs: 1090, wickets: 11 }),
  intlPlayer('aus5', 'Glenn Maxwell', 'All-rounder', 92, 'AUS', 90, 70, { aggression: 94, temperament: 68, form: 82, matches: 142, runs: 3878, wickets: 43 }),
  intlPlayer('aus52', 'Sean Abbott', 'All-rounder', 85, 'AUS', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('aus53', 'Ben Dwarshuis', 'Bowler', 83, 'AUS', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('aus8', 'Pat Cummins', 'Bowler', 96, 'AUS', 30, 97, { aggression: 62, temperament: 92, form: 90, matches: 95, wickets: 161, economy: 5.3 }),
  intlPlayer('aus55', 'Usman Khawaja', 'Batsman', 82, 'AUS', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('aus2', 'Steve Smith', 'Batsman', 93, 'AUS', 94, 0, { aggression: 72, temperament: 96, form: 80, matches: 161, runs: 6068, strikeRate: 87.5 }),
  intlPlayer('aus12', 'Cameron Green', 'All-rounder', 88, 'AUS', 85, 82, { aggression: 78, temperament: 80, form: 78, matches: 30, runs: 660, wickets: 16 }),
  intlPlayer('aus58', 'Nathan Lyon', 'Bowler', 83, 'AUS', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('aus59', 'Scott Boland', 'Bowler', 83, 'AUS', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('aus60', 'Todd Murphy', 'Bowler', 83, 'AUS', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  ENG
// ═══════════════════════════════════════════════════════════════════════
const ENG_PLAYERS: Player[] = [
  intlPlayer('eng3', 'Harry Brook', 'Batsman', 90, 'ENG', 92, 0, { aggression: 88, temperament: 78, form: 88, matches: 30, runs: 1100, strikeRate: 125.5 }),
  intlPlayer('eng62', 'Ben Duckett', 'Batsman', 82, 'ENG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('eng2', 'Joe Root', 'Batsman', 95, 'ENG', 96, 15, { aggression: 65, temperament: 96, form: 88, matches: 170, runs: 6486, strikeRate: 86.0 }),
  intlPlayer('eng64', 'Jamie Smith', 'Batsman', 82, 'ENG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('eng1', 'Jos Buttler', 'Wicketkeeper', 94, 'ENG', 94, 0, { aggression: 92, temperament: 80, form: 82, matches: 183, runs: 5524, strikeRate: 119.5 }),
  intlPlayer('eng12', 'Jacob Bethell', 'All-rounder', 84, 'ENG', 84, 72, { aggression: 82, temperament: 76, form: 85, matches: 15, runs: 350 }),
  intlPlayer('eng15', 'Will Jacks', 'All-rounder', 86, 'ENG', 88, 68, { aggression: 90, temperament: 72, form: 82, matches: 25, runs: 650 }),
  intlPlayer('eng68', 'Jamie Overton', 'All-rounder', 85, 'ENG', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('eng69', 'Brydon Carse', 'All-rounder', 85, 'ENG', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('eng8', 'Jofra Archer', 'Bowler', 92, 'ENG', 25, 94, { aggression: 72, temperament: 82, form: 78, matches: 28, wickets: 46, economy: 5.2 }),
  intlPlayer('eng71', 'Gus Atkinson', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng72', 'Tom Hartley', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng73', 'Saqib Mahmood', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng74', 'Matthew Potts', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng10', 'Adil Rashid', 'Bowler', 90, 'ENG', 30, 91, { aggression: 50, temperament: 86, form: 82, matches: 133, wickets: 185, economy: 5.5 }),
  intlPlayer('eng4', 'Phil Salt', 'Wicketkeeper', 89, 'ENG', 92, 0, { aggression: 94, temperament: 72, form: 90, matches: 40, runs: 1450, strikeRate: 158.2 }),
  intlPlayer('eng14', 'Sam Curran', 'All-rounder', 86, 'ENG', 78, 84, { aggression: 78, temperament: 78, form: 80, matches: 47, runs: 455, wickets: 50 }),
  intlPlayer('eng9', 'Mark Wood', 'Bowler', 89, 'ENG', 20, 90, { aggression: 68, temperament: 78, form: 82, matches: 42, wickets: 65, economy: 5.7 }),
  intlPlayer('eng13', 'Reece Topley', 'Bowler', 85, 'ENG', 20, 88, { aggression: 55, temperament: 80, form: 78, matches: 25, wickets: 38, economy: 5.1 }),
  intlPlayer('eng5', 'Ben Stokes', 'All-rounder', 93, 'ENG', 88, 85, { aggression: 86, temperament: 88, form: 78, matches: 104, runs: 2919, wickets: 74 }),
  intlPlayer('eng81', 'Zak Crawley', 'Batsman', 82, 'ENG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('eng82', 'Ollie Pope', 'Batsman', 82, 'ENG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('eng16', 'Jonny Bairstow', 'Wicketkeeper', 89, 'ENG', 90, 0, { aggression: 88, temperament: 76, form: 76, matches: 100, runs: 3520, strikeRate: 104.0 }),
  intlPlayer('eng11', 'Chris Woakes', 'All-rounder', 88, 'ENG', 70, 90, { aggression: 60, temperament: 88, form: 78, matches: 111, wickets: 159, economy: 5.4 }),
  intlPlayer('eng85', 'James Anderson', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng86', 'Ollie Robinson', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('eng87', 'Shoaib Bashir', 'Bowler', 83, 'ENG', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  PAK
// ═══════════════════════════════════════════════════════════════════════
const PAK_PLAYERS: Player[] = [
  intlPlayer('pak2', 'Mohammad Rizwan', 'Wicketkeeper', 92, 'PAK', 92, 0, { aggression: 72, temperament: 88, form: 84, matches: 82, runs: 3055, strikeRate: 128.5 }),
  intlPlayer('pak1', 'Babar Azam', 'Batsman', 96, 'PAK', 97, 0, { aggression: 75, temperament: 94, form: 86, matches: 125, runs: 5729, strikeRate: 89.5 }),
  intlPlayer('pak3', 'Fakhar Zaman', 'Batsman', 89, 'PAK', 90, 0, { aggression: 88, temperament: 76, form: 78, matches: 80, runs: 3625, strikeRate: 93.5 }),
  intlPlayer('pak5', 'Saim Ayub', 'Batsman', 87, 'PAK', 89, 0, { aggression: 86, temperament: 78, form: 88, matches: 18, runs: 680, strikeRate: 108.0 }),
  intlPlayer('pak92', 'Hussain Talat', 'Batsman', 82, 'PAK', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('pak93', 'Haseebullah', 'Wicketkeeper', 81, 'PAK', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('pak94', 'Salman Ali Agha', 'All-rounder', 85, 'PAK', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('pak95', 'Faheem Ashraf', 'All-rounder', 85, 'PAK', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('pak11', 'Mohammad Nawaz', 'All-rounder', 85, 'PAK', 74, 84, { aggression: 68, temperament: 80, form: 76, matches: 50, wickets: 45 }),
  intlPlayer('pak8', 'Shaheen Shah Afridi', 'Bowler', 94, 'PAK', 20, 96, { aggression: 72, temperament: 86, form: 86, matches: 62, wickets: 110, economy: 5.0 }),
  intlPlayer('pak16', 'Abrar Ahmed', 'Bowler', 84, 'PAK', 28, 86, { aggression: 50, temperament: 76, form: 80, matches: 10, wickets: 18 }),
  intlPlayer('pak9', 'Haris Rauf', 'Bowler', 88, 'PAK', 18, 90, { aggression: 70, temperament: 76, form: 80, matches: 45, wickets: 75, economy: 5.8 }),
  intlPlayer('pak10', 'Naseem Shah', 'Bowler', 87, 'PAK', 20, 89, { aggression: 68, temperament: 78, form: 80, matches: 22, wickets: 36, economy: 5.0 }),
  intlPlayer('pak101', 'Mohammad Wasim Jnr', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('pak102', 'Hasan Nawaz', 'Batsman', 82, 'PAK', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('pak103', 'Mohammad Haris', 'Wicketkeeper', 81, 'PAK', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('pak104', 'Usman Khan', 'Wicketkeeper', 81, 'PAK', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('pak6', 'Shadab Khan', 'All-rounder', 88, 'PAK', 78, 85, { aggression: 78, temperament: 80, form: 78, matches: 80, runs: 950, wickets: 90 }),
  intlPlayer('pak106', 'Khushdil Shah', 'All-rounder', 85, 'PAK', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('pak107', 'Hasan Ali', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('pak108', 'Shan Masood', 'Batsman', 82, 'PAK', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('pak14', 'Abdullah Shafique', 'Batsman', 85, 'PAK', 86, 0, { aggression: 70, temperament: 84, form: 80, matches: 25, runs: 960 }),
  intlPlayer('pak4', 'Imam-ul-Haq', 'Batsman', 86, 'PAK', 87, 0, { aggression: 68, temperament: 84, form: 76, matches: 63, runs: 2753, strikeRate: 82.0 }),
  intlPlayer('pak111', 'Saud Shakeel', 'Batsman', 82, 'PAK', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('pak112', 'Kamran Ghulam', 'Batsman', 82, 'PAK', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('pak113', 'Aamer Jamal', 'All-rounder', 85, 'PAK', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('pak114', 'Sajid Khan', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('pak115', 'Noman Ali', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('pak116', 'Faisal Akram', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('pak117', 'Asif Afridi', 'Bowler', 83, 'PAK', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  NZ
// ═══════════════════════════════════════════════════════════════════════
const NZ_PLAYERS: Player[] = [
  intlPlayer('nz7', 'Mitchell Santner', 'All-rounder', 87, 'NZ', 72, 88, { aggression: 60, temperament: 84, form: 80, matches: 75, wickets: 80, economy: 5.5 }),
  intlPlayer('nz14', 'Mark Chapman', 'Batsman', 83, 'NZ', 84, 0, { aggression: 76, temperament: 78, form: 78, matches: 25, runs: 600 }),
  intlPlayer('nz2', 'Devon Conway', 'Batsman', 89, 'NZ', 90, 0, { aggression: 72, temperament: 86, form: 82, matches: 30, runs: 1050, strikeRate: 91.2 }),
  intlPlayer('nz6', 'Daryl Mitchell', 'All-rounder', 89, 'NZ', 88, 65, { aggression: 80, temperament: 84, form: 85, matches: 60, runs: 2200, strikeRate: 98.0 }),
  intlPlayer('nz3', 'Rachin Ravindra', 'All-rounder', 88, 'NZ', 88, 72, { aggression: 80, temperament: 82, form: 86, matches: 25, runs: 780 }),
  intlPlayer('nz123', 'Will Young', 'Batsman', 82, 'NZ', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('nz5', 'Tom Latham', 'Wicketkeeper', 87, 'NZ', 86, 0, { aggression: 65, temperament: 88, form: 78, matches: 120, runs: 3880, strikeRate: 84.5 }),
  intlPlayer('nz15', 'Michael Bracewell', 'All-rounder', 84, 'NZ', 78, 80, { aggression: 76, temperament: 78, form: 78, matches: 30, wickets: 25 }),
  intlPlayer('nz126', 'Zak Foulkes', 'All-rounder', 85, 'NZ', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('nz127', 'Kyle Jamieson', 'All-rounder', 85, 'NZ', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('nz128', 'Jacob Duffy', 'Bowler', 83, 'NZ', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('nz11', 'Matt Henry', 'Bowler', 88, 'NZ', 22, 90, { aggression: 58, temperament: 82, form: 80, matches: 55, wickets: 80, economy: 5.0 }),
  intlPlayer('nz130', 'Nathan Smith', 'Bowler', 83, 'NZ', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('nz131', 'Blair Tickner', 'Bowler', 83, 'NZ', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('nz13', 'Finn Allen', 'Batsman', 85, 'NZ', 88, 0, { aggression: 94, temperament: 68, form: 82, matches: 30, runs: 750, strikeRate: 160.0 }),
  intlPlayer('nz4', 'Glenn Phillips', 'Batsman', 87, 'NZ', 88, 20, { aggression: 88, temperament: 74, form: 82, matches: 70, runs: 1600, strikeRate: 145.0 }),
  intlPlayer('nz16', 'Tim Seifert', 'Wicketkeeper', 82, 'NZ', 82, 0, { aggression: 82, temperament: 72, form: 76, matches: 30, runs: 500 }),
  intlPlayer('nz10', 'Lockie Ferguson', 'Bowler', 89, 'NZ', 18, 91, { aggression: 68, temperament: 78, form: 82, matches: 38, wickets: 60, economy: 5.3 }),
  intlPlayer('nz12', 'Ish Sodhi', 'Bowler', 84, 'NZ', 28, 86, { aggression: 50, temperament: 78, form: 76, matches: 65, wickets: 80, economy: 6.0 }),
  intlPlayer('nz9', 'Tim Southee', 'Bowler', 90, 'NZ', 30, 92, { aggression: 60, temperament: 86, form: 76, matches: 158, wickets: 222, economy: 5.6 }),
  intlPlayer('nz1', 'Kane Williamson', 'Batsman', 94, 'NZ', 95, 10, { aggression: 62, temperament: 98, form: 82, matches: 173, runs: 6806, strikeRate: 83.5 }),
  intlPlayer('nz139', 'Tom Blundell', 'Wicketkeeper', 81, 'NZ', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('nz140', 'Ajaz Patel', 'Bowler', 83, 'NZ', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  SA
// ═══════════════════════════════════════════════════════════════════════
const SA_PLAYERS: Player[] = [
  intlPlayer('sa14', 'Temba Bavuma', 'Batsman', 86, 'SA', 84, 0, { aggression: 65, temperament: 88, form: 76, matches: 60, runs: 1600, strikeRate: 80.0 }),
  intlPlayer('sa142', 'Matthew Breetzke', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa143', 'Dewald Brevis', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa144', 'Tony de Zorzi', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa145', 'Rubin Hermann', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa1', 'Quinton de Kock', 'Wicketkeeper', 93, 'SA', 94, 0, { aggression: 88, temperament: 82, form: 82, matches: 166, runs: 6414, strikeRate: 96.5 }),
  intlPlayer('sa15', 'Ryan Rickelton', 'Batsman', 84, 'SA', 86, 0, { aggression: 76, temperament: 78, form: 82, matches: 12, runs: 420, strikeRate: 95.0 }),
  intlPlayer('sa7', 'Marco Jansen', 'All-rounder', 89, 'SA', 72, 90, { aggression: 75, temperament: 80, form: 85, matches: 30, wickets: 52 }),
  intlPlayer('sa149', 'Corbin Bosch', 'All-rounder', 85, 'SA', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('sa150', 'Ottneil Baartman', 'Bowler', 83, 'SA', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sa151', 'Nandre Burger', 'Bowler', 83, 'SA', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sa12', 'Keshav Maharaj', 'Bowler', 87, 'SA', 40, 89, { aggression: 45, temperament: 84, form: 78, matches: 38, wickets: 45, economy: 5.0 }),
  intlPlayer('sa10', 'Lungi Ngidi', 'Bowler', 88, 'SA', 18, 90, { aggression: 65, temperament: 80, form: 78, matches: 36, wickets: 63, economy: 5.6 }),
  intlPlayer('sa154', 'Prenelan Subrayen', 'Bowler', 83, 'SA', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sa2', 'Aiden Markram', 'Batsman', 90, 'SA', 90, 15, { aggression: 78, temperament: 84, form: 82, matches: 45, runs: 1489, strikeRate: 92.0 }),
  intlPlayer('sa156', 'Reeza Hendricks', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa3', 'Heinrich Klaasen', 'Wicketkeeper', 92, 'SA', 93, 0, { aggression: 92, temperament: 78, form: 90, matches: 50, runs: 1800, strikeRate: 145.3 }),
  intlPlayer('sa4', 'David Miller', 'Batsman', 89, 'SA', 88, 0, { aggression: 84, temperament: 82, form: 78, matches: 178, runs: 4430, strikeRate: 101.0 }),
  intlPlayer('sa6', 'Tristan Stubbs', 'Batsman', 86, 'SA', 87, 0, { aggression: 88, temperament: 74, form: 82, matches: 20, runs: 400, strikeRate: 150.2 }),
  intlPlayer('sa160', 'Andile Phehlukwayo', 'All-rounder', 85, 'SA', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('sa8', 'Kagiso Rabada', 'Bowler', 94, 'SA', 20, 96, { aggression: 68, temperament: 88, form: 88, matches: 115, wickets: 179, economy: 5.2 }),
  intlPlayer('sa9', 'Anrich Nortje', 'Bowler', 90, 'SA', 15, 92, { aggression: 72, temperament: 82, form: 80, matches: 35, wickets: 60, economy: 5.0 }),
  intlPlayer('sa13', 'Tabraiz Shamsi', 'Bowler', 86, 'SA', 30, 88, { aggression: 48, temperament: 80, form: 76, matches: 48, wickets: 65, economy: 5.4 }),
  intlPlayer('sa164', 'David Bedingham', 'Batsman', 82, 'SA', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sa165', 'Kyle Verreynne', 'Wicketkeeper', 81, 'SA', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('sa166', 'Wiaan Mulder', 'All-rounder', 85, 'SA', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('sa167', 'Simon Harmer', 'Bowler', 83, 'SA', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sa168', 'Senuran Muthusamy', 'Bowler', 83, 'SA', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  SL
// ═══════════════════════════════════════════════════════════════════════
const SL_PLAYERS: Player[] = [
  intlPlayer('sl3', 'Charith Asalanka', 'Batsman', 87, 'SL', 88, 15, { aggression: 80, temperament: 80, form: 84, matches: 45, runs: 1400, strikeRate: 95.0 }),
  intlPlayer('sl1', 'Pathum Nissanka', 'Batsman', 90, 'SL', 92, 0, { aggression: 82, temperament: 84, form: 86, matches: 50, runs: 2100, strikeRate: 92.5 }),
  intlPlayer('sl16', 'Avishka Fernando', 'Batsman', 83, 'SL', 84, 0, { aggression: 80, temperament: 74, form: 76, matches: 30, runs: 700 }),
  intlPlayer('sl172', 'Nishan Madushka', 'Batsman', 82, 'SL', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sl2', 'Kusal Mendis', 'Wicketkeeper', 88, 'SL', 88, 0, { aggression: 84, temperament: 78, form: 82, matches: 78, runs: 2800, strikeRate: 90.0 }),
  intlPlayer('sl13', 'Sadeera Samarawickrama', 'Wicketkeeper', 82, 'SL', 82, 0, { aggression: 76, temperament: 76, form: 76, matches: 20, runs: 450 }),
  intlPlayer('sl4', 'Kamindu Mendis', 'All-rounder', 88, 'SL', 88, 72, { aggression: 78, temperament: 82, form: 86, matches: 30, runs: 1100 }),
  intlPlayer('sl176', 'Janith Liyanage', 'All-rounder', 85, 'SL', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('sl12', 'Dunith Wellalage', 'All-rounder', 84, 'SL', 74, 84, { aggression: 68, temperament: 78, form: 82, matches: 25, wickets: 30 }),
  intlPlayer('sl6', 'Wanindu Hasaranga', 'All-rounder', 91, 'SL', 70, 92, { aggression: 72, temperament: 82, form: 84, matches: 65, wickets: 90, economy: 5.8 }),
  intlPlayer('sl8', 'Maheesh Theekshana', 'Bowler', 86, 'SL', 25, 88, { aggression: 50, temperament: 80, form: 80, matches: 35, wickets: 48, economy: 5.5 }),
  intlPlayer('sl180', 'Jeffrey Vandersay', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl181', 'Milan Rathnayake', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl10', 'Dilshan Madushanka', 'Bowler', 84, 'SL', 20, 86, { aggression: 58, temperament: 78, form: 80, matches: 18, wickets: 28, economy: 5.4 }),
  intlPlayer('sl183', 'Asitha Fernando', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl184', 'Eshan Malinga', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl185', 'Kusal Perera', 'Batsman', 82, 'SL', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sl186', 'Dinesh Chandimal', 'Wicketkeeper', 81, 'SL', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('sl5', 'Dasun Shanaka', 'All-rounder', 85, 'SL', 82, 78, { aggression: 82, temperament: 78, form: 76, matches: 90, runs: 1600, wickets: 35 }),
  intlPlayer('sl9', 'Matheesha Pathirana', 'Bowler', 87, 'SL', 18, 90, { aggression: 65, temperament: 78, form: 84, matches: 25, wickets: 38, economy: 5.8 }),
  intlPlayer('sl11', 'Nuwan Thushara', 'Bowler', 83, 'SL', 18, 85, { aggression: 62, temperament: 76, form: 78, matches: 15, wickets: 22 }),
  intlPlayer('sl190', 'Binura Fernando', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl7', 'Dhananjaya de Silva', 'All-rounder', 86, 'SL', 82, 80, { aggression: 72, temperament: 82, form: 78, matches: 60, runs: 1500, wickets: 40 }),
  intlPlayer('sl192', 'Oshada Fernando', 'Batsman', 82, 'SL', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sl193', 'Lahiru Udara', 'Batsman', 82, 'SL', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('sl14', 'Angelo Mathews', 'All-rounder', 86, 'SL', 84, 65, { aggression: 68, temperament: 88, form: 72, matches: 225, runs: 6401, wickets: 40 }),
  intlPlayer('sl195', 'Sonal Dinusha', 'All-rounder', 85, 'SL', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('sl196', 'Prabath Jayasuriya', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl197', 'Tharindu Ratnayake', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl198', 'Akila Dananjaya', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('sl15', 'Kasun Rajitha', 'Bowler', 82, 'SL', 18, 84, { aggression: 55, temperament: 76, form: 76, matches: 25, wickets: 35 }),
  intlPlayer('sl200', 'Isitha Wijesundara', 'Bowler', 83, 'SL', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  WI
// ═══════════════════════════════════════════════════════════════════════
const WI_PLAYERS: Player[] = [
  intlPlayer('wi2', 'Shai Hope', 'Wicketkeeper', 89, 'WI', 90, 0, { aggression: 72, temperament: 86, form: 84, matches: 100, runs: 4000, strikeRate: 85.5 }),
  intlPlayer('wi202', 'Alick Athanaze', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi203', 'Ackeem Auguste', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi204', 'John Campbell', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi205', 'Keacy Carty', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi206', 'Amir Jangoo', 'Wicketkeeper', 81, 'WI', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('wi207', 'Roston Chase', 'All-rounder', 85, 'WI', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('wi208', 'Justin Greaves', 'All-rounder', 85, 'WI', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('wi6', 'Sherfane Rutherford', 'Batsman', 84, 'WI', 86, 0, { aggression: 88, temperament: 72, form: 78, matches: 20, runs: 350 }),
  intlPlayer('wi210', 'Matthew Forde', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('wi211', 'Johann Layne', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('wi212', 'Khary Pierre', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('wi213', 'Jayden Seales', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('wi4', 'Rovman Powell', 'All-rounder', 86, 'WI', 86, 55, { aggression: 92, temperament: 68, form: 80, matches: 60, runs: 1100, strikeRate: 140.0 }),
  intlPlayer('wi12', 'Brandon King', 'Batsman', 84, 'WI', 86, 0, { aggression: 80, temperament: 76, form: 80, matches: 30, runs: 800, strikeRate: 100.0 }),
  intlPlayer('wi13', 'Kyle Mayers', 'All-rounder', 85, 'WI', 84, 72, { aggression: 84, temperament: 76, form: 80, matches: 25, runs: 650 }),
  intlPlayer('wi1', 'Nicholas Pooran', 'Wicketkeeper', 91, 'WI', 92, 0, { aggression: 92, temperament: 74, form: 84, matches: 95, runs: 2200, strikeRate: 130.0 }),
  intlPlayer('wi7', 'Jason Holder', 'All-rounder', 88, 'WI', 76, 88, { aggression: 62, temperament: 86, form: 78, matches: 129, runs: 2000, wickets: 152 }),
  intlPlayer('wi11', 'Romario Shepherd', 'All-rounder', 84, 'WI', 76, 84, { aggression: 78, temperament: 76, form: 78, matches: 30, wickets: 28 }),
  intlPlayer('wi8', 'Alzarri Joseph', 'Bowler', 87, 'WI', 25, 89, { aggression: 68, temperament: 78, form: 80, matches: 65, wickets: 100, economy: 5.6 }),
  intlPlayer('wi9', 'Akeal Hosein', 'Bowler', 86, 'WI', 30, 88, { aggression: 50, temperament: 82, form: 82, matches: 45, wickets: 55, economy: 5.2 }),
  intlPlayer('wi10', 'Gudakesh Motie', 'Bowler', 85, 'WI', 32, 87, { aggression: 48, temperament: 80, form: 82, matches: 30, wickets: 40, economy: 5.0 }),
  intlPlayer('wi15', 'Obed McCoy', 'Bowler', 83, 'WI', 18, 85, { aggression: 60, temperament: 74, form: 76, matches: 20, wickets: 30 }),
  intlPlayer('wi224', 'Kraigg Brathwaite', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi225', 'Mikyle Louis', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi226', 'Kavem Hodge', 'Batsman', 82, 'WI', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('wi227', 'Joshua Da Silva', 'Wicketkeeper', 81, 'WI', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('wi228', 'Tevin Imlach', 'Wicketkeeper', 81, 'WI', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('wi229', 'Shamar Joseph', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('wi230', 'Jomel Warrican', 'Bowler', 83, 'WI', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  BAN
// ═══════════════════════════════════════════════════════════════════════
const BAN_PLAYERS: Player[] = [
  intlPlayer('ban4', 'Najmul Hossain Shanto', 'Batsman', 86, 'BAN', 86, 0, { aggression: 76, temperament: 80, form: 80, matches: 35, runs: 1100 }),
  intlPlayer('ban5', 'Towhid Hridoy', 'Batsman', 84, 'BAN', 84, 0, { aggression: 78, temperament: 78, form: 82, matches: 20, runs: 600 }),
  intlPlayer('ban233', 'Soumay Sarker', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban234', 'Mohammed Saif Hassan', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban235', 'Mahidul Islam Ankon', 'Wicketkeeper', 81, 'BAN', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ban236', 'Jaker Ali Anik', 'Wicketkeeper', 81, 'BAN', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ban237', 'Quazi Nurul Hasan Sohan', 'Wicketkeeper', 81, 'BAN', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ban238', 'Mehidy Hassan Miraz', 'All-rounder', 85, 'BAN', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ban239', 'Tanzid Hasan Tamim', 'All-rounder', 85, 'BAN', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ban240', 'Shamim Patwari', 'All-rounder', 85, 'BAN', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ban13', 'Rishad Hossain', 'Bowler', 82, 'BAN', 26, 84, { aggression: 52, temperament: 76, form: 78, matches: 15, wickets: 18 }),
  intlPlayer('ban242', 'Tanvir Islam', 'Bowler', 83, 'BAN', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ban7', 'Taskin Ahmed', 'Bowler', 86, 'BAN', 20, 88, { aggression: 65, temperament: 78, form: 80, matches: 55, wickets: 85, economy: 5.6 }),
  intlPlayer('ban8', 'Mustafizur Rahman', 'Bowler', 87, 'BAN', 18, 89, { aggression: 55, temperament: 82, form: 80, matches: 70, wickets: 110, economy: 5.3 }),
  intlPlayer('ban10', 'Tanzim Hasan Sakib', 'Bowler', 82, 'BAN', 18, 84, { aggression: 58, temperament: 76, form: 78, matches: 12, wickets: 18 }),
  intlPlayer('ban246', 'Hasan Mahmud', 'Bowler', 83, 'BAN', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ban12', 'Nasum Ahmed', 'Bowler', 82, 'BAN', 28, 84, { aggression: 48, temperament: 78, form: 76, matches: 20, wickets: 25 }),
  intlPlayer('ban3', 'Litton Das', 'Wicketkeeper', 86, 'BAN', 86, 0, { aggression: 80, temperament: 78, form: 78, matches: 55, runs: 1800 }),
  intlPlayer('ban249', 'Nurul Hasan Sohan', 'Wicketkeeper', 81, 'BAN', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ban6', 'Mehidy Hasan Miraz', 'All-rounder', 86, 'BAN', 74, 86, { aggression: 65, temperament: 82, form: 78, matches: 68, runs: 900, wickets: 70 }),
  intlPlayer('ban251', 'Mahedi Hasan', 'All-rounder', 85, 'BAN', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ban252', 'Shamim Hossain', 'All-rounder', 85, 'BAN', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ban9', 'Shoriful Islam', 'Bowler', 83, 'BAN', 18, 85, { aggression: 60, temperament: 76, form: 78, matches: 25, wickets: 35 }),
  intlPlayer('ban254', 'Mahmudul Hasan Joy', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban255', 'Shadman Islam', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban256', 'Zakir Hasan', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban257', 'Mominul Haque', 'Batsman', 82, 'BAN', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ban2', 'Mushfiqur Rahim', 'Wicketkeeper', 88, 'BAN', 88, 0, { aggression: 72, temperament: 86, form: 76, matches: 267, runs: 7355, strikeRate: 80.5 }),
  intlPlayer('ban259', 'Taijul Islam', 'Bowler', 83, 'BAN', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ban260', 'Nayeem Hasan', 'Bowler', 83, 'BAN', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  AFG
// ═══════════════════════════════════════════════════════════════════════
const AFG_PLAYERS: Player[] = [
  intlPlayer('afg12', 'Hashmatullah Shahidi', 'Batsman', 84, 'AFG', 84, 0, { aggression: 65, temperament: 84, form: 76, matches: 60, runs: 1800 }),
  intlPlayer('afg2', 'Rahmanullah Gurbaz', 'Wicketkeeper', 89, 'AFG', 90, 0, { aggression: 90, temperament: 74, form: 86, matches: 40, runs: 1500, strikeRate: 140.0 }),
  intlPlayer('afg3', 'Ibrahim Zadran', 'Batsman', 87, 'AFG', 88, 0, { aggression: 72, temperament: 84, form: 84, matches: 45, runs: 1800, strikeRate: 85.0 }),
  intlPlayer('afg14', 'Sediqullah Atal', 'Batsman', 82, 'AFG', 84, 0, { aggression: 86, temperament: 70, form: 78, matches: 10, runs: 300 }),
  intlPlayer('afg16', 'Rahmat Shah', 'Batsman', 82, 'AFG', 82, 0, { aggression: 70, temperament: 80, form: 74, matches: 55, runs: 1400 }),
  intlPlayer('afg266', 'Ikram Alikhil', 'Wicketkeeper', 81, 'AFG', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('afg4', 'Azmatullah Omarzai', 'All-rounder', 86, 'AFG', 82, 84, { aggression: 78, temperament: 78, form: 84, matches: 35, runs: 800, wickets: 40 }),
  intlPlayer('afg6', 'Mohammad Nabi', 'All-rounder', 86, 'AFG', 78, 84, { aggression: 72, temperament: 82, form: 74, matches: 150, runs: 2900, wickets: 85 }),
  intlPlayer('afg1', 'Rashid Khan', 'All-rounder', 94, 'AFG', 70, 96, { aggression: 72, temperament: 86, form: 90, matches: 90, wickets: 165, economy: 4.2 }),
  intlPlayer('afg270', 'Nangeyalia Kharote', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('afg271', 'AM Ghazanfar', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('afg272', 'Bilal Sami', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('afg273', 'Hazratullah Zazai', 'Batsman', 82, 'AFG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('afg13', 'Karim Janat', 'All-rounder', 82, 'AFG', 78, 76, { aggression: 78, temperament: 74, form: 76, matches: 30, runs: 500 }),
  intlPlayer('afg7', 'Mujeeb Ur Rahman', 'Bowler', 85, 'AFG', 20, 88, { aggression: 45, temperament: 80, form: 78, matches: 50, wickets: 70, economy: 5.2 }),
  intlPlayer('afg8', 'Naveen-ul-Haq', 'Bowler', 87, 'AFG', 18, 89, { aggression: 68, temperament: 78, form: 82, matches: 40, wickets: 55, economy: 5.5 }),
  intlPlayer('afg9', 'Fazalhaq Farooqi', 'Bowler', 88, 'AFG', 18, 90, { aggression: 62, temperament: 80, form: 86, matches: 35, wickets: 60, economy: 5.0 }),
  intlPlayer('afg11', 'Noor Ahmad', 'Bowler', 84, 'AFG', 22, 86, { aggression: 50, temperament: 78, form: 82, matches: 15, wickets: 22 }),
  intlPlayer('afg279', 'Abdul Malik', 'Batsman', 82, 'AFG', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('afg280', 'Afsar Zazai', 'Wicketkeeper', 81, 'AFG', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('afg281', 'Zahir Khan', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('afg282', 'Nijat Masood', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('afg283', 'Yamin Ahmadzai', 'Bowler', 83, 'AFG', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  ZIM
// ═══════════════════════════════════════════════════════════════════════
const ZIM_PLAYERS: Player[] = [
  intlPlayer('zim2', 'Craig Ervine', 'Batsman', 84, 'ZIM', 84, 0, { aggression: 70, temperament: 84, form: 76, matches: 75, runs: 2500 }),
  intlPlayer('zim285', 'Brian Bennett', 'Batsman', 82, 'ZIM', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('zim286', 'Johnathan Campbell', 'Batsman', 82, 'ZIM', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('zim287', 'Ben Curran', 'Batsman', 82, 'ZIM', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('zim288', 'Joylord Gumbie', 'Batsman', 82, 'ZIM', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('zim16', 'Takudzwanashe Kaitano', 'Batsman', 79, 'ZIM', 78, 0, { aggression: 68, temperament: 76, form: 74, matches: 12, runs: 280 }),
  intlPlayer('zim290', 'Nyasha Mayavo', 'Wicketkeeper', 81, 'ZIM', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('zim291', 'Tadiwanashe Marumani', 'Wicketkeeper', 81, 'ZIM', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('zim1', 'Sikandar Raza', 'All-rounder', 88, 'ZIM', 86, 86, { aggression: 82, temperament: 80, form: 80, matches: 120, runs: 3200, wickets: 55 }),
  intlPlayer('zim3', 'Sean Williams', 'All-rounder', 83, 'ZIM', 82, 78, { aggression: 72, temperament: 80, form: 74, matches: 100, runs: 2400, wickets: 30 }),
  intlPlayer('zim294', 'Wessly Madhevere', 'All-rounder', 85, 'ZIM', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('zim295', 'Wellington Masakadza', 'All-rounder', 85, 'ZIM', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('zim296', 'Tinotenda Maposa', 'All-rounder', 85, 'ZIM', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('zim7', 'Blessing Muzarabani', 'Bowler', 86, 'ZIM', 20, 88, { aggression: 65, temperament: 80, form: 80, matches: 35, wickets: 50, economy: 5.2 }),
  intlPlayer('zim8', 'Richard Ngarava', 'Bowler', 83, 'ZIM', 18, 85, { aggression: 60, temperament: 78, form: 78, matches: 30, wickets: 40 }),
  intlPlayer('zim299', 'Newman Nyamhuri', 'Bowler', 83, 'ZIM', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('zim300', 'Victor Nyauchi', 'Bowler', 83, 'ZIM', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('zim301', 'Trevor Gwandu', 'Bowler', 83, 'ZIM', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('zim13', 'Dion Myers', 'All-rounder', 80, 'ZIM', 76, 74, { aggression: 74, temperament: 74, form: 76, matches: 20, runs: 350 }),
  intlPlayer('zim6', 'Ryan Burl', 'All-rounder', 82, 'ZIM', 78, 78, { aggression: 76, temperament: 76, form: 78, matches: 40, runs: 800, wickets: 25 }),
  intlPlayer('zim304', 'Tashinga Musekiwa', 'All-rounder', 85, 'ZIM', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('zim12', 'Tony Munyonga', 'Batsman', 79, 'ZIM', 80, 0, { aggression: 78, temperament: 72, form: 76, matches: 15, runs: 300 }),
  intlPlayer('zim306', 'Nick Welch', 'Batsman', 82, 'ZIM', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('zim307', 'Vincent Masekesa', 'Bowler', 83, 'ZIM', 30, 85, { aggression: 60, temperament: 80 }),
];

// ═══════════════════════════════════════════════════════════════════════
//  IRE
// ═══════════════════════════════════════════════════════════════════════
const IRE_PLAYERS: Player[] = [
  intlPlayer('ire2', 'Andrew Balbirnie', 'Batsman', 85, 'IRE', 86, 0, { aggression: 72, temperament: 84, form: 78, matches: 110, runs: 3500 }),
  intlPlayer('ire1', 'Paul Stirling', 'Batsman', 87, 'IRE', 88, 15, { aggression: 86, temperament: 78, form: 80, matches: 165, runs: 5100 }),
  intlPlayer('ire3', 'Harry Tector', 'Batsman', 84, 'IRE', 84, 0, { aggression: 74, temperament: 80, form: 80, matches: 55, runs: 1700 }),
  intlPlayer('ire311', 'Morgan Topping', 'Batsman', 82, 'IRE', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ire4', 'Lorcan Tucker', 'Wicketkeeper', 83, 'IRE', 82, 0, { aggression: 76, temperament: 78, form: 78, matches: 45, runs: 1100 }),
  intlPlayer('ire313', 'PJ Moor', 'Wicketkeeper', 81, 'IRE', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ire5', 'Curtis Campher', 'All-rounder', 84, 'IRE', 78, 82, { aggression: 76, temperament: 78, form: 80, matches: 40, runs: 700, wickets: 30 }),
  intlPlayer('ire6', 'George Dockrell', 'All-rounder', 82, 'IRE', 72, 84, { aggression: 62, temperament: 80, form: 76, matches: 120, wickets: 95 }),
  intlPlayer('ire316', 'Andy McBrine', 'All-rounder', 85, 'IRE', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ire317', 'Gavin Hoey', 'All-rounder', 85, 'IRE', 78, 75, { aggression: 80, temperament: 75 }),
  intlPlayer('ire7', 'Mark Adair', 'All-rounder', 83, 'IRE', 72, 84, { aggression: 72, temperament: 78, form: 80, matches: 50, wickets: 45 }),
  intlPlayer('ire16', 'Graham Hume', 'Bowler', 78, 'IRE', 16, 80, { aggression: 55, temperament: 74, form: 74, matches: 12, wickets: 14 }),
  intlPlayer('ire320', 'Matthew Humphreys', 'Bowler', 83, 'IRE', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ire9', 'Barry McCarthy', 'Bowler', 82, 'IRE', 18, 84, { aggression: 58, temperament: 78, form: 78, matches: 40, wickets: 45 }),
  intlPlayer('ire10', 'Craig Young', 'Bowler', 81, 'IRE', 16, 82, { aggression: 55, temperament: 76, form: 76, matches: 30, wickets: 35 }),
  intlPlayer('ire8', 'Josh Little', 'Bowler', 84, 'IRE', 18, 86, { aggression: 62, temperament: 78, form: 82, matches: 35, wickets: 40, economy: 5.8 }),
  intlPlayer('ire324', 'Tim Tector', 'Batsman', 82, 'IRE', 82, 0, { aggression: 75, temperament: 80 }),
  intlPlayer('ire325', 'Neil Rock', 'Wicketkeeper', 81, 'IRE', 80, 0, { aggression: 80, temperament: 75 }),
  intlPlayer('ire12', 'Gareth Delany', 'All-rounder', 80, 'IRE', 78, 76, { aggression: 80, temperament: 72, form: 76, matches: 25, runs: 350 }),
  intlPlayer('ire327', 'Benjamin White', 'Bowler', 83, 'IRE', 30, 85, { aggression: 60, temperament: 80 }),
  intlPlayer('ire328', 'Fionn Hand', 'Bowler', 83, 'IRE', 30, 85, { aggression: 60, temperament: 80 }),
];

export const INTL_PLAYER_POOL: Player[] = [
  ...IND_PLAYERS,
  ...AUS_PLAYERS,
  ...ENG_PLAYERS,
  ...PAK_PLAYERS,
  ...NZ_PLAYERS,
  ...SA_PLAYERS,
  ...SL_PLAYERS,
  ...WI_PLAYERS,
  ...BAN_PLAYERS,
  ...AFG_PLAYERS,
  ...ZIM_PLAYERS,
  ...IRE_PLAYERS
];

export const INTL_TEAMS_DATA = [
  { id: 'IND', name: 'India', shortName: 'IND', primaryColor: '#005f9c', colors: { primary: '#005f9c', secondary: '#ff9933', accent: '#138808' } },
  { id: 'AUS', name: 'Australia', shortName: 'AUS', primaryColor: '#ffcd00', colors: { primary: '#ffcd00', secondary: '#00843D', accent: '#000000' } },
  { id: 'ENG', name: 'England', shortName: 'ENG', primaryColor: '#00247d', colors: { primary: '#00247d', secondary: '#cf142b', accent: '#ffffff' } },
  { id: 'SA', name: 'South Africa', shortName: 'SA', primaryColor: '#007749', colors: { primary: '#007749', secondary: '#ffb81c', accent: '#000000' } },
  { id: 'NZ', name: 'New Zealand', shortName: 'NZ', primaryColor: '#000000', colors: { primary: '#000000', secondary: '#ffffff', accent: '#c0c0c0' } },
  { id: 'PAK', name: 'Pakistan', shortName: 'PAK', primaryColor: '#01411c', colors: { primary: '#01411c', secondary: '#ffffff', accent: '#ffcc00' } },
  { id: 'SL', name: 'Sri Lanka', shortName: 'SL', primaryColor: '#0B2265', colors: { primary: '#0B2265', secondary: '#FFBE29', accent: '#8D153A' } },
  { id: 'WI', name: 'West Indies', shortName: 'WI', primaryColor: '#7b003a', colors: { primary: '#7b003a', secondary: '#ffcc00', accent: '#000000' } },
  { id: 'BAN', name: 'Bangladesh', shortName: 'BAN', primaryColor: '#006a4e', colors: { primary: '#006a4e', secondary: '#f42a41', accent: '#ffffff' } },
  { id: 'AFG', name: 'Afghanistan', shortName: 'AFG', primaryColor: '#0000ff', colors: { primary: '#0000ff', secondary: '#ff0000', accent: '#000000' } },
  { id: 'IRE', name: 'Ireland', shortName: 'IRE', primaryColor: '#169b62', colors: { primary: '#169b62', secondary: '#ff883e', accent: '#ffffff' } },
  { id: 'ZIM', name: 'Zimbabwe', shortName: 'ZIM', primaryColor: '#d62828', colors: { primary: '#d62828', secondary: '#f77f00', accent: '#fcbf49' } }
];
