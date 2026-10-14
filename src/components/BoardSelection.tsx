import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, AlertCircle, ArrowLeft, Target, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { getPlayerRating } from '../lib/ratingEngine';

export default function BoardSelection() {
  const { players, selectedFranchiseId, franchises, setGameState, setSelectedSquadIds, goBack, setViewedPlayer, selectedFormat, getArenaPlayerState, playerSeasonStats } = useGameStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const team = franchises.find(f => f.id === selectedFranchiseId);
  const availablePlayers = players.filter(p => p.intendedTeamId === selectedFranchiseId).sort((a, b) => b.rating - a.rating);

  // Check whether player has played in previous matches
  const getPlayerPlayStatus = (playerId: string) => {
    const activeFormat = selectedFormat || 'ODI';
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

  // AI Advisor Calculations
  const selectedPlayers = players.filter(p => selectedIds.includes(p.id));
  
  const stats = useMemo(() => {
    const counts = {
      Batters: selectedPlayers.filter(p => p.role === 'Batsman').length,
      Bowlers: selectedPlayers.filter(p => p.role === 'Bowler').length,
      'All-rounders': selectedPlayers.filter(p => p.role === 'All-rounder').length,
      Wicketkeepers: selectedPlayers.filter(p => p.role === 'Wicketkeeper').length,
    };

    const targetCounts = {
      Batters: 5,
      Bowlers: 5,
      'All-rounders': 3,
      Wicketkeepers: 2,
    };

    const overallRating = selectedPlayers.length > 0 
        ? selectedPlayers.reduce((acc, p) => acc + p.rating, 0) / selectedPlayers.length 
        : 0;

    let balanceScore = 100;
    
    if (counts.Batters < 4) balanceScore -= 15;
    if (counts.Batters > 7) balanceScore -= 10;
    if (counts.Bowlers < 4) balanceScore -= 20;
    if (counts.Bowlers > 7) balanceScore -= 10;
    if (counts['All-rounders'] < 1) balanceScore -= 10;
    if (counts.Wicketkeepers < 1) balanceScore -= 20;
    if (counts.Wicketkeepers > 3) balanceScore -= 10;

    let warning = null;
    let recommendation = null;

    if (selectedPlayers.length === 15) {
      if (counts.Wicketkeepers === 0) {
        warning = "Critical: No Wicketkeeper";
        recommendation = "Add at least one specialist wicketkeeper.";
      } else if (counts.Bowlers < 4) {
        warning = "Critical: Lack of Bowlers";
        recommendation = "Add more specialist bowlers.";
      } else if (counts.Batters < 4) {
        warning = "Critical: Weak Batting Depth";
        recommendation = "Add more specialist batters.";
      } else if (balanceScore > 85) {
        warning = "Excellent Balance";
        recommendation = "This squad is well-rounded and ready for the arena.";
      }
    }

    return { counts, targetCounts, overallRating, balanceScore, warning, recommendation };
  }, [selectedPlayers]);

  const handleProceed = () => {
    if (selectedIds.length === 15) {
      setSelectedSquadIds(selectedIds);
      useGameStore.getState().initializeIntlFranchises();
      useGameStore.getState().generateSeasonFixtures();
      setGameState(GameState.ARENA_HUB);
    }
  };

  const getProgressBarColor = (current: number, target: number) => {
    if (current === 0) return 'bg-slate-200';
    if (current < target - 1) return 'bg-amber-500';
    if (current > target + 2) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex flex-col font-sans relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 px-4 py-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={goBack}
              className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3">
              {team && getIntlTeamLogoUrl(team.shortName) ? (
                <img src={getIntlTeamLogoUrl(team.shortName)!} alt="logo" className="w-8 h-8 object-contain" />
              ) : null}
              <div>
                <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-0.5">{team?.name} Cricket Board</div>
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">Select 15-Man Tournament Squad</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Squad</span>
              <span className={cn(
                "text-base font-black font-mono tabular-nums",
                selectedIds.length === 15 ? "text-emerald-700" : "text-slate-800"
              )}>
                {selectedIds.length}/15
              </span>
            </div>
            <button
              disabled={selectedIds.length !== 15}
              onClick={handleProceed}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs cursor-pointer"
            >
              Confirm Squad
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-5 p-4 sm:p-6 overflow-y-auto">
        
        {/* Left: Player Pool Grid */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-1 pb-20 lg:pb-0">
          <div className="flex items-center justify-between mb-3 sticky top-0 bg-[#f4f6f9]/90 py-2 z-10 backdrop-blur-sm gap-2">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-wider">
              Available Player Pool ({availablePlayers.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={autoPickSquad}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Auto Pick {selectedFormat ? `${selectedFormat} 15` : '15'}
              </button>
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear
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
                    "flex flex-col p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group select-none bg-white",
                    isSelected 
                      ? "border-blue-600 bg-blue-50/20 shadow-sm" 
                      : "border-slate-200/90 hover:border-slate-300 hover:shadow-xs"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center z-10 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  
                  <div className="w-14 h-14 mx-auto mb-2">
                    <JerseyPlayerImage 
                      player={player} 
                      franchiseId={selectedFranchiseId}
                      className="w-full h-full bg-transparent"
                    />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xs font-bold text-slate-900 truncate leading-tight mb-0.5 group-hover:text-blue-600 transition-colors">
                      {player.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      <span>{player.role}</span>
                    </div>
                    
                    <div className="flex items-center justify-center bg-slate-50 rounded-xl p-1.5 border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase font-bold mr-1.5">Rating</span>
                      <span className="text-xs font-black text-slate-800 tabular-nums">{displayRating}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI Squad Advisor */}
        <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3 relative z-20">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sticky top-20 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Squad Composition</h2>
            </div>

            {/* Overall Rating & Balance */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Avg Rating</span>
                <span className="text-2xl font-black text-slate-900 tabular-nums">{stats.overallRating.toFixed(0)}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Balance Index</span>
                <span className={cn(
                  "text-2xl font-black tabular-nums",
                  stats.balanceScore > 80 ? "text-emerald-700" : stats.balanceScore > 50 ? "text-amber-600" : "text-rose-600"
                )}>
                  {selectedIds.length > 0 ? stats.balanceScore : 0}
                </span>
              </div>
            </div>

            {/* Composition Bars */}
            <div className="space-y-3">
              {Object.entries(stats.counts).map(([role, count]) => {
                const target = stats.targetCounts[role as keyof typeof stats.targetCounts];
                return (
                  <div key={role}>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                      <span className="text-slate-500">{role}</span>
                      <span className="text-slate-700 tabular-nums">{count} / {target}+</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "h-full flex-1 rounded-sm",
                            i < count ? getProgressBarColor(count, target) : "bg-slate-200"
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
                ? stats.balanceScore > 85 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            )}>
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs">
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
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
            >
              Confirm Squad
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white font-bold px-4 py-2 rounded-full shadow-md text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
