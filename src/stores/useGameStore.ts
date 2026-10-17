import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Fixture, Standing, MatchStatus, MatchScorecard, InningsData, TossDecision, MatchFormat, SeriesConfig } from '../types/match';
import { Player } from '../types/common';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { INTL_PLAYER_POOL, INTL_TEAMS_DATA } from '../data/intlPlayers';
import { OFFICIAL_2026_SQUADS } from '../data/officialSquads';
import { MatchEngine } from '../lib/matchEngine';
import { generateIPLSchedule, generateDoubleRoundRobinSchedule } from '../lib/scheduleGenerator';
import { ProgressionEngine, PerformanceInput } from '../engine/players/progressionEngine';
import { ArenaPlayerState, ArenaFormat } from '../engine/models/ArenaState';
import { db } from '../engine/storage/Database';
import { FixtureScheduler } from '../engine/scheduling/FixtureScheduler';
import { WorkloadRotationEngine } from '../engine/ai/WorkloadRotationEngine';
import { BowlerFieldStrategyEngine } from '../engine/strategy/BowlerFieldStrategyEngine';
import { buildDeliveryModel } from '../engine/ai/AdaptiveCaptainEngine';
import {
  SeriesConfigInput,
  computeSeriesStandings,
  createSeriesConfig,
  generateSeriesFixtures,
} from '../engine/competition/seriesEngine';

// Pre-flight cleanup: if localStorage contains bloated old store payload, strip heavy keys immediately
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const existing = window.localStorage.getItem('cricket-arena-v3');
    if (existing && existing.length > 300000) {
      try {
        const parsed = JSON.parse(existing);
        if (parsed?.state) {
          delete parsed.state.players;
          delete parsed.state.arenaPlayerStates;
          delete parsed.state.liveMatchState;
          delete parsed.state.stateHistory;
          delete parsed.state.auctionHistory;
          delete parsed.state.bidLog;
          window.localStorage.setItem('cricket-arena-v3', JSON.stringify(parsed));
        }
      } catch {
        window.localStorage.removeItem('cricket-arena-v3');
      }
    }
  }
} catch (e) {
  console.warn('[useGameStore] Storage pre-flight check error:', e);
}

export enum GameState {
  LANDING = 'landing',
  FORMAT_SELECTION = 'format_selection',
  TEAM_SELECTION = 'team_selection',
  ARENA_DASHBOARD = 'arena_dashboard',
  ARENA_HUB = 'arena_hub',
  AUCTION = 'auction',
  LEAGUE = 'league',
  BOARD_SELECTION = 'board_selection',
  PLAYING_XI_BUILDER = 'playing_xi_builder',
  MATCH_SIMULATION = 'match_simulation',
  PRE_MATCH = 'pre_match',
}

export type ArenaTab = 'OVERVIEW' | 'MATCHES' | 'TEAMS' | 'TABLE' | 'PLAYERS' | 'PLAYER_STATS' | 'TEAM_STATS' | 'AUCTION' | 'SQUAD' | 'PLAYOFFS' | 'SERIES';
export type { ArenaFormat };
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
  squad: string[];
  shortlist: string[];
  captainId?: string;
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
  activeArenaId: string;
  gameState: GameState;
  selectedFranchiseId: string | null;
  players: Player[];
  franchises: Franchise[];
  currentAuctionPlayerId: string | null;
  auctionHistory: { playerId: string; soldTo: string; price: number }[];
  bidLog: BidEntry[];
  unsoldPlayerIds: string[];
  stateHistory: GameState[];
  
  // Arena-specific format-isolated Player State Map: Key is `${arenaId}_${playerId}_${format}`
  arenaPlayerStates: Record<string, ArenaPlayerState>;

  // Match Engine State
  fixtures: Fixture[];
  standings: Standing[];
  currentMatchId: string | null;
  currentMatchToss: { winnerId: string; decision: TossDecision } | null;
  playerSeasonStats: Record<string, PlayerSeasonStats>;
  selectedSquadIds: string[];
  playingXIIds: string[];
  playerFatigue: Record<string, number>;
  fixturePlayingXIs: Record<string, { team1XI: string[]; team2XI: string[] }>;
  liveMatchState: Record<string, any> | null;
  selectedFormat: ArenaFormat | null;
  activeTab: ArenaTab;
  viewedPlayerId: string | null;
  /** Active bilateral series, if the player configured one. */
  seriesConfig: SeriesConfig | null;

  setArenaId: (arenaId: string) => void;
  setFixturePlayingXI: (fixtureId: string, team1XI: string[], team2XI: string[]) => void;
  getFixturePlayingXI: (fixtureId: string, teamId: string) => string[];
  updatePlayerFatigue: (fatigueMap: Record<string, number>) => void;
  setGameState: (state: GameState) => void;
  setActiveTab: (tab: ArenaTab) => void;
  setFormat: (format: ArenaFormat) => void;
  goBack: () => void;
  setSelectedSquadIds: (ids: string[]) => void;
  setPlayingXIIds: (ids: string[]) => void;
  selectFranchise: (id: string) => void;
  setViewedPlayer: (id: string | null) => void;
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

  // Arena & Player State helpers
  getArenaPlayerState: (playerId: string, format?: ArenaFormat) => ArenaPlayerState;
  initializeArenaPlayerStates: (arenaId: string, format: ArenaFormat) => void;

  // Match Actions
  initializeIntlFranchises: () => void;
  initializeIPLFranchises: () => void;
  generateSeasonFixtures: () => void;
  createSeries: (input: SeriesConfigInput) => void;
  clearSeries: () => void;
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
      activeArenaId: 'default_arena',
      gameState: GameState.LANDING,
      selectedFormat: null,
      selectedFranchiseId: null,
      players: [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL],
      franchises: INITIAL_FRANCHISES,
      currentAuctionPlayerId: null,
      auctionHistory: [],
      bidLog: [],
      unsoldPlayerIds: [],
      stateHistory: [],
      arenaPlayerStates: {},
      fixtures: [],
      standings: [],
      currentMatchId: null,
      currentMatchToss: null,
      playerSeasonStats: {},
      selectedSquadIds: [],
      playingXIIds: [],
      playerFatigue: {},
      fixturePlayingXIs: {},
      liveMatchState: null,
      activeTab: 'OVERVIEW',
      viewedPlayerId: null,
      seriesConfig: null,

      setArenaId: (arenaId) => set({ activeArenaId: arenaId }),
      setFormat: (format) => set({ selectedFormat: format }),
      setActiveTab: (tab) => set({ activeTab: tab }),
      setFixturePlayingXI: (fixtureId, team1XI, team2XI) => set((state) => ({
        fixturePlayingXIs: {
          ...state.fixturePlayingXIs,
          [fixtureId]: { team1XI, team2XI }
        },
        fixtures: state.fixtures.map(f => f.id === fixtureId ? { ...f, team1PlayingXI: team1XI, team2PlayingXI: team2XI } : f)
      })),
      getFixturePlayingXI: (fixtureId, teamId) => {
        const state = get();
        const fixture = state.fixtures.find(f => f.id === fixtureId);
        if (fixture) {
          if (fixture.team1Id === teamId && fixture.team1PlayingXI && fixture.team1PlayingXI.length === 11) {
            return fixture.team1PlayingXI;
          }
          if (fixture.team2Id === teamId && fixture.team2PlayingXI && fixture.team2PlayingXI.length === 11) {
            return fixture.team2PlayingXI;
          }
        }
        const entry = state.fixturePlayingXIs[fixtureId];
        if (entry) {
          if (fixture?.team1Id === teamId) return entry.team1XI;
          if (fixture?.team2Id === teamId) return entry.team2XI;
        }
        return [];
      },
      updatePlayerFatigue: (fatigueMap) => set((state) => ({
        playerFatigue: { ...state.playerFatigue, ...fatigueMap }
      })),
      setGameState: (state) => set((prev) => {
        if (prev.gameState === state) return {};
        return { 
          stateHistory: [...prev.stateHistory, prev.gameState].slice(-10),
          gameState: state 
        };
      }),
      goBack: () => set((prev) => {
        if (prev.stateHistory.length === 0) return { gameState: GameState.LANDING };
        const newHistory = [...prev.stateHistory];
        const prevState = newHistory.pop()!;
        return { gameState: prevState, stateHistory: newHistory };
      }),
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
          if (f.squad.includes(playerId)) return f;
          
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
          if (f.shortlist?.includes(playerId)) return f;
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
      setViewedPlayer: (id) => set({ viewedPlayerId: id }),

      getArenaPlayerState: (playerId: string, format?: ArenaFormat): ArenaPlayerState => {
        const state = get();
        const activeFormat = format || state.selectedFormat || 'T20';
        const key = `${state.activeArenaId}_${playerId}_${activeFormat}`;
        
        if (state.arenaPlayerStates[key]) {
          return state.arenaPlayerStates[key];
        }

        // Initialize on-demand if missing
        const masterPlayer = state.players.find(p => p.id === playerId) || {
          id: playerId,
          name: playerId,
          role: 'All-rounder',
          nationality: 'Indian',
          rating: 75,
          baseAbility: 75,
          basePrice: 0,
          stats: { batting: 75, bowling: 75, fielding: 75 },
          careerStats: { matches: 0, runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, runsConceded: 0, dismissals: 0, catches: 0 }
        } as Player;

        const newState = ProgressionEngine.createInitialState(state.activeArenaId, masterPlayer, activeFormat);
        
        // Asynchronously save to DB
        db.savePlayerState(newState).catch(console.error);

        return newState;
      },

      initializeArenaPlayerStates: (arenaId: string, format: ArenaFormat) => {
        const { players } = get();
        const initialMap: Record<string, ArenaPlayerState> = {};

        players.forEach(p => {
          const state = ProgressionEngine.createInitialState(arenaId, p, format);
          initialMap[`${arenaId}_${p.id}_${format}`] = state;
          db.savePlayerState(state).catch(console.error);
        });

        set({
          activeArenaId: arenaId,
          arenaPlayerStates: initialMap
        });
      },

      resetGame: () => set({
        gameState: GameState.LANDING,
        stateHistory: [],
        selectedFranchiseId: null,
        franchises: INITIAL_FRANCHISES,
        players: [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL],
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
        playerFatigue: {},
        fixturePlayingXIs: {},
        liveMatchState: null,
        seriesConfig: null,
        activeTab: 'OVERVIEW',
        viewedPlayerId: null,
      }),

      generatePlayoffFixtures: () => set((state) => {
        const { fixtures } = state;
        const totalLeague = fixtures.filter(f => !f.isPlayoff).length;
        const isLeagueComplete = totalLeague > 0 && fixtures.filter(f => !f.isPlayoff && f.status === MatchStatus.COMPLETED).length === totalLeague;

        if (!isLeagueComplete) return state;
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

      initializeIPLFranchises: () => set((state) => {
        return { franchises: INITIAL_FRANCHISES };
      }),

      generateSeasonFixtures: () => set((state) => {
        const fixtureList = FixtureScheduler.generateTournamentSchedule(
          state.franchises,
          state.selectedFormat || 'T20',
          { isDoubleRoundRobin: state.selectedFormat === 'IPL' || state.franchises.length <= 6 }
        );

        const initialStandings: Standing[] = state.franchises.map(t => ({
          teamId: t.id,
          played: 0,
          won: 0,
          lost: 0,
          drawn: 0,
          tied: 0,
          points: 0,
          pct: 0,
          nrr: 0,
          runsScored: 0,
          oversFaced: 0,
          runsConceded: 0,
          oversBowled: 0,
          form: []
        }));

        return { fixtures: fixtureList, standings: initialStandings };
      }),

      createSeries: (input) => set((state) => {
        const config = createSeriesConfig(input);
        const fixtureList = generateSeriesFixtures(config);
        const initialStandings: Standing[] = computeSeriesStandings(config, []).map((row) => ({
          teamId: row.teamId,
          played: row.played,
          won: row.won,
          lost: row.lost,
          drawn: row.drawn,
          tied: row.tied,
          points: row.points,
          pct: row.pct,
          nrr: row.nrr,
          runsScored: row.runsScored,
          oversFaced: row.oversFaced,
          runsConceded: row.runsConceded,
          oversBowled: row.oversBowled,
          form: row.form,
        }));
        return {
          seriesConfig: config,
          fixtures: fixtureList,
          standings: initialStandings,
          selectedFormat: config.format as ArenaFormat,
        };
      }),

      clearSeries: () => set({ seriesConfig: null, fixtures: [], standings: [] }),

      updateMatchResult: (matchId, scorecard) => set((state) => {
        const existingFixture = state.fixtures.find(f => f.id === matchId);
        if (existingFixture && existingFixture.status === MatchStatus.COMPLETED && existingFixture.scorecard) {
          return state;
        }

        const updatedFixtures = state.fixtures.map(f => 
          f.id === matchId ? { ...f, status: MatchStatus.COMPLETED, fixtureStatus: 'COMPLETED' as const, scorecard } : f
        );

        const { team1Id, team2Id, winnerId } = scorecard;
        const team1Innings = scorecard.innings[0];
        const team2Innings = scorecard.innings[1];
        const isTest = (state.selectedFormat || '').toUpperCase() === 'TEST';

        // Standings calculation
        const updatedStandings = state.standings.map(s => {
          if (s.teamId === team1Id || s.teamId === team2Id) {
            const isTeam1 = s.teamId === team1Id;
            const myInnings = isTeam1 ? team1Innings : team2Innings;
            const oppInnings = isTeam1 ? team2Innings : team1Innings;
            const isWinner = winnerId === s.teamId;
            const isTie = winnerId === 'TIE';
            const isDraw = !winnerId || winnerId === 'DRAW';

            const myOvers = myInnings.overs + (myInnings.balls / 6);
            const oppOvers = oppInnings.overs + (oppInnings.balls / 6);

            let pointsGained = 0;
            let resultForm: 'W' | 'L' | 'D' | 'T' = 'L';
            let wonAdd = 0;
            let lostAdd = 0;
            let drawnAdd = 0;
            let tiedAdd = 0;

            if (isTest) {
              if (isWinner) {
                pointsGained = 12;
                resultForm = 'W';
                wonAdd = 1;
              } else if (isTie) {
                pointsGained = 6;
                resultForm = 'T';
                tiedAdd = 1;
              } else if (isDraw) {
                pointsGained = 4;
                resultForm = 'D';
                drawnAdd = 1;
              } else {
                pointsGained = 0;
                resultForm = 'L';
                lostAdd = 1;
              }
            } else {
              if (isWinner) {
                pointsGained = 2;
                resultForm = 'W';
                wonAdd = 1;
              } else if (isTie || isDraw) {
                pointsGained = 1;
                resultForm = 'T';
                tiedAdd = 1;
              } else {
                pointsGained = 0;
                resultForm = 'L';
                lostAdd = 1;
              }
            }

            const newPlayed = s.played + 1;
            const newPoints = s.points + pointsGained;
            const newPct = isTest && newPlayed > 0 ? Math.round((newPoints / (newPlayed * 12)) * 1000) / 10 : undefined;

            return {
              ...s,
              played: newPlayed,
              won: s.won + wonAdd,
              lost: s.lost + lostAdd,
              drawn: (s.drawn || 0) + drawnAdd,
              tied: (s.tied || 0) + tiedAdd,
              points: newPoints,
              pct: newPct,
              runsScored: s.runsScored + myInnings.runs,
              oversFaced: s.oversFaced + myOvers,
              runsConceded: s.runsConceded + oppInnings.runs,
              oversBowled: s.oversBowled + oppOvers,
              form: [...s.form, resultForm].slice(-5)
            };
          }
          return s;
        });

        updatedStandings.forEach(s => {
          if (s.oversFaced > 0 && s.oversBowled > 0) {
            s.nrr = Math.round(((s.runsScored / s.oversFaced) - (s.runsConceded / s.oversBowled)) * 1000) / 1000;
          }
        });

        // Player Fatigue Update
        const updatedFatigue = { ...state.playerFatigue };
        const applyFatigue = (innings: InningsData) => {
          Object.entries(innings.batsmen).forEach(([playerId, stats]) => {
            const player = state.players.find(p => p.id === playerId);
            if (player) {
              const inc = WorkloadRotationEngine.calculateMatchFatigue(player, stats.balls, 0, false);
              updatedFatigue[playerId] = Math.min(100, (updatedFatigue[playerId] || 0) + inc);
            }
          });
          Object.entries(innings.bowlers).forEach(([playerId, stats]) => {
            const player = state.players.find(p => p.id === playerId);
            if (player) {
              const overs = stats.overs + (stats.balls / 6);
              const inc = WorkloadRotationEngine.calculateMatchFatigue(player, 0, overs, false);
              updatedFatigue[playerId] = Math.min(100, (updatedFatigue[playerId] || 0) + inc);
            }
          });
        };
        applyFatigue(team1Innings);
        applyFatigue(team2Innings);

        // Season Stats aggregation
        const newPlayerStats = { ...state.playerSeasonStats };
        const processInningsStats = (innings: InningsData) => {
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
          
          Object.entries(innings.bowlers).forEach(([playerId, stats]) => {
            if (!newPlayerStats[playerId]) {
              newPlayerStats[playerId] = { playerId, runs: 0, wickets: 0, matches: 0, strikeRate: 0, economy: 0, highScore: 0, bestBowling: '0/0', ballsFaced: 0, dotBalls: 0, runsConceded: 0, ballsBowled: 0 };
            } else if (!Object.keys(innings.batsmen).includes(playerId)) {
              newPlayerStats[playerId].matches += 1;
            }
            const pStats = newPlayerStats[playerId] as any;
            pStats.wickets += stats.wickets;
            pStats.runsConceded = (pStats.runsConceded || 0) + stats.runsConceded;
            pStats.ballsBowled = (pStats.ballsBowled || 0) + (stats.overs * 6 + stats.balls);
            if (pStats.ballsBowled > 0) pStats.economy = pStats.runsConceded / (pStats.ballsBowled / 6);
            
            const currentBestWickets = parseInt(pStats.bestBowling.split('/')[0]) || 0;
            const currentBestRuns = parseInt(pStats.bestBowling.split('/')[1]) || 0;
            if (stats.wickets > currentBestWickets || (stats.wickets === currentBestWickets && stats.runsConceded < currentBestRuns)) {
              pStats.bestBowling = `${stats.wickets}/${stats.runsConceded}`;
            }
          });
        };
        processInningsStats(team1Innings);
        processInningsStats(team2Innings);

        // Playoff progression fixtures
        const updatedRecentPlayerStates = { ...state.arenaPlayerStates };
        const format = state.selectedFormat || 'T20';
        const arenaId = state.activeArenaId;

        // Perform Arena-specific format-isolated progression for each participating player
        const processPlayerProgression = (innings: InningsData, oppTeamId: string) => {
          const participantIds = Array.from(new Set([
            ...Object.keys(innings.batsmen),
            ...Object.keys(innings.bowlers)
          ]));

          participantIds.forEach(playerId => {
            const masterPlayer = state.players.find(p => p.id === playerId);
            if (!masterPlayer) return;

            const bat = innings.batsmen[playerId];
            const bowl = innings.bowlers[playerId];

            const pKey = `${arenaId}_${playerId}_${format}`;
            const currentState = updatedRecentPlayerStates[pKey] || ProgressionEngine.createInitialState(arenaId, masterPlayer, format);

            const perfInput: PerformanceInput = {
              matchId,
              date: Date.now(),
              format,
              oppositionTeamId: oppTeamId,
              oppositionStrength: 75,
              matchResult: winnerId ? (winnerId === (masterPlayer.intendedTeamId || team1Id) ? 'WIN' : 'LOSS') : 'DRAW',
              runs: bat?.runs || 0,
              balls: bat?.balls || 0,
              fours: bat?.fours || 0,
              sixes: bat?.sixes || 0,
              isOut: Boolean(bat?.isOut),
              overs: bowl ? (bowl.overs + (bowl.balls / 6)) : 0,
              maidens: bowl?.maidens || 0,
              runsConceded: bowl?.runsConceded || 0,
              wickets: bowl?.wickets || 0,
              catches: 0,
              stumpings: 0,
              runOuts: 0,
            };

            const { updatedState } = ProgressionEngine.processMatchPerformance(
              currentState,
              perfInput,
              masterPlayer.role
            );

            updatedRecentPlayerStates[pKey] = updatedState;
            db.savePlayerState(updatedState).catch(console.error);
          });
        };

        processPlayerProgression(team1Innings, team2Id);
        processPlayerProgression(team2Innings, team1Id);

        // Playoff auto fixtures
        let extraFixtures: Fixture[] = [];
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

        // Bilateral series: the points table is derived from the series fixtures
        // (which supports 4-innings Test scorecards that the generic path above
        // does not aggregate).
        let finalStandings = updatedStandings;
        if (state.seriesConfig && existingFixture?.tournamentId === state.seriesConfig.id) {
          finalStandings = computeSeriesStandings(state.seriesConfig, updatedFixtures).map((row) => ({
            teamId: row.teamId,
            played: row.played,
            won: row.won,
            lost: row.lost,
            drawn: row.drawn,
            tied: row.tied,
            points: row.points,
            pct: row.pct,
            nrr: row.nrr,
            runsScored: row.runsScored,
            oversFaced: row.oversFaced,
            runsConceded: row.runsConceded,
            oversBowled: row.oversBowled,
            form: row.form,
          }));
        }

        return { 
          fixtures: [...updatedFixtures, ...extraFixtures], 
          standings: finalStandings, 
          playerSeasonStats: newPlayerStats,
          arenaPlayerStates: updatedRecentPlayerStates,
          playerFatigue: updatedFatigue,
        };
      }),

      autoSimulateMatch: (matchId) => set((state) => {
        const fixture = state.fixtures.find(f => f.id === matchId);
        if (!fixture) return state;

        const team1Id = fixture.team1Id;
        const team2Id = fixture.team2Id;

        const toss = MatchEngine.simulateToss(team1Id, team2Id);
        const batFirstId = toss.decision === TossDecision.BAT ? toss.winnerId : (toss.winnerId === team1Id ? team2Id : team1Id);
        const bowlFirstId = batFirstId === team1Id ? team2Id : team1Id;

        const orderSquad = (squadIds: string[]) => {
          const players = squadIds.map(id => state.players.find(p => p.id === id)).filter(Boolean) as Player[];
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
        };

        const t1Squad = orderSquad(state.franchises.find(f => f.id === batFirstId)?.squad || []);
        const t2Squad = orderSquad(state.franchises.find(f => f.id === bowlFirstId)?.squad || []);
        const t2Bowlers = getBowlerOrder(state.franchises.find(f => f.id === bowlFirstId)?.squad || []);
        const t1Bowlers = getBowlerOrder(state.franchises.find(f => f.id === batFirstId)?.squad || []);
        
        const pitch = MatchEngine.generatePitch();
        const weather = MatchEngine.generateWeather();
        const maxOvers = MatchEngine.getOversPerMatch(fixture.format);

        const simInnings = (batSquad: string[], bowlSquad: string[], target: number) => {
          const inn = MatchEngine.createEmptyInnings(batFirstId, bowlFirstId);
          inn.battingTeamId = batSquad === t1Squad ? batFirstId : bowlFirstId;
          inn.bowlingTeamId = batSquad === t1Squad ? bowlFirstId : batFirstId;
          
          const activeBowlerIds = bowlSquad.slice(0, 6);
          let strikerIdx = 0;
          let nonStrikerIdx = 1;
          let ballCount = 0;

          while (inn.overs < maxOvers && inn.wickets < 10) {
            const p1 = state.players.find(p => p.id === batSquad[strikerIdx]) || state.players[0];
            const p2Id = activeBowlerIds[((inn.overs % 5)) % Math.max(1, activeBowlerIds.length)];
            const p2 = state.players.find(p => p.id === p2Id) || state.players[0];
            
            const strikerStats = MatchEngine.getPlayerStats(p1.id, inn.batsmen);
            const bowlerStats = MatchEngine.getPlayerStats(p2.id, inn.bowlers);

            const currentOverProgress = inn.overs + inn.balls / 6;
            const reqRate = target ? ((target - inn.runs) / (Math.max(1, (maxOvers * 6) - ballCount) / 6)) : 8;
            const nonStrikerPlayer = state.players.find(p => p.id === batSquad[nonStrikerIdx]) || null;
            const bowlingSquadPlayers = bowlSquad
              .map(id => state.players.find(p => p.id === id))
              .filter(Boolean) as Player[];
            const fieldConfiguration = BowlerFieldStrategyEngine.generateFieldConfiguration({
              format: fixture.format,
              bowler: p2,
              striker: p1,
              nonStriker: nonStrikerPlayer,
              overs: Math.floor(currentOverProgress),
              balls: ballCount,
              wickets: inn.wickets,
              runs: inn.runs,
              target: target || undefined,
              pitch,
              weather,
              fieldingSquad: bowlingSquadPlayers,
            });
            const tacticalModel = buildDeliveryModel({
              format: fixture.format,
              field: fieldConfiguration,
              fieldPresetKey: fieldConfiguration.name,
              bowler: p2,
              striker: p1,
              overs: currentOverProgress,
              wickets: inn.wickets,
              requiredRate: reqRate,
            });
            const ball = MatchEngine.simulateBall(
              p1, p2, currentOverProgress, inn.wickets, 
              reqRate, 
              pitch, weather, strikerStats, bowlerStats, [], false, 0, fixture.format,
              undefined, undefined, undefined, tacticalModel
            );
            const isLegalDelivery = ball.extraType !== 'Wide' && ball.extraType !== 'No Ball';
            const batterRuns = ball.isExtra ? 0 : ball.runs;
            
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
              if (strikerIdx >= batSquad.length) strikerIdx = 0;
            }
            
            if (isLegalDelivery && ballCount > 0 && ballCount % 6 === 0) {
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
          activeTab: 'OVERVIEW',
          gameState: GameState.ARENA_HUB
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
      partialize: (state) => ({
        activeArenaId: state.activeArenaId,
        gameState: state.gameState,
        selectedFranchiseId: state.selectedFranchiseId,
        selectedFormat: state.selectedFormat,
        selectedSquadIds: state.selectedSquadIds,
        playingXIIds: state.playingXIIds,
        fixtures: state.fixtures,
        standings: state.standings,
        currentMatchId: state.currentMatchId,
        currentMatchToss: state.currentMatchToss,
        playerSeasonStats: state.playerSeasonStats,
        playerFatigue: state.playerFatigue,
        fixturePlayingXIs: state.fixturePlayingXIs,
        franchises: state.franchises,
        activeTab: state.activeTab,
        seriesConfig: state.seriesConfig,
      }),
      storage: {
        getItem: (name) => {
          try {
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
            const raw = localStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
            localStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            if (typeof localStorage !== 'undefined') {
              console.warn(`[useGameStore] Storage quota warning for ${name}:`, err);
              try {
                localStorage.removeItem('cricket-arena-v3');
                const minimal = {
                  state: {
                    activeArenaId: value?.state?.activeArenaId,
                    gameState: value?.state?.gameState,
                    selectedFormat: value?.state?.selectedFormat,
                    selectedFranchiseId: value?.state?.selectedFranchiseId,
                    selectedSquadIds: value?.state?.selectedSquadIds,
                    playingXIIds: value?.state?.playingXIIds,
                    currentMatchId: value?.state?.currentMatchId,
                    activeTab: value?.state?.activeTab,
                  },
                  version: value?.version,
                };
                localStorage.setItem(name, JSON.stringify(minimal));
              } catch (fallbackErr) {
                console.error('[useGameStore] Emergency storage fallback failed:', fallbackErr);
              }
            }
          }
        },
        removeItem: (name) => {
          try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
              localStorage.removeItem(name);
            }
          } catch {}
        },
      },
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__useGameStore = useGameStore;
}
