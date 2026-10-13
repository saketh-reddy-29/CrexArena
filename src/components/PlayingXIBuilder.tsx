import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, User, ArrowLeft, Target, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { calculateEffectiveRating, getPlayerRating } from '../lib/ratingEngine';

export default function PlayingXIBuilder() {
  const { players, selectedSquadIds, selectedFormat, selectedFranchiseId, currentMatchId, setGameState, setPlayingXIIds, setViewedPlayer, getArenaPlayerState, playerSeasonStats } = useGameStore();
  const [playingXI, setPlayingXI] = useState<string[]>([]);

  const squadPlayers = players.filter(p => selectedSquadIds.includes(p.id));

  // Check whether player has played in previous matches
  const getPlayerPlayStatus = (playerId: string) => {
    const activeFormat = selectedFormat || 'T20';
    const playerState = getArenaPlayerState(playerId, activeFormat);
    const seasonStats = playerSeasonStats?.[playerId];
    
    const hasPlayed = Boolean(
      (playerState && playerState.hasRecentMatches && playerState.recentMatchCount > 0 && playerState.recentForm > 0) ||
      (seasonStats && seasonStats.matches > 0) ||
      (playerState && playerState.recentMatches && playerState.recentMatches.length > 0)
    );

    const formValue = playerState?.recentForm || 0;
    return { hasPlayed, formValue };
  };

  // Auto Pick XI optimized for active format
  const autoPickXI = () => {
    const activeFormat = selectedFormat || 'T20';
    const ratePlayer = (p: typeof players[0]) => getPlayerRating(p, activeFormat);
    const pool = [...squadPlayers].sort((a, b) => ratePlayer(b) - ratePlayer(a));

    const keepers = pool.filter(p => p.role === 'Wicketkeeper');
    const batters = pool.filter(p => p.role === 'Batsman');
    const allrounders = pool.filter(p => p.role === 'All-rounder');
    const bowlers = pool.filter(p => p.role === 'Bowler');

    const selected: string[] = [];
    if (keepers[0]) selected.push(keepers[0].id);
    selected.push(...batters.filter(p => !selected.includes(p.id)).slice(0, 4).map(p => p.id));
    selected.push(...allrounders.filter(p => !selected.includes(p.id)).slice(0, 2).map(p => p.id));
    selected.push(...bowlers.filter(p => !selected.includes(p.id)).slice(0, 4).map(p => p.id));

    if (selected.length < 11) {
      for (const p of pool) {
        if (selected.length >= 11) break;
        if (!selected.includes(p.id)) {
          selected.push(p.id);
        }
      }
    }

    setPlayingXI(selected.slice(0, 11));
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Toggle selection
  const togglePlayer = (id: string) => {
    setPlayingXI(prev => {
      if (prev.includes(id)) {
        setToastMessage(null);
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 11) {
        setToastMessage('Playing XI limit reached (11/11). Deselect a player first to swap.');
        setTimeout(() => setToastMessage(null), 3000);
        return prev;
      }
      setToastMessage(null);
      return [...prev, id];
    });
  };

  const xiPlayers = squadPlayers.filter(p => playingXI.includes(p.id));

  const getFormMeter = (form: number) => {
    if (form >= 90) return '🔥🔥🔥🔥🔥';
    if (form >= 75) return '🔥🔥🔥🔥░';
    if (form >= 60) return '🔥🔥🔥░░';
    if (form >= 40) return '🔥🔥░░░';
    return '🔥░░░░';
  };

  const stats = useMemo(() => {
    if (!selectedFormat) return null;

    // Calculate effective ratings for all XI players
    const effPlayers = xiPlayers.map(p => ({
      ...p,
      effRating: calculateEffectiveRating(p, selectedFormat)
    }));

    const counts = {
      Batters: effPlayers.filter(p => p.role === 'Batsman').length,
      Bowlers: effPlayers.filter(p => p.role === 'Bowler').length,
      'All-rounders': effPlayers.filter(p => p.role === 'All-rounder').length,
      Wicketkeepers: effPlayers.filter(p => p.role === 'Wicketkeeper').length,
    };

    let batStr = 0;
    let bowlStr = 0;
    let fieldStr = 0;
    let balance = 100;

    if (effPlayers.length > 0) {
      const topBatters = [...effPlayers].sort((a, b) => b.effRating.batting - a.effRating.batting).slice(0, 7);
      batStr = topBatters.reduce((acc, p) => acc + p.effRating.batting, 0) / (topBatters.length || 1);
      
      const topBowlers = [...effPlayers].sort((a, b) => b.effRating.bowling - a.effRating.bowling).slice(0, 5);
      bowlStr = topBowlers.reduce((acc, p) => acc + p.effRating.bowling, 0) / (topBowlers.length || 1);

      fieldStr = effPlayers.reduce((acc, p) => acc + p.effRating.fielding, 0) / effPlayers.length;
    }

    // Role balancing penalties
    if (counts.Wicketkeepers === 0) balance -= 30;
    if (counts.Wicketkeepers > 1) balance -= 5 * (counts.Wicketkeepers - 1);
    if (counts.Bowlers + counts['All-rounders'] < 5) balance -= 25;
    if (counts.Batters < 4) balance -= 15;

    let overall = (batStr * 0.4) + (bowlStr * 0.4) + (fieldStr * 0.1) + (balance * 0.1);
    if (effPlayers.length === 0) overall = 0;

    return {
      effPlayers,
      batStr: Math.round(batStr),
      bowlStr: Math.round(bowlStr),
      fieldStr: Math.round(fieldStr),
      balance: Math.round(balance),
      overall: Math.round(overall),
      counts
    };
  }, [xiPlayers, selectedFormat]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-15%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setGameState(GameState.ARENA_HUB)}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">{selectedFormat} FORMAT</div>
                      <h1 className="text-lg sm:text-xl font-bold tracking-tight">Build Playing XI</h1>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end mr-1">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">XI Status</span>
                      <span className={cn(
                        "text-lg font-black font-mono",
                        playingXI.length === 11 ? "text-emerald-400" : "text-white"
                      )}>
                        {playingXI.length}/11
                      </span>
                  </div>
                  <button
                    disabled={playingXI.length !== 11}
                    onClick={() => {
                      setPlayingXIIds(playingXI);
                      setGameState(GameState.PRE_MATCH);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-md shadow-blue-600/20"
                  >
                    Lock Playing XI
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
              </div>
          </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:overflow-hidden overflow-y-auto">
        
        {/* Left: Squad List */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-24 lg:pb-0">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-zinc-950/90 py-2 z-10 backdrop-blur-sm gap-2">
            <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
              Your Squad ({squadPlayers.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={autoPickXI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Auto Pick XI
              </button>
              {playingXI.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlayingXI([])}
                  className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {squadPlayers.sort((a, b) => b.rating - a.rating).map(player => {
              const isSelected = playingXI.includes(player.id);
              const effRating = selectedFormat ? calculateEffectiveRating(player, selectedFormat) : { overall: player.rating };
              const { hasPlayed, formValue } = getPlayerPlayStatus(player.id);

              return (
                <div 
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group select-none",
                    isSelected 
                      ? "border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]" 
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center z-10">
                      <Shield className="w-3 h-3 text-white fill-current" />
                    </div>
                  )}

                  <div className="w-12 h-12 shrink-0">
                    <JerseyPlayerImage 
                        player={player} 
                        franchiseId={selectedFranchiseId}
                        className="w-full h-full bg-zinc-800 rounded-lg pointer-events-none"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold truncate leading-tight mb-1 group-hover:text-blue-400 transition-colors">{player.name}</h3>
                    <div className="flex items-center gap-2 text-[10px] font-medium text-white/50 uppercase tracking-wider">
                        <span>{player.role}</span>
                    </div>
                    {hasPlayed && (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-white/50 uppercase tracking-wider mt-1" title={`Form: ${Math.round(formValue)}`}>
                          <span className="text-orange-500 tracking-widest">{getFormMeter(formValue)}</span>
                          <span className="opacity-50">Form</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                       <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-0.5">Rating</span>
                       <span className={cn(
                         "text-lg font-black",
                         effRating.overall > player.rating ? "text-emerald-400" : effRating.overall < player.rating ? "text-red-400" : "text-yellow-500"
                       )}>{effRating.overall}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewedPlayer(player.id);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                      title="View Player Profile"
                    >
                      <User className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: XI Analysis */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 relative z-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-4">
            <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-black tracking-tight">Playing XI Strength</h2>
            </div>

            {stats && (
              <>
                {/* Overall Rating */}
                <div className="bg-zinc-950 rounded-2xl p-6 border border-zinc-800/50 flex flex-col items-center justify-center mb-6">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Effective Overall</span>
                  <span className="text-5xl font-black text-white">{stats.overall}</span>
                </div>

                {/* Sub Stats */}
                <div className="space-y-4 mb-8">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-zinc-400">Batting</span>
                      <span className="text-white">{stats.batStr}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-sm" style={{ width: `${stats.batStr}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-zinc-400">Bowling</span>
                      <span className="text-white">{stats.bowlStr}</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-sm" style={{ width: `${stats.bowlStr}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-zinc-400">Team Balance</span>
                      <span className={cn("font-bold", stats.balance >= 90 ? "text-emerald-400" : stats.balance >= 70 ? "text-yellow-400" : "text-red-400")}>{stats.balance}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-sm", stats.balance >= 90 ? "bg-emerald-500" : stats.balance >= 70 ? "bg-yellow-500" : "bg-red-500")} style={{ width: `${stats.balance}%` }} />
                    </div>
                  </div>
                </div>

                {/* Warnings */}
                {playingXI.length === 11 && stats.balance < 85 && (
                  <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-start gap-3 mb-6">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold mb-1">Sub-optimal Balance</h4>
                      <p className="text-xs opacity-80 leading-relaxed font-medium">
                        Ensure you have exactly 1 Wicketkeeper, at least 5 bowling options (Bowlers + All-rounders), and strong batting depth.
                      </p>
                    </div>
                  </div>
                )}
                {playingXI.length === 11 && stats.balance >= 85 && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-start gap-3 mb-6">
                    <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold mb-1">Perfect Harmony</h4>
                      <p className="text-xs opacity-80 leading-relaxed font-medium">
                        Your playing XI is well balanced for this format and ready to dominate the arena.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              disabled={playingXI.length !== 11}
              onClick={() => {
                 // Save playing XI and proceed to pre-match
                 setPlayingXIIds(playingXI);
                 setGameState(GameState.PRE_MATCH);
              }}
              className="w-full mt-auto flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Lock Playing XI
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Floating XI Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500/90 backdrop-blur-md text-zinc-950 font-bold px-4 py-2 rounded-full shadow-lg text-xs flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sticky Bottom Bar for all viewports */}
      <div className="sticky bottom-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/80 px-4 py-3 sm:px-6 safe-bottom">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-lg font-black font-mono",
              playingXI.length === 11 ? "text-emerald-400" : "text-white"
            )}>
              {playingXI.length}/11
            </span>
            <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
              {playingXI.length === 11 ? 'Playing XI complete! Ready to proceed.' : `Pick ${11 - playingXI.length} more players`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoPickXI}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Auto Pick XI
            </button>
            <button
              disabled={playingXI.length !== 11}
              onClick={() => {
                setPlayingXIIds(playingXI);
                if (currentMatchId) {
                  setGameState(GameState.PRE_MATCH);
                } else {
                  setGameState(GameState.ARENA_HUB);
                }
              }}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Lock Playing XI
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
