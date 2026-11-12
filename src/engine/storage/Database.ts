import { ArenaProfile, ArenaPlayerState, PlayerMatchStats, SeasonTeamStats, ArenaFormat } from '../models/ArenaState';

/**
 * A transaction-safe database abstraction for the Arena engine.
 * Isolates mutable state per (arenaId, playerId, format) so that
 * Arena A never contaminates Arena B or the global player registry.
 */
export class ArenaDatabase {
  private arenas = new Map<string, ArenaProfile>();
  private playerStates = new Map<string, ArenaPlayerState>(); // Key: `${arenaId}_${playerId}_${format}`
  private matchStats = new Map<string, PlayerMatchStats>();
  private seasonStandings = new Map<string, SeasonTeamStats>();
  private matchCheckpoints = new Map<string, any>(); // Key: matchId

  // Transaction buffer for atomic commits / rollbacks
  private transactionBuffer: {
    playerStates: Map<string, ArenaPlayerState>;
    matchStats: Map<string, PlayerMatchStats>;
    seasonStandings: Map<string, SeasonTeamStats>;
  } | null = null;

  async beginTransaction(): Promise<void> {
    if (this.transactionBuffer) {
      throw new Error('Transaction already in progress.');
    }
    this.transactionBuffer = {
      playerStates: new Map(),
      matchStats: new Map(),
      seasonStandings: new Map()
    };
  }

  async commitTransaction(): Promise<void> {
    if (!this.transactionBuffer) {
      throw new Error('No transaction in progress.');
    }

    try {
      // Commit all buffered changes to the main stores
      this.transactionBuffer.playerStates.forEach((val, key) => this.playerStates.set(key, val));
      this.transactionBuffer.matchStats.forEach((val, key) => this.matchStats.set(key, val));
      this.transactionBuffer.seasonStandings.forEach((val, key) => this.seasonStandings.set(key, val));
      
      this.syncToStorage();
    } catch (e) {
      this.rollbackTransaction();
      throw new Error('Failed to commit transaction. Rolled back.');
    } finally {
      this.transactionBuffer = null;
    }
  }

  async rollbackTransaction(): Promise<void> {
    this.transactionBuffer = null;
  }

  getKey(arenaId: string, playerId: string, format: ArenaFormat = 'T20'): string {
    return `${arenaId}_${playerId}_${format}`;
  }

  async getPlayerState(arenaId: string, playerId: string, format: ArenaFormat = 'T20'): Promise<ArenaPlayerState | undefined> {
    const key = this.getKey(arenaId, playerId, format);
    if (this.transactionBuffer?.playerStates.has(key)) {
      return this.transactionBuffer.playerStates.get(key);
    }
    return this.playerStates.get(key);
  }

  async getAllPlayerStatesForArena(arenaId: string, format?: ArenaFormat): Promise<ArenaPlayerState[]> {
    const results: ArenaPlayerState[] = [];
    const source = this.transactionBuffer ? this.transactionBuffer.playerStates : this.playerStates;
    
    source.forEach((state) => {
      if (state.arenaId === arenaId && (!format || state.format === format)) {
        results.push(state);
      }
    });

    // If in transaction, blend in base map records not yet modified
    if (this.transactionBuffer) {
      this.playerStates.forEach((state, key) => {
        if (state.arenaId === arenaId && (!format || state.format === format)) {
          if (!this.transactionBuffer!.playerStates.has(key)) {
            results.push(state);
          }
        }
      });
    }

    return results;
  }

  async savePlayerState(state: ArenaPlayerState): Promise<void> {
    const key = this.getKey(state.arenaId, state.playerId, state.format);
    const updated = { ...state, updatedAt: Date.now() };

    if (this.transactionBuffer) {
      this.transactionBuffer.playerStates.set(key, updated);
    } else {
      this.playerStates.set(key, updated);
    }
  }

  async saveMatchStats(stats: PlayerMatchStats): Promise<void> {
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
    return { ...stats };
  }

  async saveTeamStandings(stats: SeasonTeamStats): Promise<void> {
    const key = `${stats.arenaId}_${stats.seasonId}_${stats.teamId}`;
    if (this.transactionBuffer) {
      this.transactionBuffer.seasonStandings.set(key, { ...stats });
    } else {
      this.seasonStandings.set(key, { ...stats });
    }
  }

  async saveMatchCheckpoint(checkpoint: any): Promise<void> {
    if (!checkpoint || !checkpoint.matchId) return;
    this.matchCheckpoints.set(checkpoint.matchId, {
      ...checkpoint,
      savedAt: Date.now()
    });
  }

  async getMatchCheckpoint(matchId: string): Promise<any | undefined> {
    return this.matchCheckpoints.get(matchId);
  }

  async getLatestUnfinishedMatch(): Promise<any | undefined> {
    let latest: any | undefined;
    for (const cp of this.matchCheckpoints.values()) {
      if (!cp.isMatchOver && !cp.resultSubmitted) {
        if (!latest || (cp.savedAt || 0) > (latest.savedAt || 0)) {
          latest = cp;
        }
      }
    }
    return latest;
  }

  async clearMatchCheckpoint(matchId: string): Promise<void> {
    this.matchCheckpoints.delete(matchId);
  }

  private syncToStorage(): void {
    // In-memory synced; can also serialize to local storage if needed
  }
}

// Global Singleton
export const db = new ArenaDatabase();
