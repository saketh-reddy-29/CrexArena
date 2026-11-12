import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pause, Play, FastForward, Star, Gavel, Users, Trophy, TrendingUp,
  Shield, Globe, Award, DollarSign, Clock, CheckCircle2, XCircle, ArrowRight,
  Flame, Sparkles, ChevronRight, BarChart3, AlertCircle
} from 'lucide-react';
import { useGameStore, GameState, Franchise, PlayerOwnershipStatus } from '../stores/useGameStore';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { evaluateBid, AuctionState, FranchiseAIState, getBidDelay } from '../lib/auctionAI';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getPlayerImage } from '../lib/playerImages';
import { Player } from '../types/common';
import { resolveTeamLogoUrl } from '../lib/teamLogos';

const createFranchiseAIState = (): FranchiseAIState => ({
  fatigueLevel: 10,
  lastPurchasePrice: 0,
  consecutivePasses: 0,
});

export default function AuctionRoom() {
  const { 
    franchises, 
    selectedFranchiseId, 
    players,
    auctionPool,
    auctionPoolIndex,
    auctionCurrentBid,
    auctionLeadingTeamId,
    auctionPhase,
    auctionRound,
    auctionTimer,
    auctionIsPaused,
    withdrawnTeams,
    playerOwnershipMap,
    auctionHistory,
    bidLog,
    initAuction,
    nominatePlayer,
    placeAuctionBid,
    finalizePlayerSale,
    advanceAuctionNextPlayer,
    teamPassPlayer,
    setAuctionTimer,
    setAuctionPaused,
    simulateFullAuction,
    setGameState,
    setActiveTab,
    setViewedPlayer,
  } = useGameStore();

  const [sidebarTab, setSidebarTab] = useState<'live' | 'squads' | 'sold' | 'unsold'>('live');
  const [selectedSquadTeamId, setSelectedSquadTeamId] = useState<string>(selectedFranchiseId || '1');
  const [bidError, setBidError] = useState<string | null>(null);

  const franchiseAIStates = useRef<Map<string, FranchiseAIState>>(new Map());

  // Initialize franchise AI emotional states
  useEffect(() => {
    if (franchiseAIStates.current.size === 0) {
      franchises.forEach((franchise) => {
        franchiseAIStates.current.set(franchise.id, createFranchiseAIState());
      });
    }
  }, [franchises]);

  // Pre-flight initialization on mount
  useEffect(() => {
    if (!auctionPool || auctionPool.length === 0) {
      initAuction('IPL');
    }
  }, [auctionPool, initAuction]);

  const currentPlayerId = auctionPool[auctionPoolIndex] || null;
  const currentPlayer = useMemo(() => {
    return currentPlayerId ? players.find(p => p.id === currentPlayerId) || null : null;
  }, [currentPlayerId, players]);

  const userFranchise = franchises.find(f => f.id === selectedFranchiseId);
  const leadingFranchise = franchises.find(f => f.id === auctionLeadingTeamId);

  // Auction progression calculations
  const totalPlayersInPool = auctionPool.length;
  const remainingPlayersCount = Math.max(0, totalPlayersInPool - auctionPoolIndex - 1);
  const soldPlayersCount = auctionHistory.filter(h => h.soldTo !== 'UNSOLD').length;
  const unsoldPlayersCount = auctionHistory.filter(h => h.soldTo === 'UNSOLD').length;

  const auctionStateForAI: AuctionState = useMemo(() => {
    const remainingPool = auctionPool
      .slice(auctionPoolIndex + 1)
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => Boolean(p));

    return {
      poolIndex: auctionPoolIndex,
      totalPlayers: totalPlayersInPool,
      auctionHistory,
      remainingPool,
    };
  }, [auctionPoolIndex, totalPlayersInPool, auctionHistory, auctionPool, players]);

  // Master countdown timer tick
  useEffect(() => {
    if (auctionPhase !== 'bidding' || auctionIsPaused) return;

    const interval = setInterval(() => {
      if (auctionTimer <= 1) {
        clearInterval(interval);
        handleSaleConclusion();
      } else {
        setAuctionTimer(auctionTimer - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auctionPhase, auctionIsPaused, auctionTimer, setAuctionTimer]);

  // Authoritative conclusion handler
  const handleSaleConclusion = useCallback(() => {
    if (auctionPhase !== 'bidding') return;
    const result = finalizePlayerSale();

    if (result.outcome === 'SOLD' && result.teamId === selectedFranchiseId) {
      confetti({
        particleCount: 160,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#F5B82E', '#258BFF', '#FFFFFF']
      });
    }

    // Auto-advance after dramatic pause
    const pauseMs = result.outcome === 'SOLD' ? 3200 : 2000;
    setTimeout(() => {
      advanceAuctionNextPlayer();
    }, pauseMs);
  }, [auctionPhase, finalizePlayerSale, selectedFranchiseId, advanceAuctionNextPlayer]);

  // AI Bidding Engine loop
  useEffect(() => {
    if (auctionPhase !== 'bidding' || auctionIsPaused || !currentPlayer) return;

    // Filter AI franchises eligible to bid
    const eligibleFranchises = franchises.filter(f => {
      if (f.id === auctionLeadingTeamId) return false;
      if (f.id === selectedFranchiseId) return false; // User controls their own team
      if (withdrawnTeams.includes(f.id)) return false;
      if (f.squad.length >= 25) return false;
      if (currentPlayer.nationality === 'Overseas' && f.overseasCount >= 8) return false;

      // Ensure budget buffer
      const requiredNextBid = auctionLeadingTeamId 
        ? auctionCurrentBid + (auctionCurrentBid < 50_000_000 ? 2_500_000 : 5_000_000)
        : auctionCurrentBid;
      if (f.purse < requiredNextBid) return false;

      const aiState = franchiseAIStates.current.get(f.id) ?? createFranchiseAIState();
      const decision = evaluateBid(currentPlayer, f, auctionCurrentBid, franchises, auctionStateForAI, aiState);
      return decision.decision === 'BUY' && Math.random() > decision.dropoutProbability;
    });

    if (eligibleFranchises.length === 0) return;

    // Calculate bid timing delays for competitive AI bidders
    const bidsWithDelay = eligibleFranchises.map(franchise => {
      const aiState = franchiseAIStates.current.get(franchise.id) ?? createFranchiseAIState();
      const decision = evaluateBid(currentPlayer, franchise, auctionCurrentBid, franchises, auctionStateForAI, aiState);
      return {
        franchise,
        decision,
        delay: getBidDelay(decision),
      };
    }).sort((a, b) => a.delay - b.delay);

    const fastestBid = bidsWithDelay[0];
    if (!fastestBid) return;

    const timer = setTimeout(() => {
      // Re-verify eligibility before placing
      if (auctionPhase !== 'bidding' || auctionIsPaused || auctionTimer <= 1) return;
      const res = placeAuctionBid(fastestBid.franchise.id);
      if (res.ok) {
        const aiState = franchiseAIStates.current.get(fastestBid.franchise.id) ?? createFranchiseAIState();
        franchiseAIStates.current.set(fastestBid.franchise.id, {
          ...aiState,
          fatigueLevel: Math.min(100, aiState.fatigueLevel + 5),
          lastPurchasePrice: auctionCurrentBid,
          consecutivePasses: 0,
        });
      }
    }, fastestBid.delay);

    return () => clearTimeout(timer);
  }, [
    auctionPhase,
    auctionIsPaused,
    currentPlayer,
    franchises,
    auctionLeadingTeamId,
    selectedFranchiseId,
    withdrawnTeams,
    auctionCurrentBid,
    auctionTimer,
    auctionStateForAI,
    placeAuctionBid,
  ]);

  // User Bidding Handlers
  const handleUserBid = (increment?: number) => {
    if (!selectedFranchiseId) {
      setBidError('No team selected to bid with');
      return;
    }
    setBidError(null);

    const targetAmount = increment ? auctionCurrentBid + increment : undefined;
    const res = placeAuctionBid(selectedFranchiseId, targetAmount);
    if (!res.ok && res.reason) {
      setBidError(res.reason);
      setTimeout(() => setBidError(null), 3000);
    }
  };

  const handleUserPass = () => {
    if (selectedFranchiseId) {
      teamPassPlayer(selectedFranchiseId);
    }
  };

  return (
    <div className="min-h-screen bg-[#071426] text-[#F6F8FC] font-sans flex flex-col relative overflow-hidden bg-stadium-pattern">
      {/* Top Header & Overview Bar */}
      <header className="sticky top-0 z-40 bg-[#071426]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5B82E] to-[#C48805] p-0.5 flex items-center justify-center shadow-lg shadow-[#F5B82E]/20">
              <div className="w-full h-full bg-[#071426] rounded-[10px] flex items-center justify-center">
                <Gavel className="w-5 h-5 text-[#F5B82E]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
                  IPL 2026 MEGA AUCTION
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold">
                  {auctionRound === 1 ? 'MAIN ROUND' : 'ACCELERATED ROUND'}
                </span>
              </div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                Auction Control Centre
              </h1>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <div className="bg-[#10233D] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Users className="w-4 h-4 text-[#9DAEC4]" />
              <div>
                <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Sold / Total</div>
                <div className="font-black text-white">{soldPlayersCount} / {totalPlayersInPool}</div>
              </div>
            </div>
            <div className="bg-[#10233D] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Unsold</div>
                <div className="font-black text-amber-400">{unsoldPlayersCount}</div>
              </div>
            </div>
            {userFranchise && (
              <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: userFranchise.color }} />
                <div>
                  <div className="text-[10px] text-blue-300 uppercase font-bold">{userFranchise.shortName} Purse</div>
                  <div className="font-black text-[#F5B82E]">₹{(userFranchise.purse / 10000000).toFixed(2)} Cr</div>
                </div>
              </div>
            )}

            {/* Quick Action Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAuctionPaused(!auctionIsPaused)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                title={auctionIsPaused ? 'Resume Auction' : 'Pause Auction'}
              >
                {auctionIsPaused ? <Play className="w-4 h-4 text-green-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
              </button>
              <button
                onClick={() => simulateFullAuction(players)}
                className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Instant simulation of remaining auction"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Simulate Rest</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Auction Studio Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Central Stage: Current Player & Active Podium (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Central Podium Card */}
          <div className="glass-card rounded-3xl p-6 relative overflow-hidden border border-white/10">
            {/* Ambient lighting effects */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#F5B82E]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Stage Status Header */}
            <div className="flex items-center justify-between mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm",
                  auctionPhase === 'bidding' && "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
                  auctionPhase === 'sold' && "bg-blue-500/20 text-blue-300 border border-blue-500/40",
                  auctionPhase === 'unsold' && "bg-red-500/20 text-red-300 border border-red-500/40",
                  auctionPhase === 'idle' && "bg-zinc-700/50 text-zinc-300 border border-zinc-600",
                  auctionPhase === 'completed' && "bg-purple-500/20 text-purple-300 border border-purple-500/40",
                )}>
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    auctionPhase === 'bidding' && "bg-emerald-400 animate-ping",
                    auctionPhase === 'sold' && "bg-blue-400",
                    auctionPhase === 'unsold' && "bg-red-400",
                    auctionPhase === 'idle' && "bg-zinc-400",
                    auctionPhase === 'completed' && "bg-purple-400",
                  )} />
                  <span>
                    {auctionPhase === 'bidding' && 'LIVE ON THE BLOCK'}
                    {auctionPhase === 'sold' && 'HAMMER DOWN — SOLD!'}
                    {auctionPhase === 'unsold' && 'PASSED — UNSOLD'}
                    {auctionPhase === 'idle' && 'READY'}
                    {auctionPhase === 'completed' && 'AUCTION COMPLETED'}
                  </span>
                </div>
                <span className="text-xs text-[#9DAEC4] font-medium">
                  Player {auctionPoolIndex + 1} of {totalPlayersInPool}
                </span>
              </div>

              {/* Countdown Clock */}
              {auctionPhase === 'bidding' && (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-2xl font-black text-sm border shadow-lg transition-all",
                  auctionTimer <= 3
                    ? "bg-red-500/20 text-red-400 border-red-500/50 animate-pulse"
                    : "bg-[#071426]/80 text-[#F5B82E] border-[#F5B82E]/40"
                )}>
                  <Clock className="w-4 h-4" />
                  <span>{auctionTimer}s</span>
                </div>
              )}
            </div>

            {/* Central Stage Body */}
            {currentPlayer ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 relative z-10 items-center">
                {/* Player Portrait & Crest (5 cols) */}
                <div className="md:col-span-5 flex flex-col items-center justify-center">
                  <div 
                    onClick={() => setViewedPlayer(currentPlayer.id)}
                    className="group relative w-56 h-72 rounded-2xl overflow-hidden border-2 border-white/20 bg-gradient-to-b from-[#152C4D] to-[#071426] shadow-2xl cursor-pointer hover:border-[#258BFF] transition-all"
                  >
                    <JerseyPlayerImage
                      player={currentPlayer}
                      franchiseId={leadingFranchise?.id}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500 origin-bottom"
                      imageClassName="w-full h-full"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#071426] via-[#071426]/70 to-transparent" />
                    
                    {/* Nationality & Role Badges */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-black text-white flex items-center gap-1">
                        <Star className="w-2.5 h-2.5 text-[#F5B82E] fill-[#F5B82E]" />
                        {currentPlayer.rating}
                      </span>
                    </div>

                    <div className="absolute top-2 right-2">
                      {currentPlayer.nationality === 'Overseas' ? (
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/30 backdrop-blur-md border border-blue-400/40 text-[10px] font-bold text-blue-200 flex items-center gap-1">
                          <Globe className="w-2.5 h-2.5" /> Overseas
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/30 backdrop-blur-md border border-emerald-400/40 text-[10px] font-bold text-emerald-200">
                          Indian
                        </span>
                      )}
                    </div>

                    <div className="absolute bottom-2 left-3 right-3 text-center">
                      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{currentPlayer.role}</div>
                      <div className="text-xs text-[#9DAEC4]">{currentPlayer.battingStyle || 'Right-hand bat'}</div>
                    </div>
                  </div>
                </div>

                {/* Player Profile & Bid Podium (7 cols) */}
                <div className="md:col-span-7 flex flex-col gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                      {currentPlayer.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#9DAEC4]">
                      <span className="px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 font-bold text-white">
                        {currentPlayer.role}
                      </span>
                      <span>•</span>
                      <span>{currentPlayer.bowlingStyle || 'Right-arm medium'}</span>
                      <span>•</span>
                      <span>Form: {currentPlayer.form ?? 85}/100</span>
                    </div>
                  </div>

                  {/* Player Key Attributes Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-[#071426]/60 p-3 rounded-2xl border border-white/5">
                    <div className="text-center p-2 rounded-xl bg-white/5">
                      <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Batting</div>
                      <div className="text-base font-black text-white">{currentPlayer.stats.batting}</div>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-white/5">
                      <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Bowling</div>
                      <div className="text-base font-black text-white">{currentPlayer.stats.bowling}</div>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-white/5">
                      <div className="text-[10px] text-[#9DAEC4] uppercase font-bold">Fielding</div>
                      <div className="text-base font-black text-white">{currentPlayer.stats.fielding}</div>
                    </div>
                  </div>

                  {/* Current Highest Bid Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#10233D] to-[#152C4D] border border-white/10 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#9DAEC4] uppercase tracking-wider">
                          {leadingFranchise ? 'CURRENT HIGHEST BID' : 'OPENING BASE PRICE'}
                        </div>
                        <div className="text-3xl sm:text-4xl font-black text-[#F5B82E] mt-0.5 tracking-tight">
                          ₹{(auctionCurrentBid / 10000000).toFixed(2)} <span className="text-lg font-bold text-white/60">Crore</span>
                        </div>
                      </div>

                      {leadingFranchise ? (
                        <div className="flex items-center gap-3 bg-[#071426]/70 px-4 py-2 rounded-xl border border-white/10">
                          <img 
                            src={resolveTeamLogoUrl(leadingFranchise.shortName, leadingFranchise.logo)} 
                            alt={leadingFranchise.name}
                            className="w-8 h-8 object-contain" 
                          />
                          <div className="text-right">
                            <div className="text-[10px] text-[#9DAEC4] font-bold">LEADING BIDDER</div>
                            <div className="text-sm font-black text-white">{leadingFranchise.name}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-[#9DAEC4] font-medium">
                          Awaiting initial bid...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bid Error Notification */}
                  {bidError && (
                    <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-2 animate-shake">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{bidError}</span>
                    </div>
                  )}

                  {/* Interactive Bidding Controls for User */}
                  {auctionPhase === 'bidding' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => handleUserBid()}
                        disabled={auctionLeadingTeamId === selectedFranchiseId || !userFranchise}
                        className={cn(
                          "flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg",
                          auctionLeadingTeamId === selectedFranchiseId
                            ? "bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 cursor-not-allowed"
                            : "bg-[#258BFF] hover:bg-blue-600 text-white btn-glow cursor-pointer active:scale-95"
                        )}
                      >
                        <Gavel className="w-4 h-4" />
                        <span>
                          {auctionLeadingTeamId === selectedFranchiseId 
                            ? 'YOU HOLD HIGHEST BID' 
                            : `BID ₹${((auctionCurrentBid + (auctionCurrentBid < 50_000_000 ? 2_500_000 : 5_000_000)) / 10000000).toFixed(2)} CR`}
                        </span>
                      </button>

                      <button
                        onClick={() => handleUserBid(25_000_000)}
                        disabled={auctionLeadingTeamId === selectedFranchiseId}
                        className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-colors active:scale-95"
                        title="Jump bid by +25 Lakhs"
                      >
                        +25L
                      </button>

                      <button
                        onClick={() => handleUserBid(50_000_000)}
                        disabled={auctionLeadingTeamId === selectedFranchiseId}
                        className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-colors active:scale-95"
                        title="Jump bid by +50 Lakhs"
                      >
                        +50L
                      </button>

                      <button
                        onClick={handleUserPass}
                        disabled={withdrawnTeams.includes(selectedFranchiseId || '')}
                        className={cn(
                          "py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors",
                          withdrawnTeams.includes(selectedFranchiseId || '')
                            ? "bg-red-950/40 text-red-400 border border-red-800/40 cursor-not-allowed"
                            : "bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 active:scale-95"
                        )}
                      >
                        {withdrawnTeams.includes(selectedFranchiseId || '') ? 'PASSED' : 'PASS'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-16 text-center">
                <Trophy className="w-16 h-16 text-[#F5B82E] mx-auto mb-4" />
                <h3 className="text-2xl font-black text-white">Mega Auction Completed!</h3>
                <p className="text-sm text-[#9DAEC4] max-w-md mx-auto mt-2 mb-6">
                  All player pools have been auctioned. Review the completed squads or proceed to the tournament fixtures.
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setActiveTab('SQUAD')}
                    className="px-6 py-3 rounded-xl bg-[#258BFF] font-bold text-white uppercase text-xs tracking-wider"
                  >
                    View My Squad
                  </button>
                  <button
                    onClick={() => setActiveTab('MATCHES')}
                    className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 font-bold text-white uppercase text-xs tracking-wider"
                  >
                    Go to Fixtures
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live Bid Timeline & Event Log */}
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            <h3 className="text-xs font-black text-[#9DAEC4] uppercase tracking-wider mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#258BFF]" />
              Live Bid History & Activity
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {bidLog.length === 0 ? (
                <div className="text-xs text-[#9DAEC4]/60 italic py-2">
                  No bids registered on the current player yet.
                </div>
              ) : (
                bidLog.map((bid, i) => {
                  const bidderTeam = franchises.find(f => f.id === bid.teamId);
                  return (
                    <motion.div
                      key={`${bid.teamId}-${bid.amount}-${bid.timestamp}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-2 rounded-xl bg-[#071426]/70 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bidderTeam?.color || '#258BFF' }} />
                        <span className="font-bold text-white">{bidderTeam?.name || 'Franchise'}</span>
                        {bid.teamId === selectedFranchiseId && (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-black">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="font-black text-[#F5B82E]">
                        ₹{(bid.amount / 10000000).toFixed(2)} Cr
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: All Franchises & Squad Tracking (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-4 border border-white/10">
            {/* Tabs for Sidebar */}
            <div className="flex items-center gap-1 p-1 bg-[#071426] rounded-xl mb-4 border border-white/5 text-xs">
              <button
                onClick={() => setSidebarTab('live')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-bold transition-all",
                  sidebarTab === 'live' ? "bg-[#10233D] text-[#F5B82E] shadow-sm" : "text-[#9DAEC4] hover:text-white"
                )}
              >
                Franchises ({franchises.length})
              </button>
              <button
                onClick={() => setSidebarTab('sold')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-bold transition-all",
                  sidebarTab === 'sold' ? "bg-[#10233D] text-[#F5B82E] shadow-sm" : "text-[#9DAEC4] hover:text-white"
                )}
              >
                Sold ({soldPlayersCount})
              </button>
              <button
                onClick={() => setSidebarTab('unsold')}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-bold transition-all",
                  sidebarTab === 'unsold' ? "bg-[#10233D] text-[#F5B82E] shadow-sm" : "text-[#9DAEC4] hover:text-white"
                )}
              >
                Unsold ({unsoldPlayersCount})
              </button>
            </div>

            {/* Content for Franchises Tab */}
            {sidebarTab === 'live' && (
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                {franchises.map(team => {
                  const isUser = team.id === selectedFranchiseId;
                  const isLeading = team.id === auctionLeadingTeamId;
                  const hasPassed = withdrawnTeams.includes(team.id);

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        "p-3 rounded-xl border transition-all relative overflow-hidden",
                        isLeading && "border-[#F5B82E] bg-[#F5B82E]/10 shadow-md",
                        isUser && !isLeading && "border-blue-500/40 bg-blue-950/20",
                        !isLeading && !isUser && "border-white/5 bg-[#071426]/60"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={resolveTeamLogoUrl(team.shortName, team.logo)}
                            alt={team.name}
                            className="w-7 h-7 object-contain"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-white">{team.shortName}</span>
                              {isUser && (
                                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[9px] font-black">
                                  YOUR TEAM
                                </span>
                              )}
                              {hasPassed && (
                                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 text-[9px] font-bold">
                                  PASS
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#9DAEC4] flex items-center gap-2 mt-0.5">
                              <span>Squad: {team.squad.length}/25</span>
                              <span>Overseas: {team.overseasCount}/8</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-[#F5B82E]">
                            ₹{(team.purse / 10000000).toFixed(2)} Cr
                          </div>
                          <div className="text-[9px] text-[#9DAEC4]">Purse</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Content for Sold Players Tab */}
            {sidebarTab === 'sold' && (
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {auctionHistory.filter(h => h.soldTo !== 'UNSOLD').length === 0 ? (
                  <div className="text-xs text-[#9DAEC4] py-8 text-center italic">
                    No players sold yet in this auction.
                  </div>
                ) : (
                  auctionHistory
                    .filter(h => h.soldTo !== 'UNSOLD')
                    .slice()
                    .reverse()
                    .map((h, i) => {
                      const pl = players.find(p => p.id === h.playerId);
                      const buyer = franchises.find(f => f.id === h.soldTo);
                      return (
                        <div
                          key={`${h.playerId}-${i}`}
                          onClick={() => setViewedPlayer(h.playerId)}
                          className="p-2.5 rounded-xl bg-[#071426]/70 border border-white/5 flex items-center justify-between text-xs hover:border-white/20 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getPlayerImage(pl)}
                              alt={pl?.name}
                              className="w-8 h-8 rounded-full object-cover bg-white/5"
                            />
                            <div>
                              <div className="font-black text-white">{pl?.name || 'Player'}</div>
                              <div className="text-[10px] text-[#9DAEC4] flex items-center gap-1">
                                <span>{pl?.role}</span>
                                <span>•</span>
                                <span className="font-bold text-blue-400">{buyer?.shortName}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right font-black text-[#F5B82E]">
                            ₹{(h.price / 10000000).toFixed(2)} Cr
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}

            {/* Content for Unsold Players Tab */}
            {sidebarTab === 'unsold' && (
              <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
                {auctionHistory.filter(h => h.soldTo === 'UNSOLD').length === 0 ? (
                  <div className="text-xs text-[#9DAEC4] py-8 text-center italic">
                    No unsold players yet.
                  </div>
                ) : (
                  auctionHistory
                    .filter(h => h.soldTo === 'UNSOLD')
                    .map((h, i) => {
                      const pl = players.find(p => p.id === h.playerId);
                      return (
                        <div
                          key={`${h.playerId}-${i}`}
                          onClick={() => setViewedPlayer(h.playerId)}
                          className="p-2.5 rounded-xl bg-[#071426]/70 border border-white/5 flex items-center justify-between text-xs hover:border-white/20 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={getPlayerImage(pl)}
                              alt={pl?.name}
                              className="w-8 h-8 rounded-full object-cover bg-white/5"
                            />
                            <div>
                              <div className="font-black text-white">{pl?.name || 'Player'}</div>
                              <div className="text-[10px] text-[#9DAEC4]">{pl?.role}</div>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                            UNSOLD
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
