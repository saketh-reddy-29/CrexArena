import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

type SortKey = 'points' | 'nrr' | 'winPercent' | 'battingRR' | 'bowlingRR';

export default function TeamStatsView() {
  const { standings, franchises } = useGameStore();
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const calculateOvers = (balls: number) => {
    const overs = Math.floor(balls / 6);
    const extra = balls % 6;
    return overs + extra / 10;
  };

  const extendedStandings = standings.map(s => {
    const team = franchises.find(f => f.id === s.teamId)!;
    const winPercent = s.played > 0 ? (s.won / s.played) * 100 : 0;
    
    // Convert overs.balls back to total balls for exact calculation if needed, 
    // but assuming oversFaced/oversBowled is in normal decimal overs like 20.0 or 19.5
    // Actually, in standard cricket format, 19.5 means 19 overs 5 balls = 119 balls.
    const getBalls = (ov: number) => {
      const o = Math.floor(ov);
      const b = Math.round((ov - o) * 10);
      return (o * 6) + b;
    };

    const ballsFaced = getBalls(s.oversFaced);
    const ballsBowled = getBalls(s.oversBowled);

    const battingRR = ballsFaced > 0 ? (s.runsScored / ballsFaced) * 6 : 0;
    const bowlingRR = ballsBowled > 0 ? (s.runsConceded / ballsBowled) * 6 : 0;

    return {
      ...s,
      team,
      winPercent,
      battingRR,
      bowlingRR,
      formStr: s.form.slice(-5).join('') // Last 5 matches
    };
  });

  extendedStandings.sort((a, b) => {
    const valA = (a as any)[sortKey] || 0;
    const valB = (b as any)[sortKey] || 0;
    
    if (valA === valB && sortKey === 'points') {
      return sortDesc ? b.nrr - a.nrr : a.nrr - b.nrr;
    }
    
    return sortDesc ? valB - valA : valA - valB;
  });

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDesc ? <ChevronDown className="w-3 h-3 inline-block ml-1 text-emerald-400" /> : <ChevronUp className="w-3 h-3 inline-block ml-1 text-emerald-400" />;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Team Performance</h2>
          <p className="text-xs text-zinc-400 mt-1">Detailed statistical breakdown of every franchise</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="p-4 pl-6 font-semibold min-w-[200px]">Team</th>
                <th className="p-4">P</th>
                <th className="p-4 text-emerald-400">W</th>
                <th className="p-4 text-red-400">L</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('points')}>Pts {renderSortIcon('points')}</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('winPercent')}>Win % {renderSortIcon('winPercent')}</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('battingRR')}>Bat RR {renderSortIcon('battingRR')}</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('bowlingRR')}>Bowl RR {renderSortIcon('bowlingRR')}</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('nrr')}>NRR {renderSortIcon('nrr')}</th>
                <th className="p-4">Form (Last 5)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {extendedStandings.length > 0 ? (
                extendedStandings.map((stat, idx) => (
                  <tr key={stat.teamId} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-600 w-4">{idx + 1}</span>
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 p-1 flex items-center justify-center">
                          <img src={stat.team.logo} alt={stat.team.shortName} className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{stat.team.name}</div>
                          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{stat.team.shortName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-medium text-zinc-300">{stat.played}</td>
                    <td className="p-4 text-xs font-bold text-emerald-400">{stat.won}</td>
                    <td className="p-4 text-xs font-medium text-red-400">{stat.lost}</td>
                    <td className="p-4 text-sm font-black text-white">{stat.points}</td>
                    <td className="p-4 text-xs font-medium text-zinc-300">{stat.winPercent.toFixed(1)}%</td>
                    <td className="p-4 text-xs font-medium text-zinc-300">{stat.battingRR.toFixed(2)}</td>
                    <td className="p-4 text-xs font-medium text-zinc-300">{stat.bowlingRR.toFixed(2)}</td>
                    <td className={cn("p-4 text-xs font-bold", stat.nrr >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {stat.nrr > 0 ? '+' : ''}{stat.nrr.toFixed(3)}
                    </td>
                    <td className="p-4 flex items-center gap-1">
                      {stat.formStr.split('').map((res, i) => (
                        <span 
                          key={i} 
                          className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold",
                            res === 'W' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          )}
                        >
                          {res}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-sm font-medium text-zinc-500">
                    No stats available yet. Simulate some matches to generate data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
