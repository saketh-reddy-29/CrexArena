import React, { useState } from 'react';
import { 
  BarChart3, Trophy, Flame, Target, TrendingUp, Zap, 
  Shield, Users, Filter, Star, ChevronRight 
} from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';
import { getPlayerImage } from '../../lib/playerImages';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import { cn } from '../../lib/utils';
import { Player } from '../../types/common';

export default function StatisticsView() {
  const { 
    playerSeasonStats, 
    players, 
    franchises, 
    selectedFormat, 
    setViewedPlayer 
  } = useGameStore();

  const [activeCategory, setActiveCategory] = useState<'runs' | 'wickets' | 'strikeRate' | 'economy' | 'sixes'>('runs');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  const allStats = Object.values(playerSeasonStats);

  // Filter stats by team if requested
  const filteredStats = allStats.filter(stat => {
    if (teamFilter === 'ALL') return true;
    const team = franchises.find(f => f.squad.includes(stat.playerId));
    return team?.id === teamFilter;
  });

  const getPlayer = (playerId: string): Player | undefined => {
    return players.find(p => p.id === playerId);
  };

  const getFranchise = (playerId: string) => {
    return franchises.find(f => f.squad.includes(playerId));
  };

  // Sorted leaderboards
  const topBatters = [...filteredStats].sort((a, b) => b.runs - a.runs).slice(0, 15);
  const topBowlers = [...filteredStats].sort((a, b) => b.wickets - a.wickets).slice(0, 15);
  const topStrikeRates = [...filteredStats]
    .filter(s => (s.ballsFaced || 0) >= 30)
    .sort((a, b) => (b.strikeRate || 0) - (a.strikeRate || 0))
    .slice(0, 15);
  const bestEconomies = [...filteredStats]
    .filter(s => (s.ballsBowled || 0) >= 36)
    .sort((a, b) => (a.economy || 99) - (b.economy || 99))
    .slice(0, 15);
  const topSixHitters = [...filteredStats]
    .sort((a, b) => (b.sixes || 0) - (a.sixes || 0))
    .slice(0, 15);

  const getActiveLeaderboard = () => {
    switch (activeCategory) {
      case 'runs':
        return { data: topBatters, title: 'Orange Cap — Leading Run Scorers', metricLabel: 'Runs', metricKey: 'runs' };
      case 'wickets':
        return { data: topBowlers, title: 'Purple Cap — Leading Wicket Takers', metricLabel: 'Wickets', metricKey: 'wickets' };
      case 'strikeRate':
        return { data: topStrikeRates, title: 'Extreme Firepower — Highest Strike Rates', metricLabel: 'Strike Rate', metricKey: 'strikeRate', isDecimal: true };
      case 'economy':
        return { data: bestEconomies, title: 'Tight Spells — Best Economy Rates', metricLabel: 'Economy', metricKey: 'economy', isDecimal: true };
      case 'sixes':
        return { data: topSixHitters, title: 'Maximum Sixes — Boundary Kings', metricLabel: 'Sixes', metricKey: 'sixes' };
    }
  };

  const currentBoard = getActiveLeaderboard();

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Tournament Performance Intelligence
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#258BFF]" />
            Player Statistics & Analytics
          </h1>
        </div>

        {/* Team Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9DAEC4] font-bold">Filter by Team:</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="bg-[#10233D] border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#258BFF]"
          >
            <option value="ALL">All Franchises</option>
            {franchises.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-white/10 pb-3">
        {[
          { key: 'runs', label: 'Most Runs', icon: Trophy, color: 'text-orange-400' },
          { key: 'wickets', label: 'Most Wickets', icon: Target, color: 'text-purple-400' },
          { key: 'strikeRate', label: 'Highest Strike Rate', icon: Zap, color: 'text-cyan-400' },
          { key: 'economy', label: 'Best Economy', icon: Shield, color: 'text-emerald-400' },
          { key: 'sixes', label: 'Most Sixes', icon: Flame, color: 'text-red-400' },
        ].map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shrink-0 cursor-pointer",
                isActive
                  ? "bg-[#258BFF] text-white shadow-lg shadow-blue-500/20"
                  : "bg-[#10233D] text-[#9DAEC4] hover:text-white border border-white/5"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-white" : cat.color)} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Leaderboard Table */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h2 className="text-base font-black text-white mb-4 flex items-center justify-between">
          <span>{currentBoard.title}</span>
          <span className="text-xs text-[#9DAEC4] font-normal">Click any player to inspect full profile & heatmaps</span>
        </h2>

        {currentBoard.data.length === 0 ? (
          <div className="py-12 text-center text-[#9DAEC4] italic">
            No statistics recorded for this category yet. Simulate or play matches to build performance data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-[#9DAEC4] uppercase text-[10px] font-bold">
                  <th className="pb-3 w-12 text-center">Rank</th>
                  <th className="pb-3">Player</th>
                  <th className="pb-3">Team</th>
                  <th className="pb-3 text-center">Matches</th>
                  <th className="pb-3 text-center">Runs</th>
                  <th className="pb-3 text-center">Wkts</th>
                  <th className="pb-3 text-center">SR</th>
                  <th className="pb-3 text-center">Econ</th>
                  <th className="pb-3 text-right">{currentBoard.metricLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {currentBoard.data.map((stat, idx) => {
                  const player = getPlayer(stat.playerId);
                  const team = getFranchise(stat.playerId);
                  const rawVal = (stat as any)[currentBoard.metricKey] || 0;
                  const displayVal = currentBoard.isDecimal ? rawVal.toFixed(2) : rawVal;

                  return (
                    <tr
                      key={stat.playerId}
                      onClick={() => setViewedPlayer(stat.playerId)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 text-center font-bold text-[#9DAEC4]">
                        {idx === 0 ? (
                          <span className="w-5 h-5 rounded-full bg-[#F5B82E] text-black font-black flex items-center justify-center mx-auto text-[10px]">
                            1
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>

                      <td className="py-3 flex items-center gap-3">
                        <img
                          src={getPlayerImage(player)}
                          alt={player?.name}
                          className="w-9 h-9 rounded-xl object-cover bg-white/5 shrink-0"
                        />
                        <div>
                          <div className="font-black text-white group-hover:text-blue-400 transition-colors">
                            {player?.name || stat.playerId}
                          </div>
                          <div className="text-[10px] text-[#9DAEC4]">{player?.role}</div>
                        </div>
                      </td>

                      <td className="py-3">
                        {team ? (
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <img
                              src={resolveTeamLogoUrl(team.shortName, team.logo)}
                              alt={team.name}
                              className="w-4 h-4 object-contain"
                            />
                            <span>{team.shortName}</span>
                          </div>
                        ) : (
                          <span className="text-[#9DAEC4] italic">Free Agent</span>
                        )}
                      </td>

                      <td className="py-3 text-center font-mono text-[#9DAEC4]">{stat.matches || 0}</td>
                      <td className="py-3 text-center font-mono text-white font-bold">{stat.runs || 0}</td>
                      <td className="py-3 text-center font-mono text-white font-bold">{stat.wickets || 0}</td>
                      <td className="py-3 text-center font-mono text-[#9DAEC4]">{stat.strikeRate ? stat.strikeRate.toFixed(1) : '-'}</td>
                      <td className="py-3 text-center font-mono text-[#9DAEC4]">{stat.economy ? stat.economy.toFixed(2) : '-'}</td>
                      <td className="py-3 text-right font-mono font-black text-base text-[#F5B82E]">
                        {displayVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
