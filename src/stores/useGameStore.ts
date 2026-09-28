import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Fixture, Standing, MatchStatus, MatchScorecard, InningsData, TossDecision, MatchFormat } from '../types/match';
import { Player } from '../types/common';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { INTL_PLAYER_POOL, INTL_TEAMS_DATA } from '../data/intlPlayers';
import { OFFICIAL_2026_SQUADS } from '../data/officialSquads';
import { MatchEngine } from '../lib/matchEngine';
import { generateIPLSchedule, generateDoubleRoundRobinSchedule } from '../lib/scheduleGenerator';
import { calculatePostMatchPerformance } from '../lib/performanceEngine';

export enum GameState {
  LANDING = 'landing',
  FORMAT_SELECTION = 'format_selection',
  TEAM_SELECTION = 'team_selection',
  ARENA_DASHBOARD = 'arena_dashboard',
  AUCTION = 'auction',
  LEAGUE = 'league',
  BOARD_SELECTION = 'board_selection',
  PLAYING_XI_BUILDER = 'playing_xi_builder',
  MATCH_SIMULATION = 'match_simulation',
  PRE_MATCH = 'pre_match',
}

export type ArenaFormat = 'IPL' | 'T20' | 'ODI' | 'TEST';
export type TeamStrategy = 'Aggressive' | 'Balanced' | 'Value';

export interface PlayerSeasonStats {
  playerId: string;
  runs: number;
  wickets: number;
  matches: number;
  strikeRate: number;
  economy: number;
  highScore: number;
  bestBowling: string;
  ballsFaced?: number;
  dotBalls?: number;
  runsConceded?: number;
  ballsBowled?: number;
  fours?: number;
  sixes?: number;
}

export interface Franchise {
  id: string;
  name: string;
  shortName: string;
  color: string;
  logo: string;
  purse: number;
  squad: string[]; // IDs
  shortlist: string[]; // Scouted targets
  captainId?: string; // ID of the team captain
  overseasCount: number;
  strategy: TeamStrategy;
}

const INITIAL_FRANCHISES: Franchise[] = [
  { id: '1', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', logo: 'https://cricketvectors.akamaized.net/Teams/F.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Aggressive' },
  { id: '2', name: 'Chennai Super Kings', shortName: 'CSK', color: '#FFFF00', logo: 'https://cricketvectors.akamaized.net/Teams/G.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
  { id: '3', name: 'Royal Challengers Bengaluru', shortName: 'RCB', color: '#CE1126', logo: 'https://cricketvectors.akamaized.net/Teams/K.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Aggressive' },
  { id: '4', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D', logo: 'https://cricketvectors.akamaized.net/Teams/J.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
  { id: '5', name: 'Gujarat Titans', shortName: 'GT', color: '#1B2133', logo: 'https://cricketvectors.akamaized.net/Teams/KB.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
  { id: '6', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85', logo: 'https://cricketvectors.akamaized.net/Teams/M.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Value' },
  { id: '7', name: 'Delhi Capitals', shortName: 'DC', color: '#00008B', logo: 'https://cricketvectors.akamaized.net/Teams/H.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Value' },
  { id: '8', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#00BFFF', logo: 'https://cricketvectors.akamaized.net/Teams/KC.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Balanced' },
  { id: '9', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#F26522', logo: 'https://cricketvectors.akamaized.net/Teams/L.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Aggressive' },
  { id: '10', name: 'Punjab Kings', shortName: 'PBKS', color: '#D71920', logo: 'https://cricketvectors.akamaized.net/Teams/I.png', purse: 1200000000, squad: [], shortlist: [], overseasCount: 0, strategy: 'Value' },
];

const PLAYER_NAME_ALIASES: Record<string, string> = {
  'Ishant Kishan': 'Ishan Kishan',
  'Liam Ferguson': 'Lockie Ferguson',
  'Mukul Choudhary': 'Mukesh Choudhary',
  'Varun Chakaravarthy': 'Varun Chakravarthy',
};

const canonicalPlayerName = (name: string) => PLAYER_NAME_ALIASES[name] || name;

function buildOfficialFranchises(players: Player[], franchises: Franchise[]) {
  const playerByName = new Map(players.map((player) => [canonicalPlayerName(player.name).toLowerCase(), player]));

  return franchises.map((franchise) => {
    const squadNames = OFFICIAL_2026_SQUADS[franchise.shortName] || [];
    const squad = squadNames
      .map((name) => playerByName.get(canonicalPlayerName(name).toLowerCase())?.id)
      .filter((id): id is string => Boolean(id));
    const overseasCount = squad.filter((id) => players.find((player) => player.id === id)?.nationality === 'Overseas').length;
    const spend = squad.reduce((total, id) => total + (players.find((player) => player.id === id)?.basePrice || 0), 0);

    return {
      ...franchise,
      squad: Array.from(new Set(squad)),
      shortlist: franchise.shortlist || [],
      overseasCount,
      purse: Math.max(0, 1200000000 - spend),
    };
  });
}

interface BidEntry {
  teamId: string;
  amount: number;
  timestamp: number;
}

interface GameStore {
  gameState: GameState;
  selectedFranchiseId: string | null;
  players: Player[];
  franchises: Franchise[];
  currentAuctionPlayerId: string | null;
  auctionHistory: { playerId: string; soldTo: string; price: number }[];
  bidLog: BidEntry[];
  unsoldPlayerIds: string[];
  previousGameState: GameState | null;
  
  // Match Engine State
  fixtures: Fixture[];
  standings: Standing[];
  currentMatchId: string | null;
  currentMatchToss: { winnerId: string; decision: TossDecision } | null;
  playerSeasonStats: Record<string, PlayerSeasonStats>;
  selectedSquadIds: string[];   // 15-man squad
  playingXIIds: string[];       // locked 11-man playing XI
  liveMatchState: Record<string, any> | null;
  selectedFormat: ArenaFormat | null;

  setGameState: (state: GameState) => void;
  setFormat: (format: ArenaFormat) => void;
  goBack: () => void;
  setSelectedSquadIds: (ids: string[]) => void;
  setPlayingXIIds: (ids: string[]) => void;
  selectFranchise: (id: string) => void;
  updatePurse: (franchiseId: string, amount: number) => void;
  addToSquad: (franchiseId: string, playerId: string) => void;
  removeFromSquad: (franchiseId: string, playerId: string) => void;
  addToShortlist: (franchiseId: string, playerId: string) => void;
  removeFromShortlist: (franchiseId: string, playerId: string) => void;
  startAuction: (playerId: string) => void;
  addBid: (bid: BidEntry) => void;
  clearBids: () => void;
  soldPlayer: (playerId: string, franchiseId: string, price: number) => void;
  moveToUnsold: (playerId: string) => void;
  resetGame: () => void;
  simulateFullAuction: (playerPool: Player[]) => void;
  saveLiveMatchState: (state: Record<string, any> | null) => void;

  // Match Actions
  initializeIntlFranchises: () => void;
  generateSeasonFixtures: () => void;
  updateMatchResult: (matchId: string, scorecard: MatchScorecard) => void;
  setCurrentMatch: (matchId: string | null) => void;
  setCurrentMatchToss: (toss: { winnerId: string; decision: TossDecision } | null) => void;
  autoSimulateMatch: (matchId: string) => void;
  generatePlayoffFixtures: () => void;
  setCaptain: (franchiseId: string, captainId: string) => void;
  setupQuickMatch: (team1Id: string, team2Id: string, format: MatchFormat) => void;
  applyPostMatchPlayerUpdates: (playerId: string, updates: Partial<Player>) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
  gameState: GameState.LANDING,
  selectedFormat: null,
  selectedFranchiseId: null,
  players: [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL],
  franchises: INITIAL_FRANCHISES,
  currentAuctionPlayerId: null,
  auctionHistory: [],
  bidLog: [],
  unsoldPlayerIds: [],
  previousGameState: null,
  fixtures: [],
  standings: [],
  currentMatchId: null,
  currentMatchToss: null,
  playerSeasonStats: {},
  selectedSquadIds: [],
  playingXIIds: [],
  liveMatchState: null,
  
  // Actions
  setFormat: (format) => set({ selectedFormat: format }),
  setGameState: (state) => set((prev) => ({ 
    previousGameState: prev.gameState,
    gameState: state 
  })),
  goBack: () => set((s) => ({ gameState: s.previousGameState || GameState.LANDING })),
  setCurrentMatch: (matchId) => set({ currentMatchId: matchId }),
  setCurrentMatchToss: (toss) => set({ currentMatchToss: toss }),
  saveLiveMatchState: (matchState) => set({ liveMatchState: matchState }),
  setSelectedSquadIds: (ids) => set({ selectedSquadIds: ids }),
  setPlayingXIIds: (ids) => set({ playingXIIds: ids }),
  selectFranchise: (id) => set({ selectedFranchiseId: id }),
  updatePurse: (franchiseId, amount) => set((state) => ({
    franchises: state.franchises.map(f => f.id === franchiseId ? { ...f, purse: f.purse - amount } : f)
  })),
  addToSquad: (franchiseId, playerId) => set((state) => ({
    franchises: state.franchises.map(f => {
      if (f.id !== franchiseId) return f;
      if (f.squad.includes(playerId)) return f; // Prevent duplicates!
      
      const player = state.players.length > 0 ? state.players.find(p => p.id === playerId) : null;
      const isOverseas = player?.nationality === 'Overseas';
      return { 
        ...f, 
        squad: [...f.squad, playerId],
        overseasCount: isOverseas ? f.overseasCount + 1 : f.overseasCount
      };
    })
  })),
  removeFromSquad: (franchiseId, playerId) => set((state) => ({
    franchises: state.franchises.map(f => {
      if (f.id !== franchiseId) return f;
      return { ...f, squad: f.squad.filter(id => id !== playerId) };
    })
  })),
  applyPostMatchPlayerUpdates: (playerId, updates) => set((state) => ({
    players: state.players.map(p => p.id === playerId ? { ...p, ...updates } : p)
  })),
  addToShortlist: (franchiseId, playerId) => set((state) => ({
    franchises: state.franchises.map(f => {
      if (f.id !== franchiseId) return f;
      if (f.shortlist?.includes(playerId)) return f; // Prevent duplicates!
      return { ...f, shortlist: [...(f.shortlist || []), playerId] };
    })
  })),
  removeFromShortlist: (franchiseId, playerId) => set((state) => ({
    franchises: state.franchises.map(f => {
      if (f.id !== franchiseId) return f;
      return { ...f, shortlist: (f.shortlist || []).filter(id => id !== playerId) };
    })
  })),
  startAuction: (playerId) => set({ currentAuctionPlayerId: playerId, bidLog: [] }),
  addBid: (bid) => set((state) => ({ bidLog: [bid, ...state.bidLog].slice(0, 50) })),
  clearBids: () => set({ bidLog: [] }),
  soldPlayer: (playerId, franchiseId, price) => set((state) => ({
    auctionHistory: [...state.auctionHistory, { playerId, soldTo: franchiseId, price }],
    currentAuctionPlayerId: null
  })),
  moveToUnsold: (playerId) => set((state) => ({
    auctionHistory: [...state.auctionHistory, { playerId, soldTo: 'UNSOLD', price: 0 }],
    unsoldPlayerIds: [...state.unsoldPlayerIds, playerId],
    currentAuctionPlayerId: null
  })),

  resetGame: () => set({
    gameState: GameState.LANDING,
    previousGameState: null,
    selectedFranchiseId: null,
    franchises: INITIAL_FRANCHISES,
    players: INITIAL_PLAYER_POOL,
    auctionHistory: [],
    bidLog: [],
    unsoldPlayerIds: [],
    currentAuctionPlayerId: null,
    fixtures: [],
    standings: [],
    currentMatchId: null,
    currentMatchToss: null,
    playerSeasonStats: {},
    selectedSquadIds: [],
    playingXIIds: [],
    liveMatchState: null,
  }),

  generatePlayoffFixtures: () => set((state) => {
    const { fixtures } = state;
    const totalLeague = fixtures.filter(f => !f.isPlayoff).length;
    const isLeagueComplete = totalLeague > 0 && fixtures.filter(f => !f.isPlayoff && f.status === MatchStatus.COMPLETED).length === totalLeague;

    if (!isLeagueComplete) return state;

    // Check if already generated
    if (state.fixtures.some(f => f.isPlayoff)) return state;

    const rankedStandings = [...state.standings].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.nrr - a.nrr;
    });

    const top4 = rankedStandings.slice(0, 4).map(s => s.teamId);

    const playoffFixtures: Fixture[] = [
        { id: 'q1', matchNumber: 71, day: 999, team1Id: top4[0], team2Id: top4[1], status: MatchStatus.UPCOMING, isPlayoff: true, playoffType: 'Qualifier 1' },
        { id: 'e1', matchNumber: 72, day: 999, team1Id: top4[2], team2Id: top4[3], status: MatchStatus.UPCOMING, isPlayoff: true, playoffType: 'Eliminator' },
    ];

    return { fixtures: [...state.fixtures, ...playoffFixtures] };
  }),
  initializeIntlFranchises: () => set((state) => {
    if (state.selectedFormat === 'IPL') return state;
    const newFranchises = INTL_TEAMS_DATA.map(teamData => {
      const isUserTeam = teamData.id === state.selectedFranchiseId;
      let squadIds = isUserTeam 
        ? state.selectedSquadIds 
        : state.players.filter(p => p.intendedTeamId === teamData.id).sort((a, b) => b.rating - a.rating).slice(0, 15).map(p => p.id);
        
      return {
        id: teamData.id,
        name: teamData.name,
        shortName: teamData.shortName,
        color: teamData.color,
        logo: '',
        purse: 0,
        squad: squadIds,
        shortlist: [],
        overseasCount: 0,
        strategy: 'Aggressive' as const
      };
    });
    return { franchises: newFranchises };
  }),
  generateSeasonFixtures: () => set((state) => {
    // Generate full double round-robin
    const fixtureList = generateDoubleRoundRobinSchedule(state.franchises, state.selectedFormat || 'T20');

    const initialStandings: Standing[] = state.franchises.map(t => ({
      teamId: t.id,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      nrr: 0,
      runsScored: 0,
      oversFaced: 0,
      runsConceded: 0,
      oversBowled: 0,
      form: []
    }));

    return { fixtures: fixtureList, standings: initialStandings };
  }),

  updateMatchResult: (matchId, scorecard) => set((state) => {
    const updatedFixtures = state.fixtures.map(f => 
      f.id === matchId ? { ...f, status: MatchStatus.COMPLETED, scorecard } : f
    );

    // Update Standings
    const { team1Id, team2Id, winnerId } = scorecard;
    const team1Innings = scorecard.innings[0];
    const team2Innings = scorecard.innings[1];

    const updatedStandings = state.standings.map(s => {
      if (s.teamId === team1Id) {
          const isWinner = winnerId === team1Id;
          const overs = team1Innings.overs + (team1Innings.balls / 6);
          const oppOvers = team2Innings.overs + (team2Innings.balls / 6);
          
          return {
              ...s,
              played: s.played + 1,
              won: isWinner ? s.won + 1 : s.won,
              lost: isWinner ? s.lost : s.lost + 1,
              points: isWinner ? s.points + 2 : s.points,
              runsScored: s.runsScored + team1Innings.runs,
              oversFaced: s.oversFaced + overs,
              runsConceded: s.runsConceded + team2Innings.runs,
              oversBowled: s.oversBowled + oppOvers,
              form: [...s.form, isWinner ? 'W' : 'L' as 'W' | 'L'].slice(-5)
          };
      }
      if (s.teamId === team2Id) {
          const isWinner = winnerId === team2Id;
          const overs = team2Innings.overs + (team2Innings.balls / 6);
          const oppOvers = team1Innings.overs + (team1Innings.balls / 6);
          
          return {
              ...s,
              played: s.played + 1,
              won: isWinner ? s.won + 1 : s.won,
              lost: isWinner ? s.lost : s.lost + 1,
              points: isWinner ? s.points + 2 : s.points,
              runsScored: s.runsScored + team2Innings.runs,
              oversFaced: s.oversFaced + overs,
              runsConceded: s.runsConceded + team1Innings.runs,
              oversBowled: s.oversBowled + oppOvers,
              form: [...s.form, isWinner ? 'W' : 'L' as 'W' | 'L'].slice(-5)
          };
      }
      return s;
    });

    // Recalculate NRR for all
    updatedStandings.forEach(s => {
        if (s.oversFaced > 0 && s.oversBowled > 0) {
            s.nrr = (s.runsScored / s.oversFaced) - (s.runsConceded / s.oversBowled);
        }
    });

    // Update Player Stats
    const newPlayerStats = { ...state.playerSeasonStats };
    const processInningsStats = (innings: InningsData) => {
        // Update batting stats
        Object.entries(innings.batsmen).forEach(([playerId, stats]) => {
            if (!newPlayerStats[playerId]) {
                newPlayerStats[playerId] = { playerId, runs: 0, wickets: 0, matches: 0, strikeRate: 0, economy: 0, highScore: 0, bestBowling: '0/0', ballsFaced: 0, dotBalls: 0, runsConceded: 0, ballsBowled: 0 };
            }
            const pStats = newPlayerStats[playerId] as any;
            pStats.matches += 1;
            pStats.runs += stats.runs;
            pStats.ballsFaced = (pStats.ballsFaced || 0) + stats.balls;
            if (stats.runs > pStats.highScore) pStats.highScore = stats.runs;
            if (pStats.ballsFaced > 0) pStats.strikeRate = (pStats.runs / pStats.ballsFaced) * 100;
        });
        
        // Update bowling stats
        Object.entries(innings.bowlers).forEach(([playerId, stats]) => {
            if (!newPlayerStats[playerId]) {
                newPlayerStats[playerId] = { playerId, runs: 0, wickets: 0, matches: 0, strikeRate: 0, economy: 0, highScore: 0, bestBowling: '0/0', ballsFaced: 0, dotBalls: 0, runsConceded: 0, ballsBowled: 0 };
            } else if (!Object.keys(innings.batsmen).includes(playerId)) {
                // Only increment match if they didn't bat
                newPlayerStats[playerId].matches += 1;
            }
            const pStats = newPlayerStats[playerId] as any;
            pStats.wickets += stats.wickets;
            pStats.runsConceded = (pStats.runsConceded || 0) + stats.runsConceded;
            pStats.ballsBowled = (pStats.ballsBowled || 0) + (stats.overs * 6 + stats.balls);
            
            if (pStats.ballsBowled > 0) pStats.economy = pStats.runsConceded / (pStats.ballsBowled / 6);
            
            // Best bowling logic: more wickets, or if equal, fewer runs
            const currentBestWickets = parseInt(pStats.bestBowling.split('/')[0]) || 0;
            const currentBestRuns = parseInt(pStats.bestBowling.split('/')[1]) || 0;
            
            if (stats.wickets > currentBestWickets || (stats.wickets === currentBestWickets && stats.runsConceded < currentBestRuns)) {
                pStats.bestBowling = `${stats.wickets}/${stats.runsConceded}`;
            }
        });
    };
    processInningsStats(team1Innings);
    processInningsStats(team2Innings);

    // Playoff progression
    const currentFixture = updatedFixtures.find(f => f.id === matchId);
    let extraFixtures: Fixture[] = [];
    
    // Check if Q1 and Eliminator are both complete
    const q1Fixture = updatedFixtures.find(f => f.id === 'q1');
    const e1Fixture = updatedFixtures.find(f => f.id === 'e1');
    const q2Fixture = updatedFixtures.find(f => f.id === 'q2');
    const finalFixture = updatedFixtures.find(f => f.id === 'final');

    if (q1Fixture?.status === MatchStatus.COMPLETED && e1Fixture?.status === MatchStatus.COMPLETED && !q2Fixture) {
        const q1Loser = q1Fixture.scorecard?.winnerId === q1Fixture.team1Id ? q1Fixture.team2Id : q1Fixture.team1Id;
        const e1Winner = e1Fixture.scorecard?.winnerId;
        if (q1Loser && e1Winner) {
            extraFixtures.push({ id: 'q2', matchNumber: 73, day: 1000, team1Id: q1Loser, team2Id: e1Winner, status: MatchStatus.UPCOMING, isPlayoff: true, playoffType: 'Qualifier 2' });
        }
    }

    if (q1Fixture?.status === MatchStatus.COMPLETED && q2Fixture?.status === MatchStatus.COMPLETED && !finalFixture) {
        const q1Winner = q1Fixture.scorecard?.winnerId;
        const q2Winner = q2Fixture.scorecard?.winnerId;
        if (q1Winner && q2Winner) {
            extraFixtures.push({ id: 'final', matchNumber: 74, day: 1001, team1Id: q1Winner, team2Id: q2Winner, status: MatchStatus.UPCOMING, isPlayoff: true, playoffType: 'Final' });
        }
    }

    // NEW: Update Base Ability, Form, and Career Stats for Arena matches
    const newPlayers = [...state.players];
    const format = state.selectedFormat || 'T20'; // Fallback
    
    const applyArenaStats = (innings: InningsData) => {
      // Create unified scorecard objects for players
      const playerScores: Record<string, any> = {};
      
      Object.entries(innings.batsmen).forEach(([id, b]) => {
        if (!playerScores[id]) playerScores[id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, overs: 0, wickets: 0, runsConceded: 0 };
        playerScores[id].runs = b.runs;
        playerScores[id].balls = b.balls;
        playerScores[id].fours = b.fours;
        playerScores[id].sixes = b.sixes;
        playerScores[id].isOut = b.isOut;
      });

      Object.entries(innings.bowlers).forEach(([id, b]) => {
        if (!playerScores[id]) playerScores[id] = { runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, overs: 0, wickets: 0, runsConceded: 0 };
        playerScores[id].overs = b.overs + (b.balls / 6);
        playerScores[id].wickets = b.wickets;
        playerScores[id].runsConceded = b.runsConceded;
      });

      Object.entries(playerScores).forEach(([id, score]) => {
        const pIndex = newPlayers.findIndex(p => p.id === id);
        if (pIndex !== -1) {
          const delta = calculatePostMatchPerformance(newPlayers[pIndex], score, format);
          newPlayers[pIndex] = {
            ...newPlayers[pIndex],
            baseAbility: delta.newBaseAbility,
            form: delta.newForm,
            careerStats: delta.updatedCareerStats,
          };
        }
      });
    };
    
    applyArenaStats(team1Innings);
    applyArenaStats(team2Innings);

    return { 
      fixtures: [...updatedFixtures, ...extraFixtures], 
      standings: updatedStandings, 
      playerSeasonStats: newPlayerStats,
      players: newPlayers 
    };
  }),

  autoSimulateMatch: (matchId) => set((state) => {
      const fixture = state.fixtures.find(f => f.id === matchId);
      if (!fixture) return state;

      const team1Id = fixture.team1Id;
      const team2Id = fixture.team2Id;

      // quick toss
      const toss = MatchEngine.simulateToss(team1Id, team2Id);
      const batFirstId = toss.decision === TossDecision.BAT ? toss.winnerId : (toss.winnerId === team1Id ? team2Id : team1Id);
      const bowlFirstId = batFirstId === team1Id ? team2Id : team1Id;

      // Helper to order players optimally
      const orderSquad = (squadIds: string[]) => {
          const players = squadIds.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
          // Batting order: top pure batsmen + all rounders + WKs -> then bowlers by batting
          players.sort((a, b) => {
             const getBatScore = (p: Player) => {
                 let s = (p.stats?.batting || 0);
                 if (p.role === 'Batsman' || p.role === 'Wicketkeeper') s += 50;
                 if (p.role === 'All-rounder') s += 25;
                 return s;
             };
             return getBatScore(b) - getBatScore(a);
          });
          return players.map(p => p.id);
      };

      const getBowlerOrder = (squadIds: string[]) => {
          const players = squadIds.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
          // Bowling order: Top bowlers first
          players.sort((a, b) => {
             const getBowlScore = (p: Player) => {
                 let s = (p.stats?.bowling || 0);
                 if (p.role === 'Bowler') s += 50;
                 if (p.role === 'All-rounder') s += 25;
                 return s;
             };
             return getBowlScore(b) - getBowlScore(a);
          });
          return players.map(p => p.id);
      }

      const t1Squad = orderSquad(state.franchises.find(f => f.id === batFirstId)?.squad || []);
      const t1Bowlers = getBowlerOrder(state.franchises.find(f => f.id === batFirstId)?.squad || []);
      const t2Squad = orderSquad(state.franchises.find(f => f.id === bowlFirstId)?.squad || []);
      const t2Bowlers = getBowlerOrder(state.franchises.find(f => f.id === bowlFirstId)?.squad || []);
      
      const pitch = MatchEngine.generatePitch();
      const weather = MatchEngine.generateWeather();

      const maxOvers = MatchEngine.getOversPerMatch(fixture.format);

      // Simple loop to generate an innings score
      const simInnings = (batSquad: string[], bowlSquad: string[], target: number) => {
        const inn = MatchEngine.createEmptyInnings(batFirstId, bowlFirstId); // Just a tracker
        inn.battingTeamId = batSquad === t1Squad ? batFirstId : bowlFirstId;
        inn.bowlingTeamId = batSquad === t1Squad ? bowlFirstId : batFirstId;
        
        // Take top 6 bowlers
        const activeBowlerIds = bowlSquad.slice(0, 6);
        let bowlerIndex = 0;
        
        let strikerIdx = 0;
        let nonStrikerIdx = 1;
        
        let ballCount = 0;
        while(inn.overs < maxOvers && inn.wickets < 10) {
           const p1 = state.players.find(p => p.id === batSquad[strikerIdx]) || state.players[0];
           
           // rotate bowlers every over among the 6 selected
           const currentOverPhase = inn.overs;
           // 0, 2, 4, 15, 17, 19 usually fast bowlers (e.g. index 0, 1)
           // simplify: we just cycle around 5 bowlers
           const p2Id = activeBowlerIds[((inn.overs % 5)) % Math.max(1, activeBowlerIds.length)];
           const p2 = state.players.find(p => p.id === p2Id) || state.players[0];
           
           // Get stats first to pass into simulateBall
           const strikerStats = MatchEngine.getPlayerStats(p1.id, inn.batsmen);
           const bowlerStats = MatchEngine.getPlayerStats(p2.id, inn.bowlers);

           const currentOverProgress = inn.overs + inn.balls / 6;
           const ball = MatchEngine.simulateBall(p1, p2, currentOverProgress, inn.wickets, target ? ((target - inn.runs) / (Math.max(1, (maxOvers * 6) - ballCount) / 6)) : 8, pitch, weather, strikerStats, bowlerStats, [], false, 0, fixture.format);
           const isLegalDelivery = ball.extraType !== 'Wide' && ball.extraType !== 'No Ball';
           const batterRuns = ball.isExtra ? 0 : ball.runs;
           
           // Update Batsman Stats
           if (isLegalDelivery) strikerStats.balls += 1;
           strikerStats.runs += batterRuns;
           
           if (!strikerStats.momentum) strikerStats.momentum = 0;
           if (!bowlerStats.momentum) bowlerStats.momentum = 0;
           strikerStats.wicketBurst = Math.max(0, (strikerStats.wicketBurst || 0) - 0.2);
           
           if (ball.runs === 4 && !ball.isExtra) {
               strikerStats.fours += 1;
               strikerStats.momentum += 5;
               bowlerStats.momentum -= 2;
               strikerStats.ballsSinceBoundary = 0;
           }
           if (ball.runs === 6 && !ball.isExtra) {
               strikerStats.sixes += 1;
               strikerStats.momentum += 8;
               bowlerStats.momentum -= 3;
               strikerStats.ballsSinceBoundary = 0;
           }
           if (ball.runs === 0 && !ball.isExtra) {
               strikerStats.momentum -= 2;
               bowlerStats.momentum += 2;
               strikerStats.dots += 1;
               strikerStats.consecutiveDots = (strikerStats.consecutiveDots || 0) + 1;
           } else if (!ball.isExtra) {
               strikerStats.consecutiveDots = 0;
               strikerStats.ballsSinceBoundary = (strikerStats.ballsSinceBoundary || 0) + 1;
           }
           if (ball.isWicket) {
               bowlerStats.momentum += 10;
               strikerStats.momentum = 0;
               strikerStats.wicketBurst = (strikerStats.wicketBurst || 0) + 1;
           }
           
           // Update Bowler Stats
           if (isLegalDelivery) {
               bowlerStats.balls += 1;
               if (bowlerStats.balls === 6) {
                   bowlerStats.overs += 1;
                   bowlerStats.balls = 0;
                   bowlerStats.lastOverRuns = 0;
               }
           }
           bowlerStats.runsConceded += ball.runs;
           bowlerStats.lastOverRuns = (bowlerStats.lastOverRuns || 0) + ball.runs;
           if (ball.runs === 0 && !ball.isExtra) bowlerStats.dots += 1;
           if (ball.isWicket && !ball.isExtra) bowlerStats.wickets += 1;

           if (isLegalDelivery) {
               ballCount++;
               inn.balls++;
               if (inn.balls === 6) {
                   inn.overs++;
                   inn.balls = 0;
               }
           }
           
           inn.runs += ball.runs;
           if (ball.isExtra) {
               if (ball.extraType === 'Wide') inn.extras.wides += 1;
               if (ball.extraType === 'No Ball') inn.extras.noBalls += 1;
           } else if (ball.runs % 2 !== 0) {
               const temp = strikerIdx;
               strikerIdx = nonStrikerIdx;
               nonStrikerIdx = temp;
           }

           if (ball.isWicket) {
               inn.wickets++;
               strikerIdx = Math.max(strikerIdx, nonStrikerIdx) + 1;
               if (strikerIdx >= batSquad.length) strikerIdx = 0; // fallback
           }
           
           if (isLegalDelivery && ballCount > 0 && ballCount % 6 === 0) {
              // Rotate strike at end of over
              const temp = strikerIdx;
              strikerIdx = nonStrikerIdx;
              nonStrikerIdx = temp;
           }
           
           if (target && inn.runs >= target) break;
        }
        return inn;
      };

      const inn1 = simInnings(t1Squad, t2Squad, 0);
      const inn2 = simInnings(t2Squad, t1Squad, inn1.runs + 1);

      const winnerId = inn2.runs > inn1.runs ? inn2.battingTeamId : inn1.battingTeamId;

      const scorecard: MatchScorecard = {
        team1Id: batFirstId,
        team2Id: bowlFirstId,
        winnerId,
        innings: [inn1, inn2],
        margin: winnerId === inn2.battingTeamId ? `${10 - inn2.wickets} wickets` : `${inn1.runs - inn2.runs} runs`
      };

      // Update state without returning it all at once via helper, instead just trigger the update action
      setTimeout(() => get().updateMatchResult(matchId, scorecard), 0);

      return state;
  }),
  simulateFullAuction: () => set((state) => {
      const currentFranchises = buildOfficialFranchises(state.players, INITIAL_FRANCHISES);
      const assignedIds = new Set(currentFranchises.flatMap((franchise) => franchise.squad));
      const history = currentFranchises.flatMap((franchise) =>
        franchise.squad.map((playerId) => ({
          playerId,
          soldTo: franchise.id,
          price: state.players.find((player) => player.id === playerId)?.basePrice || 0,
        })),
      );

      return {
          franchises: currentFranchises,
          auctionHistory: history,
          unsoldPlayerIds: state.players.filter((player) => !assignedIds.has(player.id)).map((player) => player.id),
          gameState: GameState.LEAGUE
      };
  }),
  setCaptain: (franchiseId, captainId) => set((state) => ({
    franchises: state.franchises.map((f) => f.id === franchiseId ? { ...f, captainId } : f),
  })),
  setupQuickMatch: (team1Id: string, team2Id: string, format: MatchFormat) => {
    const fixture: Fixture = {
      id: `qm-${Date.now()}`,
      matchNumber: 1,
      day: 1,
      team1Id,
      team2Id,
      status: MatchStatus.UPCOMING,
      format
    };
    set({
      fixtures: [fixture],
      currentMatchId: fixture.id,
      gameState: GameState.PRE_MATCH
    });
  },
    }),
    {
      name: 'cricket-arena-v3',
    }
  )
);
