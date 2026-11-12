import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, AlertCircle, ArrowLeft, Target, Sparkles, CheckCircle2, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { getPlayerRating } from '../lib/ratingEngine';

export default function BoardSelection() {
  const { 
    players, 
    selectedFranchiseId, 
    franchises, 
    setGameState, 
    setSelectedSquadIds, 
    goBack, 
    setViewedPlayer, 
    selectedFormat, 
    getArenaPlayerState, 
    playerSeasonStats 
  } = useGameStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const team = franchises.find(f => f.id === selectedFranchiseId);
  const availablePlayers = players.filter(p => p.intendedTeamId === selectedFranchiseId).sort((a, b) => b.rating - a.rating);

  // Auto Pick 15-Man Squad optimized for format (ODI / T20 / TEST)
  const autoPickSquad = () => {
    const activeFormat = selectedFormat || 'ODI';
    const ratePlayer = (p: typeof players[0]) => getPlayerRating(p, activeFormat);

    const pool = [...availablePlayers].sort((a, b) => ratePlayer(b) - ratePlayer(a));

    const keepers = pool.filter(p => p.role === 'Wicketkeeper');
    const batters = pool.filter(p => p.role === 'Batsman');
    const allrounders = pool.filter(p => p.role === 'All-rounder');
    const bowlers = pool.filter(p => p.role === 'Bowler');

    const selected: string[] = [];

    // Target composition for 15-man squad:
    // 2 Wicketkeepers, 5 Batters, 3 All-rounders, 5 Bowlers = 15
    selected.push(...keepers.slice(0, 2).map(p => p.id));
    selected.push(...batters.filter(p => !selected.includes(p.id)).slice(0, 5).map(p => p.id));
    selected.push(...allrounders.filter(p => !selected.includes(p.id)).slice(0, 3).map(p => p.id));
    selected.push(...bowlers.filter(p => !selected.includes(p.id)).slice(0, 5).map(p => p.id));

    // Fallback: fill remaining spots up to 15 with top rated players
    if (selected.length < 15) {
      for (const p of pool) {
        if (selected.length >= 15) break;
        if (!selected.includes(p.id)) {
          selected.push(p.id);
        }
      }
    }

    setSelectedIds(selected.slice(0, 15));
  };

  // Toggle selection
  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        setToastMessage(null);
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 15) {
        setToastMessage('Squad limit reached (15/15). Deselect a player first to swap.');
        setTimeout(() => setToastMessage(null), 3000);
        return prev;
      }
      setToastMessage(null);
      return [...prev, id];
    });
  };

  // Derive squad composition stats
  const selectedPlayers = useMemo(() => {
    return selectedIds.map(id => availablePlayers.find(p => p.id === id)!).filter(Boolean);
  }, [selectedIds, availablePlayers]);

  const stats = useMemo(() => {
    const counts = { Batsman: 0, Bowler: 0, 'All-rounder': 0, Wicketkeeper: 0 };
    let totalRating = 0;

    selectedPlayers.forEach(p => {
      counts[p.role]++;
      totalRating += (selectedFormat ? getPlayerRating(p, selectedFormat) : p.rating);
    });

    const targetCounts = { Batsman: 5, Bowler: 5, 'All-rounder:': 3, Wicketkeeper: 2 };
    const overallRating = selectedPlayers.length > 0 ? totalRating / selectedPlayers.length : 0;

    let balanceScore = 100;
    if (counts.Wicketkeeper < 1) balanceScore -= 30;
    if (counts.Bowler < 3) balanceScore -= 20;
    if (counts.Batsman < 4) balanceScore -= 20;
    balanceScore = Math.max(0, balanceScore);

    let warning: string | null = null;
    let recommendation = "Squad is balanced.";

    if (selectedPlayers.length === 15) {
      if (counts.Wicketkeeper < 1) {
        warning = "No Wicketkeeper";
        recommendation = "You must select at least 1 wicketkeeper for match legality.";
      } else if (counts.Bowler < 3) {
        warning = "Bowler Shortage";
        recommendation = "Recommend at least 4-5 specialist bowling options.";
      } else if (balanceScore > 85) {
        warning = "Excellent Balance";
        recommendation = "This squad is well-rounded and ready for the arena.";
      }
    }

    return { counts, targetCounts, overallRating, balanceScore, warning, recommendation };
  }, [selectedPlayers, selectedFormat]);

  const handleProceed = () => {
    if (selectedIds.length === 15) {
      setSelectedSquadIds(selectedIds);
      useGameStore.getState().initializeIntlFranchises();
      useGameStore.getState().generateSeasonFixtures();
      setGameState(GameState.ARENA_HUB);
    }
  };

  const getProgressBarColor = (current: number, target: number) => {
    if (current === 0) return 'bg-white/10';
    if (current < target - 1) return 'bg-amber-400';
    if (current > target + 2) return 'bg-amber-400';
    return 'bg-emerald-400';
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={goBack}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {team && getIntlTeamLogoUrl(team.shortName) ? (
              <img src={getIntlTeamLogoUrl(team.shortName)!} alt="logo" className="w-9 h-9 object-contain" />
            ) : null}
            <div>
              <div className="text-[10px] font-black text-[#F5B82E] uppercase tracking-wider mb-0.5">{team?.name} Cricket Board</div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Select 15-Man Tournament Squad</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end mr-1">
            <span className="text-[10px] font-bold text-[#9DAEC4] uppercase tracking-wider">Squad Slots</span>
            <span className={cn(
              "text-lg font-black font-mono tabular-nums",
              selectedIds.length === 15 ? "text-emerald-400" : "text-[#F5B82E]"
            )}>
              {selectedIds.length}/15
            </span>
          </div>
          <button
            disabled={selectedIds.length !== 15}
            onClick={handleProceed}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-lg btn-glow cursor-pointer"
          >
            <span>Confirm Squad</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Grid: Player Pool (8 cols) & Composition Advisor (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Player Pool Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black text-[#9DAEC4] uppercase tracking-wider">
              Available Player Pool ({availablePlayers.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={autoPickSquad}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#F5B82E]" />
                <span>Auto Pick {selectedFormat ? `${selectedFormat} 15` : '15'}</span>
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-[#9DAEC4] hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {availablePlayers.map(player => {
              const isSelected = selectedIds.includes(player.id);
              const displayRating = selectedFormat ? getPlayerRating(player, selectedFormat) : player.rating;

              return (
                <div 
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  onDoubleClick={() => setViewedPlayer(player.id)}
                  className={cn(
                    "glass-card flex flex-col p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group select-none shadow-md",
                    isSelected 
                      ? "border-[#258BFF] bg-gradient-to-b from-[#152C4D] to-[#10233D] ring-2 ring-blue-500/30" 
                      : "border-white/5 bg-[#071426]/70 hover:border-white/20 hover:bg-[#10233D]/60"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#258BFF] flex items-center justify-center z-10 shadow-md">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  
                  <div className="w-16 h-16 mx-auto mb-2 relative">
                    <JerseyPlayerImage 
                      player={player} 
                      franchiseId={selectedFranchiseId}
                      className="w-full h-full bg-transparent"
                    />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xs font-black text-white truncate leading-tight mb-0.5 group-hover:text-blue-300 transition-colors">
                      {player.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-[#9DAEC4] uppercase tracking-wider mb-2">
                      <span>{player.role}</span>
                    </div>
                    
                    <div className="flex items-center justify-center bg-[#071426] rounded-xl p-1 border border-white/5">
                      <Star className="w-2.5 h-2.5 text-[#F5B82E] fill-[#F5B82E] mr-1" />
                      <span className="text-[9px] text-[#9DAEC4] uppercase font-bold mr-1">Rating</span>
                      <span className="text-xs font-black text-white tabular-nums">{displayRating}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI Squad Advisor (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 sticky top-24 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#258BFF]" />
              <h2 className="text-xs font-black text-white uppercase tracking-wider">Squad Composition Analysis</h2>
            </div>

            {/* Overall Rating & Balance */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#071426] rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                <span className="text-[9px] text-[#9DAEC4] uppercase tracking-wider font-bold mb-0.5">Avg Rating</span>
                <span className="text-2xl font-black text-white tabular-nums">{stats.overallRating.toFixed(0)}</span>
              </div>
              <div className="bg-[#071426] rounded-xl p-3 border border-white/5 flex flex-col items-center justify-center">
                <span className="text-[9px] text-[#9DAEC4] uppercase tracking-wider font-bold mb-0.5">Balance Index</span>
                <span className={cn(
                  "text-2xl font-black tabular-nums",
                  stats.balanceScore > 80 ? "text-emerald-400" : stats.balanceScore > 50 ? "text-amber-400" : "text-rose-400"
                )}>
                  {selectedIds.length > 0 ? stats.balanceScore : 0}
                </span>
              </div>
            </div>

            {/* Composition Bars */}
            <div className="space-y-3">
              {Object.entries(stats.counts).map(([role, count]) => {
                const target = stats.targetCounts[role as keyof typeof stats.targetCounts] || 3;
                return (
                  <div key={role}>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span className="text-[#9DAEC4]">{role}</span>
                      <span className="text-white tabular-nums">{count} / {target}+</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "h-full flex-1 rounded-sm",
                            i < count ? getProgressBarColor(count, target) : "bg-white/10"
                          )} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Warnings */}
            <div className={cn(
              "p-3 rounded-xl border flex items-start gap-2.5 text-xs font-medium",
              selectedIds.length === 15 
                ? stats.balanceScore > 85 ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300" : "bg-amber-500/20 border-amber-500/30 text-amber-300"
                : "bg-blue-500/20 border-blue-500/30 text-blue-300"
            )}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-white">
                  {selectedIds.length < 15 ? `Select ${15 - selectedIds.length} more players` : stats.warning}
                </h4>
                <p className="text-[11px] opacity-80 mt-0.5 leading-snug">
                  {selectedIds.length < 15 
                    ? "Ensure a balanced mix of batters, bowlers, all-rounders and keepers." 
                    : stats.recommendation}
                </p>
              </div>
            </div>

            <button
              disabled={selectedIds.length !== 15}
              onClick={handleProceed}
              className="w-full py-3 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-lg btn-glow cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Confirm 15-Man Squad</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#F5B82E] text-slate-950 font-black px-4 py-2 rounded-full shadow-2xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
