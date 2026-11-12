import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, User, ArrowLeft, Target, AlertCircle, Sparkles, CheckCircle2, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { calculateEffectiveRating, getPlayerRating } from '../lib/ratingEngine';

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

  // Form meter visualization
  const getFormMeter = (form: number) => {
    if (form >= 85) return '★★★★★';
    if (form >= 70) return '★★★★☆';
    if (form >= 50) return '★★★☆☆';
    return '★★☆☆☆';
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
        setToastMessage('Playing XI limit reached (11/11). Deselect a player first.');
        setTimeout(() => setToastMessage(null), 3000);
        return prev;
      }
      setToastMessage(null);
      return [...prev, id];
    });
  };

  // Derive XI composition stats
  const stats = useMemo(() => {
    const currentXI = playingXI.map(id => players.find(p => p.id === id)!).filter(Boolean);
    if (currentXI.length === 0) return null;

    const counts = { Batters: 0, Bowlers: 0, 'All-rounders': 0, Wicketkeepers: 0 };
    let batPoints = 0;
    let bowlPoints = 0;
    let totalRating = 0;

    currentXI.forEach(p => {
      if (p.role === 'Batsman') counts.Batters++;
      if (p.role === 'Bowler') counts.Bowlers++;
      if (p.role === 'All-rounder') counts['All-rounders']++;
      if (p.role === 'Wicketkeeper') counts.Wicketkeepers++;

      batPoints += p.stats.batting;
      bowlPoints += p.stats.bowling;
      totalRating += (selectedFormat ? calculateEffectiveRating(p, selectedFormat).overall : p.rating);
    });

    const overall = Math.round(totalRating / currentXI.length);
    const batStr = Math.round(batPoints / currentXI.length);
    const bowlStr = Math.round(bowlPoints / currentXI.length);

    let balance = 100;
    if (counts.Wicketkeepers < 1) balance -= 30;
    if (counts.Bowlers + counts['All-rounders'] < 5) balance -= 25;
    if (counts.Batters + counts['All-rounders'] < 5) balance -= 25;
    balance = Math.max(0, balance);

    return { counts, overall, batStr, bowlStr, balance };
  }, [playingXI, players, selectedFormat]);

  const handleConfirm = () => {
    if (playingXI.length === 11) {
      setPlayingXIIds(playingXI);
      if (currentMatchId) {
        setGameState(GameState.PRE_MATCH);
      } else {
        setGameState(GameState.ARENA_HUB);
      }
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setGameState(GameState.ARENA_HUB)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="text-[10px] font-black text-[#F5B82E] uppercase tracking-wider mb-0.5">
              {selectedFormat || 'MATCH DAY'} LINEUP
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Match-Day Playing XI Selection
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-1">
            <span className="text-[9px] font-bold text-[#9DAEC4] uppercase tracking-wider">Lineup Status</span>
            <span className={cn(
              "text-lg font-black font-mono tabular-nums",
              playingXI.length === 11 ? "text-emerald-400" : "text-[#F5B82E]"
            )}>
              {playingXI.length}/11 Selected
            </span>
          </div>
          <button
            disabled={playingXI.length !== 11}
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none shadow-lg btn-glow active:scale-95 cursor-pointer"
          >
            <span>Confirm Playing XI</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Grid: Squad Pool (8 cols) & Playing XI Analysis (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Squad Pool */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[#9DAEC4] uppercase tracking-wider">
              Eligible Squad Pool ({squadPlayers.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={autoPickXI}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
                <span>Auto-Pick Optimal XI</span>
              </button>
              {playingXI.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPlayingXI([])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#9DAEC4] hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Selection
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
                    "glass-card flex items-center gap-3.5 p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden select-none shadow-md",
                    isSelected 
                      ? "border-[#258BFF] bg-gradient-to-r from-[#152C4D] to-[#10233D] ring-2 ring-blue-500/30" 
                      : "border-white/5 bg-[#071426]/70 hover:border-white/20 hover:bg-[#10233D]/60"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#258BFF] flex items-center justify-center z-10 shadow-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#071426] border border-white/10 shrink-0">
                    <JerseyPlayerImage 
                      player={player} 
                      franchiseId={selectedFranchiseId}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black text-white truncate leading-tight mb-0.5 group-hover:text-blue-300 transition-colors">
                      {player.name}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-semibold text-[#9DAEC4] uppercase tracking-wider">
                      <span>{player.role}</span>
                      <span>•</span>
                      <span>{player.battingStyle || 'Right hand'}</span>
                    </div>
                    {hasPlayed && (
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[#9DAEC4] mt-0.5" title={`Form: ${Math.round(formValue)}`}>
                        <span className="text-[#F5B82E] tracking-widest">{getFormMeter(formValue)}</span>
                        <span className="text-[9px] uppercase font-bold text-[#9DAEC4]/60">Form</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <span className="text-[9px] text-[#9DAEC4] uppercase font-bold block mb-0.5">Rating</span>
                      <span className={cn(
                        "text-base font-black tabular-nums",
                        effRating.overall > player.rating ? "text-emerald-400" : effRating.overall < player.rating ? "text-rose-400" : "text-[#F5B82E]"
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
                      className="p-1.5 rounded-lg text-[#9DAEC4] hover:text-white hover:bg-white/10 transition-colors"
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

        {/* Right: Playing XI Analysis Card (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 sticky top-24 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#258BFF]" />
                <h2 className="text-xs font-black text-white uppercase tracking-wider">Playing XI Tactical Strength</h2>
              </div>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase",
                playingXI.length === 11 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              )}>
                {playingXI.length === 11 ? 'Ready' : `${11 - playingXI.length} Needed`}
              </span>
            </div>

            {stats && (
              <>
                {/* Overall Rating Box */}
                <div className="bg-[#071426] rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                  <span className="text-[10px] text-[#9DAEC4] uppercase tracking-wider font-bold mb-0.5">Team Rating Index</span>
                  <span className="text-4xl font-black text-white tabular-nums">{stats.overall}</span>
                  <span className="text-[10px] text-[#9DAEC4] mt-1">Format-adjusted tactical strength</span>
                </div>

                {/* Sub-bars: Batting, Bowling, Balance */}
                <div className="space-y-3.5">
                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-[#9DAEC4]">Batting Depth</span>
                      <span className="text-white tabular-nums">{stats.batStr}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.batStr}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-[#9DAEC4]">Bowling Attack</span>
                      <span className="text-white tabular-nums">{stats.bowlStr}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${stats.bowlStr}%` }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider mb-1">
                      <span className="text-[#9DAEC4]">Role Harmony</span>
                      <span className={cn("font-black tabular-nums", stats.balance >= 90 ? "text-emerald-400" : stats.balance >= 70 ? "text-amber-400" : "text-rose-400")}>
                        {stats.balance}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", stats.balance >= 90 ? "bg-emerald-500" : stats.balance >= 70 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${stats.balance}%` }} />
                    </div>
                  </div>
                </div>

                {/* Composition Chips */}
                <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-[#071426] border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-[#9DAEC4] block">Batters</span>
                    <span className="font-bold text-white">{stats.counts.Batters}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#071426] border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-[#9DAEC4] block">Bowlers</span>
                    <span className="font-bold text-white">{stats.counts.Bowlers}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#071426] border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-[#9DAEC4] block">All-Rounders</span>
                    <span className="font-bold text-white">{stats.counts['All-rounders']}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[#071426] border border-white/5">
                    <span className="text-[9px] uppercase font-bold text-[#9DAEC4] block">Keepers</span>
                    <span className="font-bold text-white">{stats.counts.Wicketkeepers}</span>
                  </div>
                </div>

                {/* Advice / Balance alerts */}
                {playingXI.length === 11 && stats.balance < 85 && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-white">Lineup Advisory</h4>
                      <p className="text-[11px] opacity-80 leading-snug mt-0.5">
                        Ensure you have at least 1 Wicketkeeper and at least 5 bowling options.
                      </p>
                    </div>
                  </div>
                )}
                {playingXI.length === 11 && stats.balance >= 85 && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-start gap-2.5">
                    <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-white">Well Balanced Lineup</h4>
                      <p className="text-[11px] opacity-80 leading-snug mt-0.5">
                        Your playing XI satisfies all role constraints and is ready to compete.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              disabled={playingXI.length !== 11}
              onClick={handleConfirm}
              className="w-full py-3 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-lg btn-glow cursor-pointer"
            >
              <span>Lock Playing XI</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#F5B82E] text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2 animate-bounce">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
