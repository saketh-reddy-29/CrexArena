import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, User, ArrowLeft, Target, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { calculateEffectiveRating, getPlayerRating } from '../lib/ratingEngine';
import GlobalNavBar from './common/GlobalNavBar';

export default function PlayingXIBuilder() {
  const { 
    players, 
    selectedSquadIds, 
    playingXIIds,
    selectedFormat, 
    selectedFranchiseId, 
    currentMatchId, 
    setGameState, 
    setPlayingXIIds, 
    setViewedPlayer, 
    getArenaPlayerState, 
    playerSeasonStats 
  } = useGameStore();

  const [playingXI, setPlayingXI] = useState<string[]>(() => {
    return playingXIIds && playingXIIds.length > 0 ? playingXIIds : [];
  });

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
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex flex-col font-sans relative overflow-hidden">
      
      {/* Global Navigation Bar */}
      <GlobalNavBar />

      {/* Header */}
      <header className="sticky top-14 z-30 bg-white border-b border-slate-200/90 shadow-2xs px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setGameState(GameState.ARENA_HUB)}
              className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider inline-block">
                {selectedFormat} FORMAT
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                Match-Day Playing XI Selection
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lineup Status</span>
              <span className={cn(
                "text-base font-black tabular-nums",
                playingXI.length === 11 ? "text-emerald-600" : "text-slate-800"
              )}>
                {playingXI.length}/11 Picked
              </span>
            </div>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-40 disabled:pointer-events-none shadow-xs active:scale-95"
            >
              <span>Confirm Playing XI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:overflow-hidden overflow-y-auto">
        
        {/* Left: Squad Selection Grid */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-24 lg:pb-0">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-[#f4f6f9]/90 py-2 z-10 backdrop-blur-xs gap-2">
            <h2 className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Eligible Squad Pool ({squadPlayers.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={autoPickXI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                Auto-Pick Optimal XI
              </button>
              {playingXI.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlayingXI([])}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
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
                    "flex items-center gap-3.5 p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none",
                    isSelected 
                      ? "border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20" 
                      : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center z-10 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <JerseyPlayerImage 
                      player={player} 
                      franchiseId={selectedFranchiseId}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black text-slate-900 truncate leading-tight mb-0.5">
                      {player.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      <span>{player.role}</span>
                      <span>•</span>
                      <span>{player.battingStyle || 'Right hand'}</span>
                    </div>
                    {hasPlayed && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 mt-0.5" title={`Form: ${Math.round(formValue)}`}>
                        <span className="text-amber-500 tracking-widest">{getFormMeter(formValue)}</span>
                        <span className="text-[9px] uppercase font-bold text-slate-400">Form</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 uppercase font-bold block mb-0.5">Rating</span>
                      <span className={cn(
                        "text-base font-black tabular-nums",
                        effRating.overall > player.rating ? "text-emerald-700" : effRating.overall < player.rating ? "text-rose-600" : "text-amber-600"
                      )}>
                        {effRating.overall}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewedPlayer(player.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
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

        {/* Right: Playing XI Balance & Strength Card */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 relative z-20">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs sticky top-4 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-black tracking-tight text-slate-900 uppercase">Playing XI Analysis</h2>
              </div>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                playingXI.length === 11 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              )}>
                {playingXI.length === 11 ? 'Ready' : `${11 - playingXI.length} Needed`}
              </span>
            </div>

            {stats && (
              <>
                {/* Overall Rating Box */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-0.5">Team Rating Index</span>
                  <span className="text-4xl font-black text-slate-950 tabular-nums">{stats.overall}</span>
                  <span className="text-[10px] text-slate-400 mt-1">Format-adjusted tactical strength</span>
                </div>

                {/* Sub-bars: Batting, Bowling, Balance */}
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-slate-500">Batting Depth</span>
                      <span className="text-slate-900 tabular-nums">{stats.batStr}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${stats.batStr}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-slate-500">Bowling Attack</span>
                      <span className="text-slate-900 tabular-nums">{stats.bowlStr}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full" style={{ width: `${stats.bowlStr}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-slate-500">Role Harmony</span>
                      <span className={cn("font-black tabular-nums", stats.balance >= 90 ? "text-emerald-700" : stats.balance >= 70 ? "text-amber-600" : "text-rose-600")}>
                        {stats.balance}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", stats.balance >= 90 ? "bg-emerald-500" : stats.balance >= 70 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${stats.balance}%` }} />
                    </div>
                  </div>
                </div>

                {/* Composition Chips */}
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Batters</span>
                    <span className="font-bold text-slate-900">{stats.counts.Batters}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Bowlers</span>
                    <span className="font-bold text-slate-900">{stats.counts.Bowlers}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">All-Rounders</span>
                    <span className="font-bold text-slate-900">{stats.counts['All-rounders']}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Keepers</span>
                    <span className="font-bold text-slate-900">{stats.counts.Wicketkeepers}</span>
                  </div>
                </div>

                {/* Advice / Balance alerts */}
                {playingXI.length === 11 && stats.balance < 85 && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black">Lineup Advisory</h4>
                      <p className="text-[11px] text-amber-800 leading-snug mt-0.5">
                        Ensure you have at least 1 Wicketkeeper and at least 5 bowling options.
                      </p>
                    </div>
                  </div>
                )}
                {playingXI.length === 11 && stats.balance >= 85 && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black">Well Balanced Lineup</h4>
                      <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                        Your playing XI satisfies all role constraints and is ready to compete.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-xs"
            >
              <span>Lock Playing XI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white font-bold px-4 py-2 rounded-full shadow-lg text-xs flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 sm:px-6 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-base font-black tabular-nums",
              playingXI.length === 11 ? "text-emerald-700" : "text-slate-900"
            )}>
              {playingXI.length}/11 Selected
            </span>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              {playingXI.length === 11 ? 'Playing XI locked and ready!' : `Pick ${11 - playingXI.length} more players to complete lineup`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={autoPickXI}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              Auto Pick
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
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wide transition-all disabled:opacity-40 shadow-xs"
            >
              <span>Lock Playing XI</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
