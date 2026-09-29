import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Shield, ChevronRight, User, Users, AlertCircle, ArrowLeft, Star, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';

export default function BoardSelection() {
  const { players, selectedFranchiseId, franchises, setGameState, setSelectedSquadIds, goBack, setViewedPlayer } = useGameStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const team = franchises.find(f => f.id === selectedFranchiseId);
  const availablePlayers = players.filter(p => p.intendedTeamId === selectedFranchiseId).sort((a, b) => b.rating - a.rating);

  // Toggle selection
  const togglePlayer = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 15) return prev;
      return [...prev, id];
    });
  };

  const getFormMeter = (form: number) => {
    if (form >= 90) return '🔥🔥🔥🔥🔥';
    if (form >= 75) return '🔥🔥🔥🔥░';
    if (form >= 60) return '🔥🔥🔥░░';
    if (form >= 40) return '🔥🔥░░░';
    return '🔥░░░░';
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
    
    // Penalize for imbalances
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
        recommendation = "Add more specialist bowlers for 50/20 overs.";
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
      // We will route to Arena Dashboard
      setGameState(GameState.ARENA_HUB);
    }
  };

  const getProgressBarColor = (current: number, target: number) => {
    if (current === 0) return 'bg-zinc-800';
    if (current < target - 1) return 'bg-orange-500';
    if (current > target + 2) return 'bg-orange-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-15%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[80px]" />
      </div>

      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <button 
                    onClick={goBack}
                    className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-3">
                    <img src={team ? getIntlTeamLogoUrl(team.shortName) || '' : ''} alt="logo" className="w-8 h-8 object-contain" />
                    <div>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">{team?.name} Cricket Board</div>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight">Select 15-Man Squad</h1>
                    </div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Squad Status</span>
                      <span className={cn(
                        "text-lg font-black font-mono",
                        selectedIds.length === 15 ? "text-emerald-400" : "text-white"
                      )}>
                        {selectedIds.length}/15
                      </span>
                  </div>
              </div>
          </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col lg:flex-row gap-6 p-4 sm:p-6 overflow-hidden">
        
        {/* Left: Player Pool Grid */}
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2 pb-24 lg:pb-0">
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 sticky top-0 bg-zinc-950/90 py-2 z-10 backdrop-blur-sm">
            Available Players ({availablePlayers.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {availablePlayers.map(player => {
              const isSelected = selectedIds.includes(player.id);
              return (
                <div 
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  onDoubleClick={() => setViewedPlayer(player.id)}
                  className={cn(
                    "flex flex-col p-3 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden group",
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
                  
                  <div className="w-16 h-16 mx-auto mb-3">
                    <JerseyPlayerImage 
                        player={player} 
                        franchiseId={selectedFranchiseId}
                        className="w-full h-full bg-transparent"
                    />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-sm font-bold truncate leading-tight mb-1 group-hover:text-blue-400 transition-colors">{player.name}</h3>
                    <div className="flex items-center justify-center gap-2 text-[10px] font-medium text-white/50 uppercase tracking-wider mb-2">
                        <span>{player.role}</span>
                    </div>
                    
                    <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-2 border border-white/5">
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] text-zinc-500 uppercase">Rating</span>
                            <span className="text-xs font-black text-yellow-500">{player.rating}</span>
                        </div>
                        <div className="w-[1px] h-4 bg-white/10" />
                        <div className="flex flex-col items-center">
                            <span className="text-[9px] text-zinc-500 uppercase" title={`Form: ${Math.round(player.form || 85)}`}>Form</span>
                            <span className="text-[8px] tracking-widest text-orange-500">{getFormMeter(player.form || 85)}</span>
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: AI Squad Advisor */}
        <div className="w-full lg:w-96 shrink-0 flex flex-col gap-4 relative z-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sticky top-4">
            <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-black tracking-tight">AI Squad Advisor</h2>
            </div>

            {/* Overall Rating & Balance */}
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center justify-center">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Squad Quality</span>
                <span className="text-3xl font-black text-white">{stats.overallRating.toFixed(0)}</span>
              </div>
              <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800/50 flex flex-col items-center justify-center">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold mb-1">Balance Index</span>
                <span className={cn(
                  "text-3xl font-black",
                  stats.balanceScore > 80 ? "text-emerald-400" : stats.balanceScore > 50 ? "text-orange-400" : "text-red-400"
                )}>
                  {selectedIds.length > 0 ? stats.balanceScore : 0}
                </span>
              </div>
            </div>

            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Composition</h3>
            <div className="space-y-4 mb-8">
              {Object.entries(stats.counts).map(([role, count]) => {
                const target = stats.targetCounts[role as keyof typeof stats.targetCounts];
                return (
                  <div key={role}>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
                      <span className="text-zinc-400">{role}</span>
                      <span className="text-zinc-300">{count} / {target}+</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "h-full flex-1 rounded-sm",
                            i < count ? getProgressBarColor(count, target) : "bg-zinc-800"
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
              "p-4 rounded-2xl border flex items-start gap-3 transition-colors",
              selectedIds.length === 15 
                ? stats.balanceScore > 85 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-orange-500/10 border-orange-500/20 text-orange-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-400"
            )}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold mb-1">
                  {selectedIds.length < 15 ? `Select ${15 - selectedIds.length} more players` : stats.warning}
                </h4>
                <p className="text-xs opacity-80 leading-relaxed font-medium">
                  {selectedIds.length < 15 
                    ? "Keep an eye on the composition meters to ensure a balanced squad for the arena." 
                    : stats.recommendation}
                </p>
              </div>
            </div>

            <button
              disabled={selectedIds.length !== 15}
              onClick={handleProceed}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-lg shadow-blue-600/20"
            >
              Confirm Squad
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
