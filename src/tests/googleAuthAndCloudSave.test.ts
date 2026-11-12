import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { useGameStore, GameState } from '../stores/useGameStore';
import { decodeGoogleJwt, createDemoGoogleProfile } from '../lib/googleAuth';

// Mock localStorage and window for Node environment
const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, value: string) => storageMap.set(key, String(value)),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
  }
  if (typeof globalThis.window === 'undefined') {
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: mockLocalStorage },
      writable: true,
      configurable: true,
    });
  }
});

describe('Google Authentication and Cloud Save System', () => {
  beforeEach(() => {
    storageMap.clear();
    const store = useGameStore.getState();
    const f1 = store.franchises[0]?.id || 'MI';
    const f2 = store.franchises[1]?.id || 'CSK';

    useGameStore.setState({
      authUser: null,
      cloudSaveStatus: 'idle',
      lastCloudSaveTime: null,
      gameState: GameState.ARENA_HUB,
      selectedFranchiseId: f1,
      selectedFormat: 'IPL',
      fixtures: [
        {
          id: 'fix_cloud_1',
          matchNumber: 1,
          day: 1,
          team1Id: f1,
          team2Id: f2,
          status: 'UPCOMING' as any,
          fixtureStatus: 'SCHEDULED',
          format: 'IPL' as any,
        },
      ],
      liveMatchState: null,
    });
  });

  it('1. decodes standard Google Identity JWT id_token payload', () => {
    const payload = {
      sub: 'google_user_109283748291',
      email: 'virat.fan@gmail.com',
      name: 'Virat Fan',
      picture: 'https://lh3.googleusercontent.com/a/test-avatar',
      given_name: 'Virat',
      family_name: 'Fan',
    };
    const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const dummyJwt = `header.${b64Payload}.signature`;

    const profile = decodeGoogleJwt(dummyJwt);
    expect(profile).not.toBeNull();
    expect(profile?.id).toBe('google_user_109283748291');
    expect(profile?.email).toBe('virat.fan@gmail.com');
    expect(profile?.name).toBe('Virat Fan');
    expect(profile?.picture).toBe('https://lh3.googleusercontent.com/a/test-avatar');
  });

  it('2. creates instant demo Google profile for offline/dev testing', () => {
    const demo = createDemoGoogleProfile('cricket.manager@gmail.com', 'Cricket Manager');
    expect(demo.email).toBe('cricket.manager@gmail.com');
    expect(demo.name).toBe('Cricket Manager');
    expect(demo.picture).toBeDefined();
    expect(demo.id).toContain('google_demo_');
  });

  it('3. loginWithGoogle sets authUser and triggers cloud saving', async () => {
    const profile = createDemoGoogleProfile('user1@gmail.com', 'User One');
    const store = useGameStore.getState();

    store.loginWithGoogle(profile);

    expect(useGameStore.getState().authUser?.email).toBe('user1@gmail.com');
    
    // Wait for auto-save promise to resolve
    await store.saveToCloud();
    expect(useGameStore.getState().cloudSaveStatus).toBe('saved');
    expect(useGameStore.getState().lastCloudSaveTime).not.toBeNull();

    // Verify localStorage key was written
    const cloudRaw = mockLocalStorage.getItem(`cricket-arena-cloud-save-${profile.id}`);
    expect(cloudRaw).not.toBeNull();
    const cloudParsed = JSON.parse(cloudRaw!);
    expect(cloudParsed.user.email).toBe('user1@gmail.com');
    expect(cloudParsed.summary.format).toBe('IPL');
  });

  it('4. saveToCloud serializes tournament, franchise, and match data', async () => {
    const profile = createDemoGoogleProfile('rohit@gmail.com', 'Rohit Sharma');
    useGameStore.getState().setAuthUser(profile);

    const saveResult = await useGameStore.getState().saveToCloud();
    expect(saveResult.success).toBe(true);
    expect(saveResult.message).toContain('rohit@gmail.com');

    const key = `cricket-arena-cloud-save-${profile.id}`;
    const raw = mockLocalStorage.getItem(key);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.fixtures.length).toBe(1);
    expect(parsed.state.selectedFormat).toBe('IPL');
  });

  it('5. loadFromCloud restores career state for the signed-in user', async () => {
    const profile = createDemoGoogleProfile('dhoni@gmail.com', 'MS Dhoni');
    useGameStore.getState().setAuthUser(profile);

    // Save initial state with 1 fixture
    await useGameStore.getState().saveToCloud();

    // Alter local store state
    useGameStore.setState({
      fixtures: [],
      selectedFormat: 'TEST' as any,
    });
    expect(useGameStore.getState().fixtures.length).toBe(0);

    // Restore from Google Cloud
    const restoreResult = await useGameStore.getState().loadFromCloud();
    expect(restoreResult.success).toBe(true);
    expect(useGameStore.getState().fixtures.length).toBe(1);
    expect(useGameStore.getState().selectedFormat).toBe('IPL');
  });

  it('6. exportSaveData returns valid JSON string with version and state', () => {
    const profile = createDemoGoogleProfile('tester@gmail.com', 'Tester');
    useGameStore.getState().setAuthUser(profile);

    const jsonStr = useGameStore.getState().exportSaveData();
    expect(typeof jsonStr).toBe('string');
    const parsed = JSON.parse(jsonStr);
    expect(parsed.version).toBe(3);
    expect(parsed.user.email).toBe('tester@gmail.com');
    expect(parsed.state).toBeDefined();
    expect(parsed.summary).toBeDefined();
  });

  it('7. importSaveData safely validates and merges save file', () => {
    const exportStr = useGameStore.getState().exportSaveData();
    
    // Clear state
    useGameStore.setState({ fixtures: [] });
    expect(useGameStore.getState().fixtures.length).toBe(0);

    // Import valid save
    const importRes = useGameStore.getState().importSaveData(exportStr);
    expect(importRes.success).toBe(true);
    expect(useGameStore.getState().fixtures.length).toBe(1);

    // Attempt invalid save
    const failRes = useGameStore.getState().importSaveData('invalid json');
    expect(failRes.success).toBe(false);
  });

  it('8. logoutGoogle clears authUser and resets sync status', () => {
    const profile = createDemoGoogleProfile('user@gmail.com', 'Test User');
    useGameStore.getState().setAuthUser(profile);
    expect(useGameStore.getState().authUser).not.toBeNull();

    useGameStore.getState().logoutGoogle();
    expect(useGameStore.getState().authUser).toBeNull();
    expect(useGameStore.getState().cloudSaveStatus).toBe('idle');
  });

  it('9. in-progress live match state is preserved during Google cloud save', async () => {
    const profile = createDemoGoogleProfile('live.player@gmail.com', 'Live Player');
    useGameStore.getState().setAuthUser(profile);

    const mockLiveState = {
      scorecard: {
        innings: [
          {
            battingTeamId: 'MI',
            bowlingTeamId: 'CSK',
            runs: 142,
            wickets: 3,
            overs: 14.2,
          },
        ],
      },
      currentBatterId: 'p1',
      currentBowlerId: 'p2',
    };

    useGameStore.setState({
      currentMatchId: 'live_match_101',
      liveMatchState: mockLiveState,
    });

    await useGameStore.getState().saveToCloud();

    // Verify liveMatchState was preserved in cloud payload
    const cloudRaw = mockLocalStorage.getItem(`cricket-arena-cloud-save-${profile.id}`);
    const cloudParsed = JSON.parse(cloudRaw!);
    expect(cloudParsed.state.liveMatchState.scorecard.innings[0].runs).toBe(142);
    expect(cloudParsed.summary.isLiveMatchActive).toBe(true);
  });
});
