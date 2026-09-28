import { Player } from '../types/common';
import { PLAYER_RATINGS } from './playerRatings';

// ─── REAL IPL BASE PRICE RULES ───────────────────────────────────────────
// Capped players (played international cricket): max base price ₹2 Cr
// Uncapped Indian players: max base price ₹30 Lakh
// Tiers (real IPL 2026 auction categories):
//   ₹2 Cr, ₹1.5 Cr, ₹1 Cr, ₹75 L, ₹50 L, ₹30 L (uncapped max)
const CAPPED_MAX   = 20000000;   // ₹2 Cr
const UNCAPPED_MAX =  3000000;   // ₹30 Lakh

// clamp base price to real IPL limits based on capped status
const ipl = (price: number, capped: boolean) =>
  capped ? Math.min(price, CAPPED_MAX) : Math.min(price, UNCAPPED_MAX);

const createPlayer = (
  id: string,
  name: string,
  role: Player['role'],
  nationality: Player['nationality'],
  rating: number,
  intendedTeamId: string,
  rawBasePrice: number,       // intended auction price (for internal sorting / squad-cost calc)
  batting = role === 'Bowler' ? 30 : 82,
  bowling = role === 'Batsman' || role === 'Wicketkeeper' ? 0 : 78,
  capped = true,              // false = uncapped player
): Player => {
  const balanced = PLAYER_RATINGS[name];
  const finalBatting = balanced?.batting ?? batting;
  const finalBowling = balanced?.bowling ?? bowling;
  const finalFielding = balanced?.fielding ?? Math.min(96, Math.max(70, rating - 2));
  const finalForm = balanced?.form ?? 85;

  return {
    id,
    name,
    role,
    nationality,
    rating,
    baseAbility: rating,
    form: finalForm,
    basePrice: ipl(rawBasePrice, capped),
    intendedTeamId,
    stats: {
      batting: finalBatting,
      bowling: finalBowling,
      fielding: finalFielding,
    },
  careerStats: {
    matches: 0,
    runs: 0,
    wickets: 0,
    ballsFaced: 0,
    ballsBowled: 0,
    runsConceded: 0,
    dismissals: 0,
    catches: 0
  }
  };
};


// ─── MUMBAI INDIANS (MI) ───────────────────────────────────────────────────
const MI_PLAYERS: Player[] = [
  createPlayer('mi1',  'Rohit Sharma',        'Batsman',     'Indian',   97, '1', 160000000, 97, 0),
  createPlayer('mi2',  'Hardik Pandya',       'All-rounder', 'Indian',   96, '1', 155000000, 93, 89),
  createPlayer('mi3',  'Jasprit Bumrah',      'Bowler',      'Indian',   99, '1', 180000000, 25, 100),
  createPlayer('mi4',  'Suryakumar Yadav',    'Batsman',     'Indian',   98, '1', 165000000, 99, 0),
  createPlayer('mi5',  'Tilak Varma',         'All-rounder', 'Indian',   90, '1',  80000000, 92, 75),
  createPlayer('mi6',  'Trent Boult',         'Bowler',      'Overseas', 96, '1', 125000000, 30, 98),
  createPlayer('mi7',  'Keshav Maharaj',      'Bowler',      'Overseas', 88, '1',  20000000, 40, 90),
  createPlayer('mi8',  'Robin Minz',          'Wicketkeeper','Indian',   79, '1',   3000000, 80, 0),
  createPlayer('mi9',  'Ryan Rickelton',      'Wicketkeeper','Overseas', 85, '1',   7500000, 88, 0),
  createPlayer('mi10', 'Will Jacks',          'All-rounder', 'Overseas', 90, '1',  15000000, 92, 70),
  createPlayer('mi11', 'Quinton de Kock',     'Wicketkeeper','Overseas', 92, '1',  20000000, 94, 0),
  createPlayer('mi12', 'Shardul Thakur',      'All-rounder', 'Indian',   86, '1',  50000000, 75, 88),
  createPlayer('mi13', 'Deepak Chahar',       'Bowler',      'Indian',   87, '1',  50000000, 60, 89),
  createPlayer('mi14', 'Naman Dhir',          'All-rounder', 'Indian',   84, '1',  30000000, 87, 35),
  createPlayer('mi15', 'Danish Malewar',      'All-rounder', 'Indian',   76, '1',   3000000, 78, 55),
  createPlayer('mi16', 'Mayank Rawat',        'Batsman',     'Indian',   76, '1',   3000000, 78, 0),
  createPlayer('mi17', 'Sherfane Rutherford', 'All-rounder', 'Overseas', 88, '1',  30000000, 91, 62),
  createPlayer('mi18', 'Corbin Bosch',        'All-rounder', 'Overseas', 86, '1',  10000000, 76, 88),
  createPlayer('mi19', 'Raj Angad Bawa',      'All-rounder', 'Indian',   80, '1',   3000000, 78, 78),
  createPlayer('mi20', 'Mitchell Santner',    'All-rounder', 'Overseas', 90, '1',  15000000, 78, 92),
  createPlayer('mi21', 'Raghu Sharma',        'Bowler',      'Indian',   76, '1',   3000000, 20, 80),
  createPlayer('mi22', 'Mayank Markande',     'Bowler',      'Indian',   86, '1',   3000000, 25, 88),
  createPlayer('mi23', 'Allah Mohammad Ghazanfar','Bowler',  'Overseas', 88, '1',  20000000, 25, 91),
  createPlayer('mi24', 'Ashwani Kumar',       'Bowler',      'Indian',   78, '1',   3000000, 20, 82),
  createPlayer('mi25', 'Mohammed Izhar',      'Bowler',      'Indian',   74, '1',   3000000, 20, 78),
  createPlayer('mi26', 'Ruchit Ahir',         'Bowler',      'Indian',   76, '1',   3000000, 20, 79),
  createPlayer('mi27', 'Mahipal Lomror',      'All-rounder', 'Indian',   80, '1',   3000000, 80, 70),
  createPlayer('mi28', 'Krish Bhagat',        'Batsman',     'Indian',   74, '1',   3000000, 75, 0),
];

// ─── CHENNAI SUPER KINGS (CSK) ────────────────────────────────────────────
const CSK_PLAYERS: Player[] = [
  createPlayer('csk1',  'Ruturaj Gaikwad',  'Batsman',     'Indian',   92, '2', 180000000, 94, 0),
  createPlayer('csk2',  'MS Dhoni',         'Wicketkeeper','Indian',   90, '2',  40000000, 88, 0),
  createPlayer('csk3',  'Sanju Samson',     'Wicketkeeper','Indian',   91, '2', 180000000, 94, 0),
  createPlayer('csk4',  'Shivam Dube',      'All-rounder', 'Indian',   89, '2', 120000000, 92, 75),
  createPlayer('csk5',  'Noor Ahmad',       'Bowler',      'Overseas', 90, '2', 100000000, 30, 94),
  createPlayer('csk6',  'Khaleel Ahmed',    'Bowler',      'Indian',   88, '2',  40000000, 20, 90),
  createPlayer('csk7',  'Rahul Chahar',     'Bowler',      'Indian',   86, '2',  50000000, 35, 88),
  createPlayer('csk8',  'Ayush Mhatre',     'Batsman',     'Indian',   79, '2',   4000000, 80, 0),
  createPlayer('csk9',  'Urvil Patel',      'Wicketkeeper','Indian',   77, '2',   3000000, 78, 0),
  createPlayer('csk10', 'Kartik Sharma',    'All-rounder', 'Indian',   76, '2',   3000000, 78, 60),
  createPlayer('csk11', 'Aman Khan',        'Batsman',     'Indian',   80, '2',  20000000, 82, 0),
  createPlayer('csk12', 'Sarfaraz Khan',    'Batsman',     'Indian',   84, '2',  30000000, 88, 0),
  createPlayer('csk13', 'Akeal Hosein',     'All-rounder', 'Overseas', 88, '2',  15000000, 55, 91),
  createPlayer('csk14', 'Anshul Kamboj',    'Bowler',      'Indian',   82, '2',   3000000, 25, 84),
  createPlayer('csk15', 'Gurjapneet Singh', 'Bowler',      'Indian',   78, '2',   3000000, 15, 80),
  createPlayer('csk16', 'Mukesh Choudhary', 'Bowler',      'Indian',   84, '2',   3000000, 20, 86),
  createPlayer('csk17', 'Matt Henry',       'Bowler',      'Overseas', 89, '2',  20000000, 35, 92),
  createPlayer('csk18', 'Zak Foulkes',      'Bowler',      'Overseas', 80, '2',   7500000, 25, 82),
  createPlayer('csk19', 'Spencer Johnson',  'Bowler',      'Overseas', 87, '2',  50000000, 25, 91),
  createPlayer('csk20', 'Dewald Brevis',    'All-rounder', 'Overseas', 85, '2',  20000000, 88, 60),
  createPlayer('csk21', 'Shreyas Gopal',    'All-rounder', 'Indian',   82, '2',   3000000, 65, 84),
  createPlayer('csk22', 'Jamie Overton',    'All-rounder', 'Overseas', 86, '2',  15000000, 78, 88),
  createPlayer('csk23', 'Prashant Veer',    'All-rounder', 'Indian',   74, '2',   3000000, 72, 74),
  createPlayer('csk24', 'Matthew Short',    'All-rounder', 'Overseas', 88, '2',  15000000, 90, 74),
  createPlayer('csk25', 'Akash Madhwal',    'Bowler',      'Indian',   83, '2',   3000000, 20, 85),
  createPlayer('csk26', 'Kuldip Yadav',     'Bowler',      'Indian',   78, '2',   3000000, 15, 80),
  createPlayer('csk27', 'Ramakrishna Ghosh','All-rounder', 'Indian',   75, '2',   3000000, 74, 72),
  createPlayer('csk28', 'Macneil Noronha',  'Batsman',     'Indian',   74, '2',   3000000, 75, 0),
  createPlayer('csk29', 'Dian Forrester',   'All-rounder', 'Overseas', 76, '2',   3000000, 74, 75),
];

// ─── DELHI CAPITALS (DC) ──────────────────────────────────────────────────
const DC_PLAYERS: Player[] = [
  createPlayer('dc1',  'Axar Patel',          'All-rounder', 'Indian',   94, '7', 165000000, 88, 95),
  createPlayer('dc2',  'Kuldeep Yadav',       'Bowler',      'Indian',   95, '7', 132500000, 40, 97),
  createPlayer('dc3',  'Mitchell Starc',      'Bowler',      'Overseas', 96, '7', 117500000, 55, 98),
  createPlayer('dc4',  'KL Rahul',            'Wicketkeeper','Indian',   94, '7', 140000000, 95, 0),
  createPlayer('dc5',  'Tristan Stubbs',      'Batsman',     'Overseas', 93, '7', 100000000, 95, 30),
  createPlayer('dc6',  'David Miller',        'Batsman',     'Overseas', 90, '7',  75000000, 93, 0),
  createPlayer('dc7',  'Nitish Rana',         'Batsman',     'Indian',   88, '7',  40000000, 89, 35),
  createPlayer('dc8',  'Sameer Rizvi',        'Batsman',     'Indian',   82, '7',   9500000, 84, 40),
  createPlayer('dc9',  'Karun Nair',          'Batsman',     'Indian',   87, '7',  15000000, 89, 0),
  createPlayer('dc10', 'Prithvi Shaw',        'Batsman',     'Indian',   87, '7',   7500000, 90, 0),
  createPlayer('dc11', 'Abishek Porel',       'Wicketkeeper','Indian',   82, '7',   3000000, 84, 0),
  createPlayer('dc12', 'Ashutosh Sharma',     'All-rounder', 'Indian',   82, '7',  20000000, 82, 75),
  createPlayer('dc13', 'Pathum Nissanka',     'Batsman',     'Overseas', 87, '7',  20000000, 89, 30),
  createPlayer('dc14', 'Mukesh Kumar',        'Bowler',      'Indian',   86, '7',  15000000, 25, 89),
  createPlayer('dc15', 'T Natarajan',         'Bowler',      'Indian',   88, '7',  30000000, 25, 91),
  createPlayer('dc16', 'Dushmantha Chameera', 'Bowler',      'Overseas', 87, '7',  10000000, 25, 89),
  createPlayer('dc17', 'Lungi Ngidi',         'Bowler',      'Overseas', 88, '7',  15000000, 30, 90),
  createPlayer('dc18', 'Kyle Jamieson',       'All-rounder', 'Overseas', 88, '7',  20000000, 72, 89),
  createPlayer('dc19', 'Vipraj Nigam',        'Bowler',      'Indian',   76, '7',   3000000, 20, 79),
  createPlayer('dc20', 'Madhav Tiwari',       'Bowler',      'Indian',   74, '7',   3000000, 15, 77),
  createPlayer('dc21', 'Ajay Jadav Mandal',   'All-rounder', 'Indian',   76, '7',   3000000, 72, 76),
  createPlayer('dc22', 'Auqib Nabi',          'Bowler',      'Indian',   78, '7',   3000000, 20, 80),
  createPlayer('dc23', 'Rehan Ahmed',         'Bowler',      'Overseas', 84, '7',  15000000, 35, 86),
  createPlayer('dc24', 'Sahil Parakh',        'Bowler',      'Indian',   76, '7',   3000000, 20, 78),
  createPlayer('dc25', 'Tripurana Vijay',     'Batsman',     'Indian',   78, '7',   3000000, 80, 0),
];

// ─── PUNJAB KINGS (PBKS) ──────────────────────────────────────────────────
const PBKS_PLAYERS: Player[] = [
  createPlayer('pbks1',  'Shreyas Iyer',       'Batsman',     'Indian',   91, '10', 267500000, 93, 0),
  createPlayer('pbks2',  'Arshdeep Singh',     'Bowler',      'Indian',   91, '10', 180000000, 25, 94),
  createPlayer('pbks3',  'Yuzvendra Chahal',   'Bowler',      'Indian',   93, '10', 180000000, 10, 97),
  createPlayer('pbks4',  'Marcus Stoinis',     'All-rounder', 'Overseas', 92, '10', 100000000, 91, 85),
  createPlayer('pbks5',  'Marco Jansen',       'All-rounder', 'Overseas', 90, '10',  50000000, 72, 93),
  createPlayer('pbks6',  'Lockie Ferguson',    'Bowler',      'Overseas', 90, '10',  20000000, 25, 94),
  createPlayer('pbks7',  'Prabhsimran Singh',  'Wicketkeeper','Indian',   86, '10',  50000000, 88, 0),
  createPlayer('pbks8',  'Shashank Singh',     'All-rounder', 'Indian',   86, '10',  50000000, 88, 60),
  createPlayer('pbks9',  'Priyansh Arya',      'Batsman',     'Indian',   82, '10',  30000000, 85, 0),
  createPlayer('pbks10', 'Nehal Wadhera',      'Batsman',     'Indian',   84, '10',   4200000, 86, 0),
  createPlayer('pbks11', 'Harnoor Singh',      'Batsman',     'Indian',   76, '10',   3000000, 78, 0),
  createPlayer('pbks12', 'Vishnu Vinod',       'Wicketkeeper','Indian',   78, '10',   3000000, 80, 0),
  createPlayer('pbks13', 'Pyla Avinash',       'Bowler',      'Indian',   76, '10',   3000000, 20, 78),
  createPlayer('pbks14', 'Harpreet Brar',      'All-rounder', 'Indian',   84, '10',  15000000, 74, 86),
  createPlayer('pbks15', 'Praveen Dubey',      'Bowler',      'Indian',   80, '10',   3000000, 30, 84),
  createPlayer('pbks16', 'Vishal Nishad',      'Bowler',      'Indian',   74, '10',   3000000, 20, 76),
  createPlayer('pbks17', 'Vyshak Vijaykumar', 'Bowler',      'Indian',   84, '10',  15000000, 25, 86),
  createPlayer('pbks18', 'Yash Ravisingh Thakur','Bowler',   'Indian',   83, '10',  10000000, 25, 85),
  createPlayer('pbks19', 'Xavier Bartlett',    'Bowler',      'Overseas', 86, '10',  20000000, 28, 89),
  createPlayer('pbks20', 'Ben Dwarshuis',      'Bowler',      'Overseas', 82, '10',   7500000, 25, 84),
  createPlayer('pbks21', 'Musheer Ahmed Khan', 'Batsman',     'Indian',   82, '10',  20000000, 85, 0),
  createPlayer('pbks22', 'Azmatullah Omarzai', 'All-rounder', 'Overseas', 88, '10',  50000000, 82, 88),
  createPlayer('pbks23', 'Suryansh Shedge',    'All-rounder', 'Indian',   76, '10',   3000000, 74, 70),
  createPlayer('pbks24', 'Mitchell Owen',      'Batsman',     'Overseas', 84, '10',   7500000, 86, 0),
  createPlayer('pbks25', 'Cooper Connolly',    'All-rounder', 'Overseas', 84, '10',  10000000, 84, 72),
];

// ─── KOLKATA KNIGHT RIDERS (KKR) ──────────────────────────────────────────
const KKR_PLAYERS: Player[] = [
  createPlayer('kkr1',  'Sunil Narine',         'All-rounder', 'Overseas', 95, '4', 120000000, 82, 98),
  createPlayer('kkr2',  'Varun Chakaravarthy',  'Bowler',      'Indian',   92, '4', 120000000, 15, 96),
  createPlayer('kkr3',  'Rinku Singh',          'Batsman',     'Indian',   92, '4', 130000000, 95, 0),
  createPlayer('kkr4',  'Matheesha Pathirana',  'Bowler',      'Overseas', 94, '4',  20000000, 10, 98),
  createPlayer('kkr5',  'Angkrish Raghuvanshi', 'Batsman',     'Indian',   82, '4',  30000000, 85, 20),
  createPlayer('kkr6',  'Rovman Powell',        'Batsman',     'Overseas', 88, '4',  15000000, 92, 30),
  createPlayer('kkr7',  'Ajinkya Rahane',       'Batsman',     'Indian',   87, '4',  15000000, 89, 0),
  createPlayer('kkr8',  'Manish Pandey',        'Batsman',     'Indian',   85, '4',   7500000, 86, 0),
  createPlayer('kkr9',  'Ramandeep Singh',      'All-rounder', 'Indian',   84, '4',  18000000, 84, 76),
  createPlayer('kkr10', 'Finn Allen',           'Batsman',     'Overseas', 90, '4',  20000000, 93, 0),
  createPlayer('kkr11', 'Tejasvi Dahiya',       'Wicketkeeper','Indian',   74, '4',   3000000, 76, 0),
  createPlayer('kkr12', 'Rahul Tripathi',       'Batsman',     'Indian',   87, '4',   7500000, 88, 10),
  createPlayer('kkr13', 'Tim Seifert',          'Wicketkeeper','Overseas', 88, '4',  15000000, 91, 0),
  createPlayer('kkr14', 'Sarthak Ranjan',       'Wicketkeeper','Indian',   75, '4',   3000000, 78, 0),
  createPlayer('kkr15', 'Luvnith Sujith Sisodia','Wicketkeeper','Indian', 76, '4',   3000000, 78, 0),
  createPlayer('kkr16', 'Vaibhav Arora',        'Bowler',      'Indian',   84, '4',  18000000, 25, 86),
  createPlayer('kkr17', 'Umran Malik',          'Bowler',      'Indian',   88, '4',   7500000, 20, 92),
  createPlayer('kkr18', 'Kartik Tyagi',         'Bowler',      'Indian',   83, '4',   3000000, 30, 85),
  createPlayer('kkr19', 'Blessing Muzarabani',  'Bowler',      'Overseas', 84, '4',   7500000, 25, 86),
  createPlayer('kkr20', 'Saurabh Dubey',        'Bowler',      'Indian',   76, '4',   3000000, 20, 80),
  createPlayer('kkr21', 'Navdeep Saini',        'Bowler',      'Indian',   83, '4',   7500000, 30, 87),
  createPlayer('kkr22', 'Prashant Solanki',     'Bowler',      'Indian',   81, '4',   3000000, 20, 84),
  createPlayer('kkr23', 'Anukul Roy',           'All-rounder', 'Indian',   82, '4',   4000000, 75, 82),
  createPlayer('kkr24', 'Cameron Green',        'All-rounder', 'Overseas', 93, '4',  20000000, 91, 86),
  createPlayer('kkr25', 'Daksh Kamra',          'All-rounder', 'Indian',   74, '4',   3000000, 72, 74),
  createPlayer('kkr26', 'Rachin Ravindra',      'All-rounder', 'Overseas', 92, '4',  20000000, 93, 78),
];

// ─── ROYAL CHALLENGERS BENGALURU (RCB) ────────────────────────────────────
const RCB_PLAYERS: Player[] = [
  createPlayer('rcb1',  'Virat Kohli',      'Batsman',     'Indian',   98, '3', 210000000, 99, 0),
  createPlayer('rcb2',  'Rajat Patidar',    'Batsman',     'Indian',   89, '3', 110000000, 92, 0),
  createPlayer('rcb3',  'Phil Salt',        'Wicketkeeper','Overseas', 92, '3', 115000000, 95, 0),
  createPlayer('rcb4',  'Jitesh Sharma',    'Wicketkeeper','Indian',   89, '3', 110000000, 91, 0),
  createPlayer('rcb5',  'Tim David',        'Batsman',     'Overseas', 88, '3',  10000000, 92, 60),
  createPlayer('rcb6',  'Devdutt Padikkal', 'Batsman',     'Indian',   86, '3',  20000000, 88, 0),
  createPlayer('rcb7',  'Josh Hazlewood',   'Bowler',      'Overseas', 94, '3', 125000000, 35, 96),
  createPlayer('rcb8',  'Bhuvneshwar Kumar','Bowler',      'Indian',   90, '3', 107500000, 45, 92),
  createPlayer('rcb9',  'Krunal Pandya',    'All-rounder', 'Indian',   88, '3',  50000000, 84, 88),
  createPlayer('rcb10', 'Venkatesh Iyer',   'All-rounder', 'Indian',   89, '3',  20000000, 89, 78),
  createPlayer('rcb11', 'Jordan Cox',       'Wicketkeeper','Overseas', 86, '3',  15000000, 88, 0),
  createPlayer('rcb12', 'Satvik Deswal',    'Batsman',     'Indian',   74, '3',   3000000, 75, 0),
  createPlayer('rcb13', 'Suyash Sharma',    'Bowler',      'Indian',   84, '3',   5000000, 20, 87),
  createPlayer('rcb14', 'Vicky Ostwal',     'Bowler',      'Indian',   82, '3',   5000000, 25, 84),
  createPlayer('rcb15', 'Kanishk Chouhan', 'Bowler',       'Indian',   76, '3',   3000000, 25, 78),
  createPlayer('rcb16', 'Rasikh Salam',     'Bowler',      'Indian',   82, '3',   5000000, 25, 84),
  createPlayer('rcb17', 'Nuwan Thushara',   'Bowler',      'Overseas', 86, '3',  10000000, 25, 88),
  createPlayer('rcb18', 'Abhinandan Singh', 'Bowler',      'Indian',   76, '3',   3000000, 20, 78),
  createPlayer('rcb19', 'Jacob Duffy',      'Bowler',      'Overseas', 86, '3',   5000000, 25, 88),
  createPlayer('rcb20', 'Richard Gleeson',  'Bowler',      'Overseas', 84, '3',   5000000, 20, 86),
  createPlayer('rcb21', 'Jacob Bethell',    'All-rounder', 'Overseas', 87, '3',  20000000, 86, 80),
  createPlayer('rcb22', 'Romario Shepherd', 'All-rounder', 'Overseas', 88, '3',  15000000, 84, 88),
  createPlayer('rcb23', 'Swapnil Singh',    'All-rounder', 'Indian',   82, '3',   5000000, 76, 84),
  createPlayer('rcb24', 'Mangesh Yadav',    'Bowler',      'Indian',   76, '3',   3000000, 20, 78),
  createPlayer('rcb25', 'Vihaan Malhotra',  'Batsman',     'Indian',   74, '3',   3000000, 75, 0),
];

// ─── SUNRISERS HYDERABAD (SRH) ────────────────────────────────────────────
const SRH_PLAYERS: Player[] = [
  createPlayer('srh1',  'Pat Cummins',          'All-rounder', 'Overseas', 96, '9', 180000000, 80, 97),
  createPlayer('srh2',  'Heinrich Klaasen',     'Wicketkeeper','Overseas', 97, '9', 230000000, 99, 0),
  createPlayer('srh3',  'Abhishek Sharma',      'All-rounder', 'Indian',   91, '9', 140000000, 95, 78),
  createPlayer('srh4',  'Travis Head',          'Batsman',     'Overseas', 95, '9', 140000000, 96, 40),
  createPlayer('srh5',  'Nitish Kumar Reddy',   'All-rounder', 'Indian',   88, '9',  60000000, 89, 82),
  createPlayer('srh6',  'Ishan Kishan',         'Wicketkeeper','Indian',   91, '9',  15000000, 92, 0),
  createPlayer('srh7',  'Harshal Patel',        'Bowler',      'Indian',   91, '9',  80000000, 70, 92),
  createPlayer('srh8',  'Jaydev Unadkat',       'Bowler',      'Indian',   84, '9',  10000000, 40, 86),
  createPlayer('srh9',  'Liam Livingstone',     'All-rounder', 'Overseas', 91, '9',  20000000, 93, 82),
  createPlayer('srh10', 'Kamindu Mendis',       'All-rounder', 'Overseas', 88, '9',  20000000, 88, 76),
  createPlayer('srh11', 'Aniket Verma',         'Batsman',     'Indian',   78, '9',   3000000, 80, 0),
  createPlayer('srh12', 'Smaran Ravichandran',  'Batsman',     'Indian',   78, '9',   3000000, 80, 0),
  createPlayer('srh13', 'Salil Arora',          'Wicketkeeper','Indian',   76, '9',   3000000, 78, 0),
  createPlayer('srh14', 'Krains Fuletra',       'All-rounder', 'Indian',   74, '9',   3000000, 72, 74),
  createPlayer('srh15', 'Harsh Dubey',          'All-rounder', 'Indian',   82, '9',   5000000, 76, 84),
  createPlayer('srh16', 'Gerald Coetzee',       'Bowler',      'Overseas', 90, '9',  20000000, 35, 93),
  createPlayer('srh17', 'Eshan Malinga',        'Bowler',      'Indian',   80, '9',   3000000, 20, 84),
  createPlayer('srh18', 'Shivam Mavi',          'Bowler',      'Indian',   86, '9',  30000000, 25, 88),
  createPlayer('srh19', 'Sakib Hussain',        'Bowler',      'Indian',   76, '9',   3000000, 20, 78),
  createPlayer('srh20', 'David Payne',          'Bowler',      'Overseas', 84, '9',   7500000, 25, 86),
  createPlayer('srh21', 'Dilshan Madushanka',   'Bowler',      'Overseas', 86, '9',  10000000, 20, 88),
  createPlayer('srh22', 'Zeeshan Ansari',       'Bowler',      'Indian',   76, '9',   3000000, 20, 78),
  createPlayer('srh23', 'RS Ambrish',           'All-rounder', 'Indian',   74, '9',   3000000, 74, 65),
  createPlayer('srh24', 'Shivang Kumar',        'Bowler',      'Indian',   74, '9',   3000000, 20, 76),
  createPlayer('srh25', 'Onkar Tarmale',        'Bowler',      'Indian',   74, '9',   3000000, 20, 76),
  createPlayer('srh26', 'Praful Hinge',         'Bowler',      'Indian',   74, '9',   3000000, 20, 76),
  createPlayer('srh27', 'Amit Kumar',           'Bowler',      'Indian',   74, '9',   3000000, 20, 76),
];

// ─── RAJASTHAN ROYALS (RR) ────────────────────────────────────────────────
const RR_PLAYERS: Player[] = [
  createPlayer('rr1',  'Yashasvi Jaiswal',   'Batsman',     'Indian',   94, '6', 180000000, 97, 10),
  createPlayer('rr2',  'Riyan Parag',        'All-rounder', 'Indian',   90, '6', 140000000, 92, 78),
  createPlayer('rr3',  'Ravindra Jadeja',    'All-rounder', 'Indian',   96, '6', 140000000, 88, 96),
  createPlayer('rr4',  'Jofra Archer',       'Bowler',      'Overseas', 96, '6', 125000000, 50, 98),
  createPlayer('rr5',  'Dhruv Jurel',        'Wicketkeeper','Indian',   88, '6', 140000000, 90, 0),
  createPlayer('rr6',  'Shimron Hetmyer',    'Batsman',     'Overseas', 91, '6', 110000000, 94, 0),
  createPlayer('rr7',  'Ravi Bishnoi',       'Bowler',      'Indian',   90, '6',  20000000, 35, 93),
  createPlayer('rr8',  'Tushar Deshpande',   'Bowler',      'Indian',   85, '6',  65000000, 35, 88),
  createPlayer('rr9',  'Sandeep Sharma',     'Bowler',      'Indian',   86, '6',  40000000, 25, 89),
  createPlayer('rr10', 'Nandre Burger',      'Bowler',      'Overseas', 87, '6',  35000000, 25, 88),
  createPlayer('rr11', 'Vaibhav Sooryavanshi','Batsman',    'Indian',   82, '6',  30000000, 84, 0),
  createPlayer('rr12', 'Aman Rao',           'Batsman',     'Indian',   76, '6',   3000000, 78, 0),
  createPlayer('rr13', 'Shubham Dubey',      'Batsman',     'Indian',   76, '6',   3000000, 78, 0),
  createPlayer('rr14', 'Lhuan-dre Pretorius','Batsman',     'Overseas', 84, '6',  10000000, 87, 30),
  createPlayer('rr15', 'Ravi Singh',         'Bowler',      'Indian',   76, '6',   3000000, 20, 78),
  createPlayer('rr16', 'Vignesh Puthur',     'Bowler',      'Indian',   76, '6',   3000000, 20, 78),
  createPlayer('rr17', 'Yudhvir Singh',      'Bowler',      'Indian',   78, '6',   5000000, 25, 80),
  createPlayer('rr18', 'Kwena Maphaka',      'Bowler',      'Overseas', 82, '6',  10000000, 25, 84),
  createPlayer('rr19', 'Sushant Mishra',     'Bowler',      'Indian',   76, '6',   3000000, 20, 78),
  createPlayer('rr20', 'Brijesh Sharma',     'All-rounder', 'Indian',   74, '6',   3000000, 74, 70),
  createPlayer('rr21', 'Adam Milne',         'Bowler',      'Overseas', 84, '6',   5000000, 25, 86),
  createPlayer('rr22', 'Kuldeep Sen',        'Bowler',      'Indian',   84, '6',  10000000, 25, 88),
  createPlayer('rr23', 'Donovan Ferreira',   'All-rounder', 'Overseas', 84, '6',   7500000, 86, 40),
  createPlayer('rr24', 'Yash Punja',         'Bowler',      'Indian',   74, '6',   3000000, 20, 76),
  createPlayer('rr25', 'Dasun Shanaka',      'All-rounder', 'Overseas', 86, '6',  15000000, 86, 76),
  createPlayer('rr26', 'Emanjot Singh Chahal','Bowler',     'Indian',   74, '6',   3000000, 20, 76),
];

// ─── GUJARAT TITANS (GT) ──────────────────────────────────────────────────
const GT_PLAYERS: Player[] = [
  createPlayer('gt1',  'Shubman Gill',    'Batsman',     'Indian',   95, '5', 165000000, 97, 0),
  createPlayer('gt2',  'Rashid Khan',     'All-rounder', 'Overseas', 98, '5', 180000000, 78, 99),
  createPlayer('gt3',  'Jos Buttler',     'Wicketkeeper','Overseas', 96, '5', 157500000, 98, 0),
  createPlayer('gt4',  'Mohammed Siraj',  'Bowler',      'Indian',   94, '5', 122500000, 20, 96),
  createPlayer('gt5',  'Kagiso Rabada',   'Bowler',      'Overseas', 96, '5', 107500000, 40, 98),
  createPlayer('gt6',  'B Sai Sudharsan', 'Batsman',     'Indian',   89, '5',  85000000, 91, 10),
  createPlayer('gt7',  'Rahul Tewatia',   'All-rounder', 'Indian',   88, '5',  40000000, 90, 82),
  createPlayer('gt8',  'Shahrukh Khan',   'All-rounder', 'Indian',   86, '5',  40000000, 88, 70),
  createPlayer('gt9',  'Washington Sundar','All-rounder','Indian',   89, '5',  30000000, 82, 90),
  createPlayer('gt10', 'Kumar Kushagra',  'Wicketkeeper','Indian',   80, '5',   3000000, 82, 0),
  createPlayer('gt11', 'Anuj Rawat',      'Wicketkeeper','Indian',   82, '5',   5000000, 84, 0),
  createPlayer('gt12', 'Jason Holder',    'All-rounder', 'Overseas', 89, '5',  30000000, 78, 90),
  createPlayer('gt13', 'Nishant Sindhu',  'All-rounder', 'Indian',   82, '5',  10000000, 78, 82),
  createPlayer('gt14', 'Prasidh Krishna', 'Bowler',      'Indian',   90, '5',  50000000, 25, 93),
  createPlayer('gt15', 'Ishant Sharma',   'Bowler',      'Indian',   86, '5',  10000000, 25, 88),
  createPlayer('gt16', 'Gurnoor Brar',    'Bowler',      'Indian',   80, '5',   5000000, 25, 83),
  createPlayer('gt17', 'Ashok Sharma',    'Bowler',      'Indian',   78, '5',   3000000, 20, 82),
  createPlayer('gt18', 'Luke Wood',       'Bowler',      'Overseas', 86, '5',  15000000, 25, 88),
  createPlayer('gt19', 'Sai Kishore',     'Bowler',      'Indian',   86, '5',  15000000, 35, 89),
  createPlayer('gt20', 'Jayant Yadav',    'All-rounder', 'Indian',   84, '5',  10000000, 45, 85),
  createPlayer('gt21', 'Manav Suthar',    'Bowler',      'Indian',   80, '5',   3000000, 30, 83),
  createPlayer('gt22', 'Arshad Khan',     'All-rounder', 'Indian',   80, '5',  20000000, 76, 80),
  createPlayer('gt23', 'Prithvi Raj Yarra','Bowler',     'Indian',   80, '5',   3000000, 25, 83),
  createPlayer('gt24', 'Rashid Khan',     'All-rounder', 'Overseas', 98, '5', 180000000, 78, 99),
  createPlayer('gt25', 'Kulwant Khejroliya','Bowler',    'Indian',   80, '5',   5000000, 25, 83),
  createPlayer('gt26', 'Glenn Phillips',  'All-rounder', 'Overseas', 90, '5',  20000000, 91, 72),
  createPlayer('gt27', 'Connor Esterhuizen','Batsman',   'Overseas', 83, '5',   7500000, 85, 0),
];

// ─── LUCKNOW SUPER GIANTS (LSG) ────────────────────────────────────────────
const LSG_PLAYERS: Player[] = [
  createPlayer('lsg1',  'Rishabh Pant',      'Wicketkeeper','Indian',   96, '8', 270000000, 97, 0),
  createPlayer('lsg2',  'Nicholas Pooran',   'Wicketkeeper','Overseas', 96, '8', 210000000, 98, 0),
  createPlayer('lsg3',  'Mohammed Shami',    'Bowler',      'Indian',   95, '8', 100000000, 35, 96),
  createPlayer('lsg4',  'Mayank Yadav',      'Bowler',      'Indian',   92, '8', 110000000, 20, 98),
  createPlayer('lsg5',  'Avesh Khan',        'Bowler',      'Indian',   88, '8',  97500000, 30, 91),
  createPlayer('lsg6',  'Aiden Markram',     'All-rounder', 'Overseas', 92, '8',  20000000, 93, 72),
  createPlayer('lsg7',  'Mitchell Marsh',    'All-rounder', 'Overseas', 92, '8',  34000000, 94, 85),
  createPlayer('lsg8',  'Anrich Nortje',     'Bowler',      'Overseas', 92, '8',  20000000, 30, 94),
  createPlayer('lsg9',  'Mohsin Khan',       'Bowler',      'Indian',   86, '8',  40000000, 25, 88),
  createPlayer('lsg10', 'Shahbaz Ahmed',     'All-rounder', 'Indian',   85, '8',  24000000, 80, 86),
  createPlayer('lsg11', 'Josh Inglis',       'Wicketkeeper','Overseas', 90, '8',  20000000, 92, 0),
  createPlayer('lsg12', 'Abdul Samad',       'All-rounder', 'Indian',   84, '8',  42000000, 88, 60),
  createPlayer('lsg13', 'Ayush Badoni',      'All-rounder', 'Indian',   83, '8',   4000000, 85, 55),
  createPlayer('lsg14', 'Matthew Breetzke',  'Batsman',     'Overseas', 82, '8',   7500000, 84, 0),
  createPlayer('lsg15', 'Himmat Singh',      'Batsman',     'Indian',   80, '8',   3000000, 82, 0),
  createPlayer('lsg16', 'Manimaran Siddharth','Bowler',    'Indian',   82, '8',   3000000, 30, 85),
  createPlayer('lsg17', 'Digvesh Singh Rathi','Bowler',    'Indian',   76, '8',   3000000, 20, 80),
  createPlayer('lsg18', 'Mukul Choudhary',   'Bowler',      'Indian',   80, '8',   3000000, 25, 83),
  createPlayer('lsg19', 'Akshat Raghuwanshi','Bowler',     'Indian',   76, '8',   3000000, 20, 78),
  createPlayer('lsg20', 'Akash Singh',       'Bowler',      'Indian',   76, '8',   3000000, 20, 78),
  createPlayer('lsg21', 'Arjun Tendulkar',   'Bowler',      'Indian',   78, '8',   3000000, 60, 79),
  createPlayer('lsg22', 'Naman Tiwari',      'Bowler',      'Indian',   76, '8',   3000000, 20, 78),
  createPlayer('lsg23', 'Prince Yadav',      'Batsman',     'Indian',   76, '8',   3000000, 78, 0),
  createPlayer('lsg24', 'George Linde',      'All-rounder', 'Overseas', 85, '8',  10000000, 78, 85),
  createPlayer('lsg25', 'Arshin Kulkarni',   'Batsman',     'Indian',   78, '8',   5000000, 80, 0),
];

function dedupePlayers(players: Player[]) {
  const byName = new Map<string, Player>();
  players.forEach((player) => {
    const existing = byName.get(player.name);
    if (!existing || player.rating > existing.rating) {
      byName.set(player.name, player);
    }
  });
  return Array.from(byName.values());
}

export const INITIAL_PLAYER_POOL: Player[] = dedupePlayers([
  ...MI_PLAYERS, ...CSK_PLAYERS, ...DC_PLAYERS, ...PBKS_PLAYERS,
  ...KKR_PLAYERS, ...RCB_PLAYERS, ...SRH_PLAYERS, ...RR_PLAYERS,
  ...GT_PLAYERS, ...LSG_PLAYERS,
]);
