import { ArenaProfile, ArenaPlayerState, PlayerMatchStats, SeasonTeamStats } from '../models/ArenaState';

/**
 * A transaction-safe database abstraction for the Arena engine.
 * This simulates the behavior of a real database, allowing for atomic commits.
 */
export class ArenaDatabase {
  // In a real app, this would wrap IndexedDB (via Dexie) or a remote API.
  // We use memory stores here that can be synchronized to localStorage.
  private arenas = new Map<string, ArenaProfile>();
  private playerStates = new Map<string, ArenaPlayerState>();
  private matchStats = new Map<string, PlayerMatchStats>();
  private seasonStandings = new Map<string, SeasonTeamStats>();

  // Transaction buffer
  private transactionBuffer: {
    playerStates: Map<string, ArenaPlayerState>;
    matchStats: Map<string, PlayerMatchStats>;
    seasonStandings: Map<string, SeasonTeamStats>;
  } | null = null;

  async beginTransaction() {
    if (this.transactionBuffer) {
      throw new Error('Transaction already in progress.');
    }
    this.transactionBuffer = {
      playerStates: new Map(),
      matchStats: new Map(),
      seasonStandings: new Map()
    };
  }

  async commitTransaction() {
    if (!this.transactionBuffer) {
      throw new Error('No transaction in progress.');
    }

    try {
      // Commit all buffered changes to the main stores
      this.transactionBuffer.playerStates.forEach((val, key) => this.playerStates.set(key, val));
      this.transactionBuffer.matchStats.forEach((val, key) => this.matchStats.set(key, val));
      this.transactionBuffer.seasonStandings.forEach((val, key) => this.seasonStandings.set(key, val));
      
      // Simulate sync to persistent storage (e.g., localStorage)
      this.syncToStorage();
    } catch (e) {
      this.rollbackTransaction();
      throw new Error('Failed to commit transaction. Rolled back.');
    } finally {
      this.transactionBuffer = null;
    }
  }

  async rollbackTransaction() {
    this.transactionBuffer = null;
  }

  // Helper to read state (reads from buffer if exists, else main store)
  async getPlayerState(arenaId: string, playerId: string): Promise<ArenaPlayerState | undefined> {
    const key = `${arenaId}_${playerId}`;
    if (this.transactionBuffer?.playerStates.has(key)) {
      return this.transactionBuffer.playerStates.get(key);
    }
    return this.playerStates.get(key);
  }

  async savePlayerState(state: ArenaPlayerState) {
    if (this.transactionBuffer) {
      this.transactionBuffer.playerStates.set(state.id, { ...state, updatedAt: Date.now() });
    } else {
      this.playerStates.set(state.id, { ...state, updatedAt: Date.now() });
    }
  }

  async saveMatchStats(stats: PlayerMatchStats) {
    if (this.transactionBuffer) {
      this.transactionBuffer.matchStats.set(stats.id, stats);
    } else {
      this.matchStats.set(stats.id, stats);
    }
  }

  async getTeamStandings(arenaId: string, seasonId: string, teamId: string): Promise<SeasonTeamStats> {
    const key = `${arenaId}_${seasonId}_${teamId}`;
    let stats = this.transactionBuffer?.seasonStandings.get(key) || this.seasonStandings.get(key);
    
    if (!stats) {
      stats = { arenaId, seasonId, teamId, played: 0, won: 0, lost: 0, drawn: 0, tied: 0, noResult: 0, points: 0, nrr: 0 };
    }
    return { ...stats }; // Return copy
  }

  async saveTeamStandings(stats: SeasonTeamStats) {
    const key = `${stats.arenaId}_${stats.seasonId}_${stats.teamId}`;
    if (this.transactionBuffer) {
      this.transactionBuffer.seasonStandings.set(key, { ...stats });
    } else {
      this.seasonStandings.set(key, { ...stats });
    }
  }

  // App-level persistence (mock)
  private syncToStorage() {
    // e.g. localStorage.setItem('crex_arena_state', JSON.stringify(...))
  }
}

// Global Singleton
export const db = new ArenaDatabase();
