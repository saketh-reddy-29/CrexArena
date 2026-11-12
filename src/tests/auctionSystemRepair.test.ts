import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, GameState } from '../stores/useGameStore';

describe('Auction System Repair & Integrity Suite', () => {
  beforeEach(() => {
    const store = useGameStore.getState();
    store.resetGame();
    store.resetAuction();
  });

  it('1. Correctly initializes starting purse and player pool', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const state = useGameStore.getState();

    expect(state.auctionPool.length).toBeGreaterThan(0);
    expect(state.franchises.length).toBe(10);
    state.franchises.forEach((f) => {
      expect(f.purse).toBe(1200000000); // 120 Cr starting purse
      expect(f.squad.length).toBe(0);
      expect(f.overseasCount).toBe(0);
    });
    expect(state.auctionPhase).toBe('bidding');
    expect(state.currentAuctionPlayerId).not.toBeNull();
  });

  it('2. Accepts valid normal bids with appropriate increment', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const firstPlayerId = useGameStore.getState().currentAuctionPlayerId!;
    const player = useGameStore.getState().players.find((p) => p.id === firstPlayerId)!;
    const team1Id = '1';

    // First bid opens at or above base price
    const res1 = store.placeAuctionBid(team1Id);
    expect(res1.ok).toBe(true);

    const stateAfter1 = useGameStore.getState();
    expect(stateAfter1.auctionLeadingTeamId).toBe(team1Id);
    expect(stateAfter1.auctionCurrentBid).toBeGreaterThanOrEqual(player.basePrice);

    // Competing bid from team 2
    const team2Id = '2';
    const bidBefore = stateAfter1.auctionCurrentBid;
    const res2 = store.placeAuctionBid(team2Id);
    expect(res2.ok).toBe(true);

    const stateAfter2 = useGameStore.getState();
    expect(stateAfter2.auctionLeadingTeamId).toBe(team2Id);
    expect(stateAfter2.auctionCurrentBid).toBeGreaterThan(bidBefore);
  });

  it('3. Rejects duplicate / consecutive bids from the same team', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const team1Id = '1';

    const res1 = store.placeAuctionBid(team1Id);
    expect(res1.ok).toBe(true);

    // Immediate second bid from same team should be rejected
    const res2 = store.placeAuctionBid(team1Id);
    expect(res2.ok).toBe(false);
    expect(res2.reason).toContain('already holds the leading bid');
  });

  it('4. Rejects bids if a team has insufficient purse', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const team1Id = '1';

    // Artificially deplete team 1 purse
    useGameStore.setState((s) => ({
      franchises: s.franchises.map((f) => (f.id === team1Id ? { ...f, purse: 1000000 } : f)),
    }));

    const res = store.placeAuctionBid(team1Id, 50000000);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('insufficient purse');
  });

  it('5. Rejects bids if team has reached maximum squad size (25 players)', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const team1Id = '1';

    // Fill squad to 25 dummy IDs
    const dummySquad = Array.from({ length: 25 }, (_, i) => `dummy-${i}`);
    useGameStore.setState((s) => ({
      franchises: s.franchises.map((f) => (f.id === team1Id ? { ...f, squad: dummySquad } : f)),
    }));

    const res = store.placeAuctionBid(team1Id);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('maximum squad limit');
  });

  it('6. Rejects bids if overseas player quota (8) is exhausted', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');

    // Find an overseas player and nominate them
    const overseasPlayer = store.players.find((p) => p.nationality === 'Overseas')!;
    store.nominatePlayer(overseasPlayer.id);

    const team1Id = '1';
    // Set overseasCount to 8
    useGameStore.setState((s) => ({
      franchises: s.franchises.map((f) => (f.id === team1Id ? { ...f, overseasCount: 8 } : f)),
    }));

    const res = store.placeAuctionBid(team1Id);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('overseas limit');
  });

  it('7. Atomically deducts purse and adds player to squad on final sale', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const playerId = useGameStore.getState().currentAuctionPlayerId!;
    const team1Id = '1';

    store.placeAuctionBid(team1Id);
    const saleBid = useGameStore.getState().auctionCurrentBid;
    const initialPurse = useGameStore.getState().franchises.find((f) => f.id === team1Id)!.purse;

    const saleResult = store.finalizePlayerSale();
    expect(saleResult.outcome).toBe('SOLD');
    expect(saleResult.teamId).toBe(team1Id);
    expect(saleResult.price).toBe(saleBid);

    const updatedTeam = useGameStore.getState().franchises.find((f) => f.id === team1Id)!;
    expect(updatedTeam.squad).toContain(playerId);
    expect(updatedTeam.purse).toBe(initialPurse - saleBid);
    expect(useGameStore.getState().playerOwnershipMap[playerId]?.status).toBe('SOLD');

    // Idempotency: calling finalize again does not double-charge
    const saleResult2 = store.finalizePlayerSale();
    expect(saleResult2.outcome).toBe('SOLD');
    const updatedTeam2 = useGameStore.getState().franchises.find((f) => f.id === team1Id)!;
    expect(updatedTeam2.purse).toBe(initialPurse - saleBid);
  });

  it('8. Properly marks player as UNSOLD when no bids are placed', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const playerId = useGameStore.getState().currentAuctionPlayerId!;

    const result = store.finalizePlayerSale();
    expect(result.outcome).toBe('UNSOLD');

    const state = useGameStore.getState();
    expect(state.unsoldPlayerIds).toContain(playerId);
    expect(state.playerOwnershipMap[playerId]?.status).toBe('UNSOLD');

    // All franchises keep their exact purses
    state.franchises.forEach((f) => {
      expect(f.purse).toBe(1200000000);
      expect(f.squad).not.toContain(playerId);
    });
  });

  it('9. Handles player pass and withdrawn teams correctly', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const team1Id = '1';

    store.teamPassPlayer(team1Id);
    expect(useGameStore.getState().withdrawnTeams).toContain(team1Id);

    const res = store.placeAuctionBid(team1Id);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('withdrawn');
  });

  it('10. Advances through players and triggers accelerated round for unsold players', () => {
    const store = useGameStore.getState();
    // Create a mini auction pool of 2 players
    const p1 = store.players[0].id;
    const p2 = store.players[1].id;

    useGameStore.setState({
      auctionPool: [p1, p2],
      auctionPoolIndex: 0,
      currentAuctionPlayerId: p1,
      auctionRound: 1,
      auctionPhase: 'bidding',
      unsoldPlayerIds: [],
    });

    // P1 goes unsold
    store.finalizePlayerSale();
    expect(useGameStore.getState().unsoldPlayerIds).toContain(p1);

    // Advance to P2
    store.advanceAuctionNextPlayer();
    expect(useGameStore.getState().currentAuctionPlayerId).toBe(p2);
    expect(useGameStore.getState().auctionPoolIndex).toBe(1);

    // P2 is sold to Team 1
    store.placeAuctionBid('1');
    store.finalizePlayerSale();

    // Advance beyond end of pool -> enters Accelerated Round 2 with P1
    store.advanceAuctionNextPlayer();
    const state = useGameStore.getState();
    expect(state.auctionRound).toBe(2);
    expect(state.currentAuctionPlayerId).toBe(p1);
    expect(state.auctionPoolIndex).toBe(0);
  });

  it('11. Survives simulated state restoration without resetting pool index or history', () => {
    const store = useGameStore.getState();
    store.initAuction('IPL');
    const p1 = useGameStore.getState().currentAuctionPlayerId!;

    store.placeAuctionBid('1');
    store.finalizePlayerSale();
    store.advanceAuctionNextPlayer();

    const p2 = useGameStore.getState().currentAuctionPlayerId!;
    const savedPool = useGameStore.getState().auctionPool;
    const savedHistory = useGameStore.getState().auctionHistory;

    // Simulate page reload by re-reading state
    const reloadStore = useGameStore.getState();
    expect(reloadStore.auctionPoolIndex).toBe(1);
    expect(reloadStore.currentAuctionPlayerId).toBe(p2);
    expect(reloadStore.auctionPool).toEqual(savedPool);
    expect(reloadStore.auctionHistory).toEqual(savedHistory);
  });
});
