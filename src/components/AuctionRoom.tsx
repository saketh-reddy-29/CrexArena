import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Pause, Play, FastForward, Star, Gavel, Users, Trophy, TrendingUp
} from 'lucide-react';
import { useGameStore, GameState, Franchise } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import confetti from 'canvas-confetti';
import { cn } from '../lib/utils';
import { evaluateBid, AuctionState, FranchiseAIState, getBidDelay } from '../lib/auctionAI';
import JerseyPlayerImage from './JerseyPlayerImage';
import { Player } from '../types/common';

const createFranchiseAIState = (): FranchiseAIState => ({
  fatigueLevel: 10,
  lastPurchasePrice: 0,
  consecutivePasses: 0,
});

const auctionStageLabel = (poolIndex: number, total: number) => {
  const ratio = total === 0 ? 0 : poolIndex / total;
  if (ratio < 0.28) return 'EARLY';
  if (ratio < 0.6) return 'MID';
  if (ratio < 0.85) return 'LATE';
  return 'FINAL';
};

export default function AuctionRoom() {
  const { 
    gameState,
    franchises, 
    selectedFranchiseId, 
    soldPlayer, 
    moveToUnsold,
    updatePurse, 
    addToSquad, 
    setGameState,
    clearBids,
    simulateFullAuction,
    auctionHistory,
    bidLog,
    addBid,
    activeTab,
    setActiveTab
  } = useGameStore();
  
  const [currentBid, setCurrentBid] = useState(0);
  const [biddingTeamId, setBiddingTeamId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [auctionPhase, setAuctionPhase] = useState<'idle' | 'bidding' | 'sold' | 'unsold'>('idle');
  const [poolIndex, setPoolIndex] = useState(0);
  const [countdown, setCountdown] = useState(10);
  const [isSimulating, setIsSimulating] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<'live' | 'squads' | 'sold' | 'unsold'>('live');
  const [selectedSquadTeamId, setSelectedSquadTeamId] = useState<string>(selectedFranchiseId || '1');

  const countdownRef = useRef(countdown);
  const franchiseAIStates = useRef<Map<string, FranchiseAIState>>(new Map());
  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    if (franchiseAIStates.current.size === 0) {
      franchises.forEach((franchise) => {
        franchiseAIStates.current.set(franchise.id, createFranchiseAIState());
      });
    }
  }, [franchises]);
  
  // Shuffle pool once on mount so players appear randomly instead of sequentially
  const [shuffledPool] = useState(() => {
    const pool = [...INITIAL_PLAYER_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  });

  const currentPlayer = shuffledPool[poolIndex];
  const selectedFranchise = franchises.find(f => f.id === selectedFranchiseId);
  const biddingTeam = franchises.find(f => f.id === biddingTeamId);
  const auctionStage = auctionStageLabel(poolIndex, shuffledPool.length);
  const auctionState: AuctionState = useMemo(() => ({
    poolIndex,
    totalPlayers: shuffledPool.length,
    auctionHistory,
    remainingPool: shuffledPool.slice(poolIndex + 1),
  }), [poolIndex, shuffledPool, auctionHistory]);

  const startNextPlayer = useCallback(() => {
    if (poolIndex < shuffledPool.length) {
      const player = shuffledPool[poolIndex];
      setCurrentBid(player.basePrice);
      setBiddingTeamId(null);
      setAuctionPhase('bidding');
      setCountdown(10);
      clearBids();
    } else {
      setActiveTab('MATCHES');
    }
  }, [poolIndex, shuffledPool, clearBids, setActiveTab]);

  const handleSold = useCallback(() => {
    if (!currentPlayer) return;

    if (!biddingTeamId) {
      setAuctionPhase('unsold');
      moveToUnsold(currentPlayer.id);
      setTimeout(() => {
        setAuctionPhase('idle');
        setPoolIndex(prev => prev + 1);
      }, 2000);
      return;
    }

    const newState = franchiseAIStates.current.get(biddingTeamId) ?? createFranchiseAIState();
    franchiseAIStates.current.set(biddingTeamId, {
      ...newState,
      fatigueLevel: Math.min(100, newState.fatigueLevel + (currentBid >= 50_000_000 ? 18 : 8)),
      lastPurchasePrice: currentBid,
      consecutivePasses: 0,
      lostWarFor: undefined,
    });

    setAuctionPhase('sold');
    soldPlayer(currentPlayer.id, biddingTeamId, currentBid);
    updatePurse(biddingTeamId, currentBid);
    addToSquad(biddingTeamId, currentPlayer.id);

    if (biddingTeamId === selectedFranchiseId) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#ffffff', selectedFranchise?.color || '#00ff00']
      });
    }

    setTimeout(() => {
      setAuctionPhase('idle');
      setPoolIndex(prev => prev + 1);
    }, 3500);
  }, [biddingTeamId, currentBid, currentPlayer, selectedFranchiseId, selectedFranchise, soldPlayer, updatePurse, addToSquad, moveToUnsold]);

  useEffect(() => {
    if (activeTab !== 'AUCTION') return;
    if (auctionPhase === 'idle' && poolIndex < shuffledPool.length) {
      startNextPlayer();
    }
  }, [auctionPhase, poolIndex, shuffledPool, startNextPlayer, activeTab]);

  useEffect(() => {
    if (activeTab !== 'AUCTION' || auctionPhase !== 'bidding' || isPaused || !currentPlayer) return;

    const activeTeams = franchises.filter((f) => {
      if (f.id === biddingTeamId || f.id === selectedFranchiseId) return false;
      if (f.purse <= currentBid * 1.03 || f.squad.length >= 25) return false;
      if (currentPlayer.nationality === 'Overseas' && f.overseasCount >= 8) return false;

      const state = franchiseAIStates.current.get(f.id) ?? createFranchiseAIState();
      const decision = evaluateBid(currentPlayer, f, currentBid, franchises, auctionState, state);
      return decision.decision === 'BUY' && Math.random() > decision.dropoutProbability;
    });

    if (activeTeams.length === 0) return;

    const teamBids = activeTeams.map((franchise) => {
      const state = franchiseAIStates.current.get(franchise.id) ?? createFranchiseAIState();
      const decision = evaluateBid(currentPlayer, franchise, currentBid, franchises, auctionState, state);
      return { bidder: franchise, decision, delay: getBidDelay(decision) };
    });

    teamBids.sort((a, b) => a.delay - b.delay);
    const fastestBid = teamBids[0];

    const bidTimer = setTimeout(() => {
      if (countdownRef.current <= 2) return;
      const bidder = fastestBid.bidder;
      const nextBid = Math.min(fastestBid.decision.maximumBid, currentBid + (currentBid < 50_000_000 ? 2_500_000 : 5_000_000));
      if (bidder.purse >= nextBid) {
        setCurrentBid(nextBid);
        setBiddingTeamId(bidder.id);
        setCountdown(8);
        addBid({ teamId: bidder.id, amount: nextBid, timestamp: Date.now() });

        const state = franchiseAIStates.current.get(bidder.id) ?? createFranchiseAIState();
        franchiseAIStates.current.set(bidder.id, {
          ...state,
          fatigueLevel: Math.max(0, state.fatigueLevel + 4),
          lastPurchasePrice: nextBid,
          consecutivePasses: 0,
        });
      }
    }, fastestBid.delay);

    return () => clearTimeout(bidTimer);
  }, [auctionPhase, isPaused, franchises, currentBid, biddingTeamId, selectedFranchiseId, currentPlayer, addBid, activeTab, auctionState]);

  useEffect(() => {
    if (activeTab !== 'AUCTION' || auctionPhase !== 'bidding' || isPaused) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [auctionPhase, isPaused, activeTab]);

  useEffect(() => {
    if (activeTab !== 'AUCTION') return;
    if (countdown === 0 && auctionPhase === 'bidding' && !isPaused) {
      handleSold();
    }
  }, [countdown, auctionPhase, isPaused, handleSold, activeTab]);

  const handleUserBid = (increment?: number) => {
    if (!selectedFranchise || isPaused || biddingTeamId === selectedFranchiseId) return;
    const inc = increment ?? (currentBid < 50000000 ? 2500000 : 5000000);
    const newBid = currentBid + inc;
    if (selectedFranchise.purse < newBid) return;
    setCurrentBid(newBid);
    setBiddingTeamId(selectedFranchiseId);
    setCountdown(10);
    addBid({ teamId: selectedFranchiseId, amount: newBid, timestamp: Date.now() });
  };

  const handleSkipAuction = () => {
    setIsSimulating(true);
    setTimeout(() => {
      simulateFullAuction(shuffledPool.slice(poolIndex));
    }, 800);
  };

  const formatPrice = (price: number) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(1)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(0)} L`;
    return `₹${price}`;
  };

  const progress = ((poolIndex) / shuffledPool.length) * 100;
  const isLeading = biddingTeamId === selectedFranchiseId;
  const soldRecord = auctionHistory.find(h => h.playerId === currentPlayer?.id);
  const currentJerseyFranchiseId = soldRecord && soldRecord.soldTo !== 'UNSOLD' ? soldRecord.soldTo : biddingTeamId;

  if (isSimulating) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-white/10 border-t-white rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-black text-white mb-2">Simulating Auction</h2>
          <p className="text-zinc-500 text-sm">AI franchises are bidding on all players...</p>
        </div>
      </div>
    );
  }

  const soldPlayers = useMemo(() => {
    return auctionHistory
      .filter(h => h.soldTo !== 'UNSOLD')
      .map(h => {
        const p = INITIAL_PLAYER_POOL.find(x => x.id === h.playerId);
        const team = franchises.find(f => f.id === h.soldTo);
        return p ? { ...p, team, price: h.price } : null;
      })
      .filter(Boolean) as (Player & { team?: Franchise; price: number })[];
  }, [auctionHistory, franchises]);

  const unsoldPlayers = useMemo(() => {
    return auctionHistory
      .filter(h => h.soldTo === 'UNSOLD')
      .map(h => {
        const p = INITIAL_PLAYER_POOL.find(x => x.id === h.playerId);
        return p || null;
      })
      .filter(Boolean) as Player[];
  }, [auctionHistory]);

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans flex flex-col relative">
      
      {/* ── TOP PROGRESS BAR ── */}
      <div className="h-0.5 bg-zinc-900 w-full">
        <motion.div 
          animate={{ width: `${progress}%` }}
          className="h-full bg-gradient-to-r from-amber-500 to-orange-400"
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-800/60 bg-[#080808]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Live Auction</span>
          </div>
          <span className="text-zinc-700">|</span>
          <span className="text-[11px] font-bold text-zinc-300">{poolIndex + 1} <span className="text-zinc-600">/ {shuffledPool.length}</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-center">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Purse</div>
              <div className="text-xs font-bold text-white">{formatPrice(selectedFranchise?.purse || 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] text-zinc-600 uppercase tracking-wider">Squad</div>
              <div className="text-xs font-bold text-white">{selectedFranchise?.squad.length || 0}<span className="text-zinc-600">/25</span></div>
            </div>
          </div>
          <button 
            onClick={handleSkipAuction}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold uppercase tracking-wider transition-all text-zinc-300"
          >
            <FastForward className="w-3 h-3" />
            <span className="hidden sm:inline">Skip All</span>
          </button>
        </div>
      </header>

      {/* ── AUTO SCROLLER NEWS TICKER ── */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 35s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        @keyframes shine {
          0% { left: -100%; }
          50% { left: 200%; }
          100% { left: 200%; }
        }
        .animate-shine {
          position: absolute;
          animation: shine 4s ease-in-out infinite;
        }
        @keyframes sold-stamp {
          0% { transform: scale(2.5) rotate(-15deg); opacity: 0; }
          60% { transform: scale(0.95) rotate(-5deg); opacity: 1; }
          80% { transform: scale(1.05) rotate(-5deg); }
          100% { transform: scale(1) rotate(-5deg); opacity: 1; }
        }
        .sold-stamp {
          animation: sold-stamp 0.55s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes card-in {
          0% { transform: translateY(30px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .card-in {
          animation: card-in 0.45s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px 4px var(--team-color, #fff3), 0 20px 60px rgba(0,0,0,0.8); }
          50% { box-shadow: 0 0 40px 12px var(--team-color, #fff4), 0 20px 60px rgba(0,0,0,0.8); }
        }
        .card-glow {
          animation: glow-pulse 2s ease-in-out infinite;
        }
      `}</style>
      
      {(() => {
        const updates = auctionHistory.map(h => {
          const p = INITIAL_PLAYER_POOL.find(x => x.id === h.playerId);
          if (h.soldTo === 'UNSOLD') {
            return `⚠️ ${p?.name || 'Player'} remains UNSOLD`;
          } else {
            const team = franchises.find(f => f.id === h.soldTo);
            return `🔥 ${team?.shortName || 'Team'} BOUGHT ${p?.name || 'Player'} FOR ${formatPrice(h.price)}`;
          }
        });

        const defaultMsg = "🔥 WELCOME TO THE CRICARENA Mega Auction Live Room! Teams are ready with 120 Cr purses. Stay tuned for live updates...";
        const tickerContent = updates.length > 0 ? updates.reverse() : [defaultMsg];
        
        return (
          <div className="w-full bg-[#0a0a0a] border-b border-zinc-800/80 py-2 overflow-hidden relative flex items-center z-30 select-none">
            <div className="animate-marquee gap-16 pr-16">
              {tickerContent.map((text, i) => (
                <span key={i} className="text-[10px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {text}
                </span>
              ))}
              {/* Duplicate for seamless infinite loop */}
              {tickerContent.map((text, i) => (
                <span key={`dup-${i}`} className="text-[10px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  {text}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── MAIN LAYOUT ── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

        {/* ── LEFT: PLAYER CARD ── */}
        <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-zinc-800/50 overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentPlayer && (
              <motion.div
                key={currentPlayer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35 }}
                className="p-4 sm:p-5"
              >
                {/* Jersey-style player card */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-800 to-zinc-950 border border-zinc-700/40 shadow-2xl group">
                  {/* Team color top accent */}
                  <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${selectedFranchise?.color || '#fff'}40, transparent)` }} />
                  
                  {/* Player image */}
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent z-10" />
                    <JerseyPlayerImage 
                      player={currentPlayer}
                      franchiseId={currentJerseyFranchiseId}
                      className="w-full h-full"
                    />
                    {/* Role badge */}
                    <div className="absolute top-3 right-3 z-20">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-black/60 backdrop-blur text-white border border-white/10 uppercase tracking-wide">{currentPlayer.role}</span>
                    </div>
                    {/* Rating badge */}
                    <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/90 backdrop-blur">
                      <Star className="w-2.5 h-2.5 text-black fill-black" />
                      <span className="text-[11px] font-black text-black">{currentPlayer.rating}</span>
                    </div>
                    {/* Name overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                      <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-0.5">{currentPlayer.nationality === 'Indian' ? '🇮🇳 India' : '🌐 Overseas'}</p>
                      <h2 className="text-2xl sm:text-3xl font-black leading-none tracking-tight">{currentPlayer.name}</h2>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Base Price</div>
                        <div className="text-base font-black text-emerald-400">{formatPrice(currentPlayer.basePrice)}</div>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Rating</div>
                        <div className="text-base font-black text-amber-400">{currentPlayer.rating}</div>
                      </div>
                    </div>

                    {/* Skill bars */}
                    <div className="space-y-2.5">
                      {[
                        { label: 'BAT', value: currentPlayer.stats.batting, color: '#38bdf8' },
                        { label: 'BOWL', value: currentPlayer.stats.bowling, color: '#fb7185' },
                        { label: 'FIELD', value: currentPlayer.stats.fielding, color: '#4ade80' },
                      ].map(s => (
                        <div key={s.label}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{s.label}</span>
                            <span className="text-[10px] font-black text-zinc-300">{s.value}</span>
                          </div>
                          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${s.value}%` }}
                              transition={{ duration: 0.6, delay: 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: s.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Franchise Decision Card */}
                {(() => {
                  const aiDecision = selectedFranchise && currentPlayer
                    ? evaluateBid(currentPlayer, selectedFranchise, currentBid, franchises, auctionState, franchiseAIStates.current.get(selectedFranchise.id) ?? createFranchiseAIState())
                    : null;

                  if (!aiDecision) return null;

                  return (
                    <div className="mt-4 p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800/85 backdrop-blur-xl shadow-2xl space-y-3.5">
                      <div className="flex items-center justify-between border-b border-zinc-800/70 pb-2">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Franchise AI</span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                          aiDecision.decision === 'BUY'
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border border-red-500/30"
                        )}>
                          {aiDecision.decision}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                        <div>
                          <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest block mb-0.5">Confidence</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${aiDecision.confidence}%` }} />
                            </div>
                            <span className="font-bold text-[9px] text-zinc-300 w-4 text-right">{aiDecision.confidence}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest block mb-0.5">Heat</span>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${aiDecision.heatScore}%` }} />
                            </div>
                            <span className="font-bold text-[9px] text-zinc-300 w-4 text-right">{aiDecision.heatScore}</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/40">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Dropout Risk</span>
                          <span className="text-xs font-black text-cyan-400">{aiDecision.dropoutProbability.toFixed(2)}</span>
                        </div>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full" style={{ width: `${Math.round(aiDecision.dropoutProbability * 100)}%` }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center pt-1">
                        <div className="bg-zinc-950/30 border border-zinc-800/60 p-2 rounded-xl">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Recommended Bid</span>
                          <span className="text-xs font-black text-white">{formatPrice(aiDecision.recommendedBid)}</span>
                        </div>
                        <div className="bg-zinc-950/30 border border-zinc-800/60 p-2 rounded-xl">
                          <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest block mb-0.5">Maximum Bid</span>
                          <span className="text-xs font-black text-emerald-400">{formatPrice(aiDecision.maximumBid)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] bg-zinc-950/30 p-2 rounded-xl border border-zinc-800/50">
                        <span className="text-zinc-500 font-bold uppercase tracking-widest">Bid Aggression</span>
                        <span className={cn(
                          "font-black px-2 py-0.5 rounded text-[8px] uppercase",
                          aiDecision.aggression === 'Extreme' && "text-red-400 bg-red-500/10 border border-red-500/20",
                          aiDecision.aggression === 'High' && "text-orange-400 bg-orange-500/10 border border-orange-500/20",
                          aiDecision.aggression === 'Medium' && "text-amber-400 bg-amber-500/10 border border-amber-500/20",
                          aiDecision.aggression === 'Low' && "text-zinc-400 bg-zinc-800/20 border border-zinc-700/20"
                        )}>
                          {aiDecision.aggression}
                        </span>
                      </div>

                      <div className="text-[9px] text-zinc-400 rounded-xl border border-zinc-800/50 bg-zinc-950/30 p-2 space-y-1">
                        {aiDecision.rationale.map((line, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── CENTER: BIDDING HUB ── */}
        <div className="lg:col-span-6 flex flex-col border-b lg:border-b-0 lg:border-r border-zinc-800/50">
          
          {/* Phase indicator & bid display */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5">
            
            {/* Sold/Unsold overlay */}
            <AnimatePresence>
              {(auctionPhase === 'sold' || auctionPhase === 'unsold') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-xl"
                >
<motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                    className="text-center flex flex-col items-center gap-4"
                  >
                  {auctionPhase === 'sold' ? (
                    <div className="flex-1 w-full max-w-[480px] flex items-center justify-center mx-auto">
                        <div 
                          className="w-full bg-white rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-zinc-200 relative flex flex-col"
                        >
                          {/* TOP: Image Area */}
                          <div
                            className="relative w-full h-[240px] flex-shrink-0"
                            style={{
                              background: `radial-gradient(circle at center, ${biddingTeam?.color || '#eab308'}30 0%, transparent 70%), #fafafa`,
                            }}
                          >
                            <JerseyPlayerImage
                              player={currentPlayer}
                              franchiseId={biddingTeamId}
                              className="w-full h-full object-contain"
                              imageClassName="w-full h-full object-contain"
                            />
                            
                            {/* Gradient to blend image bottom */}
                            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent z-10" />

                            {/* Red Rubber SOLD Stamp */}
                            <div className="absolute top-4 right-4 z-20 origin-center rotate-[15deg]">
                              <div className="w-24 h-24 rounded-full border-[5px] border-[#dc2626] flex flex-col items-center justify-center text-[#dc2626] opacity-90 shadow-sm bg-white/20 backdrop-blur-sm">
                                <div className="text-[12px] tracking-widest font-black -mb-1 mt-1">★★★</div>
                                <span className="text-3xl font-black uppercase tracking-tighter leading-none" style={{ transform: 'scaleY(1.2)' }}>
                                  Sold
                                </span>
                                <div className="text-[12px] tracking-widest font-black mt-1">★★★</div>
                              </div>
                            </div>

                            {/* Floating Badges */}
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center translate-y-1/2 z-30">
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-200 shadow-sm">
                                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                  <span className="text-[10px] font-black text-zinc-900">{currentPlayer.rating}</span>
                                </div>
                                <div className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 shadow-sm flex items-center gap-1">
                                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">IN</span>
                                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">
                                    {currentPlayer.nationality === 'Indian' ? 'IND' : 'OVS'}
                                  </span>
                                </div>
                                <div className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 shadow-sm">
                                  <span className="text-[9px] font-bold text-slate-800 uppercase tracking-widest">
                                    {currentPlayer.role}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* BOTTOM: Info Panel */}
                          <div className="bg-white px-5 pb-5 pt-7 flex-1 flex flex-col gap-3.5 z-20">
                            
                            {/* Name */}
                            <div className="text-center">
                              <h2 className="text-3xl font-black text-[#0f172a] tracking-tight leading-none">
                                {currentPlayer.name}
                              </h2>
                            </div>

                            {/* Acquired By Divider */}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px bg-zinc-200" />
                              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Acquired By</span>
                              <div className="flex-1 h-px bg-zinc-200" />
                            </div>

                            {/* Team Box */}
                            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100">
                              {biddingTeam?.logo && (
                                <img src={biddingTeam.logo} alt={biddingTeam.name} className="w-8 h-8 object-contain drop-shadow-sm" />
                              )}
                              <span className="text-base font-black tracking-tight text-slate-900">
                                {biddingTeam?.name}
                              </span>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { label: 'BAT', value: currentPlayer.stats.batting, color: '#2563eb' },
                                { label: 'BOWL', value: currentPlayer.stats.bowling, color: '#db2777' },
                                { label: 'FIELD', value: currentPlayer.stats.fielding, color: '#16a34a' },
                              ].map(s => (
                                <div key={s.label} className="flex flex-col gap-1 bg-white p-2.5 rounded-xl border border-zinc-200 shadow-sm">
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                    <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">{s.label}</span>
                                  </div>
                                  <div className="flex justify-center my-0.5">
                                    <span className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</span>
                                  </div>
                                  <div className="h-1 bg-zinc-100 rounded-full overflow-hidden w-full">
                                    <div 
                                      className="h-full rounded-full transition-all duration-1000 ease-out" 
                                      style={{ width: `${s.value}%`, backgroundColor: s.color }} 
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Final Price */}
                            <div className="pt-3 border-t border-zinc-200 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-0.5">Final Price</span>
                                <span className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                                  {formatPrice(currentBid)}
                                </span>
                              </div>
                              <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm border-2"
                                style={{ 
                                  backgroundColor: '#eab308',
                                  borderColor: '#ca8a04',
                                  color: '#000000'
                                }}
                              >
                                <Trophy className="w-6 h-6" strokeWidth={2.5} />
                              </div>
                            </div>

                          </div>
                        </div>
                      </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-32 h-40 rounded-2xl overflow-hidden border-2 border-zinc-700 opacity-50 grayscale">
                        <JerseyPlayerImage
                          player={currentPlayer}
                          franchiseId={null}
                          className="w-full h-full bg-zinc-900"
                          imageClassName="w-full h-full"
                        />
                      </div>
                      <div className="text-5xl sm:text-7xl font-black text-zinc-600 uppercase tracking-tighter" style={{ WebkitTextStroke: '2px #52525b' }}>UNSOLD</div>
                    </div>
                  )}
                </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Countdown ring */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#1c1c1c" strokeWidth="6" />
                <motion.circle
                  cx="50" cy="50" r="44"
                  fill="none"
                  stroke={countdown < 4 ? '#ef4444' : '#ffffff'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / 10)}`}
                  transition={{ duration: 0.9, ease: 'linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn("text-4xl sm:text-5xl font-black tabular-nums", countdown < 4 ? 'text-red-400' : 'text-white')}>{countdown}</span>
                <span className="text-[9px] text-zinc-600 uppercase tracking-widest">sec</span>
              </div>
            </div>

            {/* Current bid */}
            <div className="text-center">
              <div className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Current Bid</div>
              <motion.div
                key={currentBid}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-4xl sm:text-6xl font-black tracking-tight text-white"
              >
                {formatPrice(currentBid)}
              </motion.div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Heat {Math.min(99, Math.round(currentBid / Math.max(1, currentPlayer.basePrice) * 18 + auctionState.auctionHistory.length * 2))}
              </div>
            </div>

            {/* Leading team */}
            <AnimatePresence mode="wait">
              {biddingTeam ? (
                <motion.div
                  key={biddingTeam.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-bold",
                    isLeading 
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200"
                  )}
                >

                  {biddingTeam.name}
                  {isLeading && <span className="text-[10px] font-black text-emerald-500 ml-1">● YOU'RE LEADING</span>}
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-zinc-600 font-bold"
                >
                  No bids yet — be the first!
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bid buttons */}
            <div className="w-full max-w-sm space-y-2">
              {/* Quick bid increments */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: currentBid < 50000000 ? '+25L' : '+50L', inc: currentBid < 50000000 ? 2500000 : 5000000 },
                  { label: '+1 Cr', inc: 10000000 },
                  { label: '+2 Cr', inc: 20000000 },
                  { label: '+5 Cr', inc: 50000000 },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => handleUserBid(btn.inc)}
                    disabled={isPaused || isLeading || (selectedFranchise?.purse || 0) < currentBid + btn.inc}
                    className="py-2 px-1 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* Main BID button */}
              <button
                onClick={() => handleUserBid()}
                disabled={isPaused || isLeading || !selectedFranchise}
                className={cn(
                  "w-full py-4 rounded-xl font-black text-base tracking-wide uppercase transition-all active:scale-95",
                  isLeading
                    ? "bg-emerald-900/40 border border-emerald-700 text-emerald-500 cursor-not-allowed"
                    : "bg-white text-zinc-950 hover:bg-zinc-100 shadow-lg shadow-white/10"
                )}
              >
                {isLeading 
                  ? '✓ You\'re Leading' 
                  : `Bid ${formatPrice(currentBid + (currentBid < 50000000 ? 2500000 : 5000000))}`
                }
              </button>

              {/* Controls */}
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPaused(p => !p)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider border transition-all",
                    isPaused 
                      ? "bg-zinc-200 text-zinc-900 border-zinc-300"
                      : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={() => setAuctionPhase('unsold')}
                  className="flex-1 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-600 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-400 transition-all"
                >
                  Pass Player
                </button>
              </div>
            </div>
          </div>

          {/* Bid History */}
          <div className="border-t border-zinc-800/60 p-4 max-h-36 overflow-y-auto">
            <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mb-2">Bid History</div>
            <div className="space-y-1.5">
              {bidLog.length === 0 ? (
                <div className="text-[10px] text-zinc-700 text-center py-2">Awaiting first bid...</div>
              ) : (
                bidLog.slice().reverse().slice(0, 6).map((bid, i) => {
                  const t = franchises.find(f => f.id === bid.teamId);
                  const isUser = bid.teamId === selectedFranchiseId;
                  return (
                    <div key={i} className={cn("flex items-center justify-between text-xs px-2 py-1 rounded-lg", isUser ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-900/40')}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t?.color || '#888' }} />
                        <span className={cn("font-semibold", isUser ? 'text-emerald-400' : 'text-zinc-400')}>{t?.shortName}{isUser && ' (You)'}</span>
                      </div>
                      <span className={cn("font-black tabular-nums", isUser ? 'text-emerald-300' : 'text-white')}>{formatPrice(bid.amount)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
                {/* ── RIGHT: SIDEBAR TABS ── */}
        <div className="lg:col-span-3 flex flex-col bg-[#080808] border-l border-zinc-800/40 h-[calc(100vh-80px)]">
          {/* Tab Selection */}
          <div className="grid grid-cols-4 border-b border-zinc-800/60 bg-[#060606] shrink-0">
            {[
              { id: 'live', label: 'Live' },
              { id: 'squads', label: 'Squads' },
              { id: 'sold', label: 'Sold' },
              { id: 'unsold', label: 'Unsold' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id as any)}
                className={cn(
                  "py-3 text-[9px] font-black uppercase tracking-wider text-center border-b-2 transition-all",
                  sidebarTab === tab.id
                    ? "text-white border-white bg-zinc-900/30"
                    : "text-zinc-500 border-transparent hover:text-zinc-350 hover:bg-zinc-900/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'live' && (
              <div className="flex flex-col gap-4 p-4">
                {/* Next up */}
                <div>
                  <div className="text-[9px] font-bold text-zinc-650 uppercase tracking-widest mb-3">Coming Up</div>
                  <div className="space-y-2">
                    {shuffledPool.slice(poolIndex + 1, poolIndex + 5).map((player, idx) => {
                      const hist = auctionHistory.find(h => h.playerId === player.id);
                      const histFranchise = franchises.find(f => f.id === hist?.soldTo);
                      return (
                        <div key={player.id} className="flex items-center gap-2.5">
                          <span className="text-[9px] text-zinc-700 w-3 font-bold">{idx + 1}</span>
                          <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-zinc-855 shrink-0 border border-zinc-800/40">
                            <JerseyPlayerImage 
                              player={player}
                              franchiseId={histFranchise?.id}
                              className="w-full h-full animate-[fade_0.3s_ease]"
                              imageClassName="w-full h-full"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold text-zinc-350 truncate">{player.name}</div>
                            <div className="text-[9px] text-zinc-600">{player.role} · {formatPrice(player.basePrice)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Purses */}
                <div className="border-t border-zinc-800/50 pt-4">
                  <div className="text-[9px] font-bold text-zinc-650 uppercase tracking-widest mb-3">Purse Remaining</div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                    {[...franchises].sort((a, b) => b.purse - a.purse).map(team => (
                      <div key={team.id} className={cn("flex items-center gap-2.5 px-2 py-1 rounded-lg text-zinc-400", team.id === selectedFranchiseId && "bg-zinc-900 border border-zinc-850")}>
                        <span className="text-[10px] font-bold flex-1 truncate">{team.name}</span>
                        <span className={cn("text-[10px] font-black", team.id === selectedFranchiseId ? "text-white" : "text-zinc-550")}>{formatPrice(team.purse)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Your squad */}
                <div className="border-t border-zinc-800/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[9px] font-bold text-zinc-650 uppercase tracking-widest">Your Squad</div>
                    <span className="text-[10px] font-black text-white">{selectedFranchise?.squad.length || 0}<span className="text-zinc-650">/25</span></span>
                  </div>
                  {(selectedFranchise?.squad.length || 0) === 0 ? (
                    <div className="text-center py-5 rounded-xl border border-dashed border-zinc-850 text-[10px] text-zinc-700 font-bold">
                      No players yet
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-1 mb-3">
                      {selectedFranchise?.squad.map(id => {
                        const p = INITIAL_PLAYER_POOL.find(x => x.id === id);
                        return (
                          <div key={id} className="aspect-square rounded-lg overflow-hidden bg-zinc-900 border border-zinc-850" title={p?.name}>
                            <JerseyPlayerImage 
                              player={p || null}
                              franchiseId={selectedFranchise?.id}
                              className="w-full h-full bg-zinc-850"
                              imageClassName="w-full h-full opacity-80 hover:opacity-100 transition-opacity"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button 
                    onClick={() => setGameState(GameState.ARENA_HUB)}
                    className="w-full py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-450 hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    View Planner <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {sidebarTab === 'squads' && (
              <div className="p-4 flex flex-col gap-4">
                <div>
                  <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest block mb-2">Select Franchise</label>
                  <select
                    value={selectedSquadTeamId}
                    onChange={(e) => setSelectedSquadTeamId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-zinc-700"
                  >
                    {franchises.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const team = franchises.find(f => f.id === selectedSquadTeamId);
                  if (!team) return null;
                  const teamSquad = team.squad.map(id => INITIAL_PLAYER_POOL.find(p => p.id === id)).filter(Boolean);
                  
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="bg-zinc-900/50 border border-zinc-850/80 rounded-xl p-3 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black" style={{ color: team.color }}>{team.name}</span>
                          <span className="text-[9px] font-bold text-zinc-500" style={{ color: team.color }}>Strategy: {team.strategy}</span>
                        </div>
                        <div className="flex justify-between items-center mt-2 text-xs border-t border-zinc-800/40 pt-2 text-zinc-400">
                          <span>Purse Left: <strong className="text-white">{formatPrice(team.purse)}</strong></span>
                          <span>Squad: <strong className="text-white">{team.squad.length}/25</strong></span>
                        </div>
                        <div className="text-[9px] text-zinc-500 mt-1">Overseas Players: {team.overseasCount}/8</div>
                      </div>

                      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                        {teamSquad.length === 0 ? (
                          <div className="text-center py-8 text-[10px] text-zinc-700 font-bold border border-dashed border-zinc-850 rounded-xl">
                            Squad is currently empty
                          </div>
                        ) : (
                          teamSquad.map(player => (
                            <div key={player.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-850/60">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-850 shrink-0">
                                  <JerseyPlayerImage player={player} franchiseId={team.id} className="w-full h-full" imageClassName="w-full h-full" />
                                </div>
                                <div>
                                  <div className="text-[10px] font-bold text-zinc-300">{player.name}</div>
                                  <div className="text-[8px] text-zinc-500">{player.role} · ★{player.rating}</div>
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-emerald-400">
                                {(() => {
                                  const historyItem = auctionHistory.find(h => h.playerId === player.id);
                                  return historyItem && historyItem.price > 0 ? formatPrice(historyItem.price) : 'Retained';
                                })()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {sidebarTab === 'sold' && (
              <div className="p-4 space-y-3">
                <div className="text-[9px] font-bold text-zinc-650 uppercase tracking-widest">Sold Players ({soldPlayers.length})</div>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {soldPlayers.length === 0 ? (
                    <div className="text-center py-8 text-[10px] text-zinc-700 font-bold border border-dashed border-zinc-855 rounded-xl">
                      No players sold yet
                    </div>
                  ) : (
                    soldPlayers.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/40 border border-zinc-850/60">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-850 shrink-0 border border-zinc-800/40">
                            <JerseyPlayerImage player={p} franchiseId={p.team?.id} className="w-full h-full" imageClassName="w-full h-full" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-zinc-200">{p.name}</div>
                            <div className="text-[8px] text-zinc-500">Bought by <strong style={{ color: p.team?.color }}>{p.team?.shortName}</strong></div>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-400">{formatPrice(p.price)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {sidebarTab === 'unsold' && (
              <div className="p-4 space-y-3">
                <div className="text-[9px] font-bold text-zinc-650 uppercase tracking-widest">Unsold Players ({unsoldPlayers.length})</div>
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {unsoldPlayers.length === 0 ? (
                    <div className="text-center py-8 text-[10px] text-zinc-700 font-bold border border-dashed border-zinc-850 rounded-xl">
                      No unsold players
                    </div>
                  ) : (
                    unsoldPlayers.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-900/30 border border-zinc-850/40">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-900 shrink-0 grayscale border border-zinc-800/20">
                            <JerseyPlayerImage player={p} franchiseId={null} className="w-full h-full bg-zinc-900" imageClassName="w-full h-full" />
                          </div>
                          <div>
                            <div className="text-[10px] font-bold text-zinc-450">{p.name}</div>
                            <div className="text-[8px] text-zinc-500">{p.role} · Base: {formatPrice(p.basePrice)}</div>
                          </div>
                        </div>
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">Unsold</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
