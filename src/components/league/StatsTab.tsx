import React from 'react';
import { Target, TrendingUp } from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';

export default function StatsTab() {
  const { playerSeasonStats, players, franchises } = useGameStore();

  const getPlayerBasicInfo = (playerId: string) => {
      const player = players.find(p => p.id === playerId);
      if (!player) return { name: 'Unknown', team: 'UNKNOWN' };
      const franchise = franchises.find(f => f.squad.includes(playerId));
      return { 
          name: player.name, 
          team: franchise?.shortName || 'UNSOLD' 
      };
  };

  const allStats = Object.values(playerSeasonStats);
  
  const topRunScorers = [...allStats].sort((a, b) => b.runs - a.runs).slice(0, 5);
  const topWicketTakers = [...allStats].sort((a, b) => b.wickets - a.wickets).slice(0, 5);
  const mostSixes = [...allStats].sort((a, b) => (b.sixes || 0) - (a.sixes || 0)).slice(0, 5);
  const bestEconomy = [...allStats].filter(s => (s.ballsBowled || 0) >= 60).sort((a, b) => (a.economy || 99) - (b.economy || 99)).slice(0, 5);
  const highestStrikeRate = [...allStats].filter(s => s.runs >= 100).sort((a, b) => (b.strikeRate || 0) - (a.strikeRate || 0)).slice(0, 5);

  const statCategories = [
    { title: 'Orange Cap', subtitle: 'Most Runs', icon: Target, color: 'text-orange-400', borderColor: 'border-orange-500/20', data: topRunScorers, valueKey: 'runs', valueSuffix: ' Runs' },
    { title: 'Purple Cap', subtitle: 'Most Wickets', icon: TrendingUp, color: 'text-purple-400', borderColor: 'border-purple-500/20', data: topWicketTakers, valueKey: 'wickets', valueSuffix: ' Wkts' },
    { title: 'Six Machine', subtitle: 'Most Sixes', icon: Target, color: 'text-red-400', borderColor: 'border-red-500/20', data: mostSixes, valueKey: 'sixes', valueSuffix: ' Sixes' },
    { title: 'Strike Rate', subtitle: 'Highest SR', icon: TrendingUp, color: 'text-cyan-300', borderColor: 'border-cyan-500/20', data: highestStrikeRate, valueKey: 'strikeRate', valueSuffix: '', isDecimal: true },
    { title: 'Economy', subtitle: 'Best Economy', icon: Target, color: 'text-teal-400', borderColor: 'border-teal-500/20', data: bestEconomy, valueKey: 'economy', valueSuffix: '', isDecimal: true },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {statCategories.map((cat) => (
            <div key={cat.title} className="premium-card overflow-hidden">
                <div className={cn("flex items-center gap-2 px-3 py-2.5 border-b border-white/[.06]", cat.borderColor)}>
                    <cat.icon className={cn("w-4 h-4", cat.color)} />
                    <div>
                        <div className="text-xs font-bold">{cat.title}</div>
                        <div className="text-[9px] text-white/30">{cat.subtitle}</div>
                    </div>
                </div>
                {cat.data.length === 0 ? (
                    <div className="p-4 text-center text-[10px] text-white/20">No data yet</div>
                ) : (
                    <div className="divide-y divide-white/[.04]">
                        {cat.data.map((stat, i) => {
                            const info = getPlayerBasicInfo(stat.playerId);
                            const rawVal = (stat as any)[cat.valueKey] || 0;
                            const val = cat.isDecimal ? rawVal.toFixed(cat.valueKey === 'economy' ? 2 : 1) : rawVal;
                            return (
                                <div key={stat.playerId} className="flex items-center gap-2.5 px-3 py-2.5">
                                    <span className={cn("w-5 text-center text-xs font-bold", i === 0 ? cat.color : "text-white/20")}>{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold truncate">{info.name}</div>
                                        <div className="text-[9px] text-white/25 font-medium">{info.team}</div>
                                    </div>
                                    <div className={cn("text-sm font-bold", i === 0 ? cat.color : "text-white/70")}>{val}{cat.valueSuffix}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        ))}
    </div>
  );
}
