export interface GoogleUserProfile {
  id: string; // Google user ID (sub)
  email: string;
  name: string;
  picture?: string;
  givenName?: string;
  familyName?: string;
  token?: string;
  lastSyncedAt?: string;
}

export interface CloudSaveData {
  version: number;
  user: GoogleUserProfile;
  savedAt: string;
  state: {
    activeArenaId?: string;
    gameState?: string;
    selectedFranchiseId?: string | null;
    selectedFormat?: string | null;
    selectedSquadIds?: string[];
    playingXIIds?: string[];
    fixtures?: any[];
    standings?: any[];
    currentMatchId?: string | null;
    playerSeasonStats?: Record<string, any>;
    liveMatchState?: any;
    franchises?: any[];
    seriesConfig?: any;
    activeTab?: string;
  };
  summary: {
    format: string;
    franchiseName: string;
    totalFixtures: number;
    completedFixtures: number;
    isLiveMatchActive: boolean;
  };
}
