import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';
import { ChevronDown, ChevronUp, BarChart2, ShieldCheck, Trophy, TrendingUp } from 'lucide-react';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';

type SortKey = 'points' | 'nrr' | 'winPercent' | 'battingRR' | 'bowlingRR';

export default function TeamStatsView() {
  const { standings, franchises, selectedFormat } = useGameStore();
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

  const extendedStandings = standings.map(s => {
    const team = franchises.find(f => f.id === s.teamId) || {
      id: s.teamId,
      name: 'Team',
      shortName: 'TM',
      logo: '',
    };
    const winPercent = s.played > 0 ? (s.won / s.played) * 100 : 0;
    
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
      formStr: (s.form || []).slice(-5).join('')
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
    return sortDesc ? (
      <ChevronDown className="w-3.5 h-3.5 inline-block ml-0.5 text-blue-600" />
    ) : (
      <ChevronUp className="w-3.5 h-3.5 inline-block ml-0.5 text-blue-600" />
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER BANNER
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                {selectedFormat || 'IPL'} 2026 Season
              </span>
              <span className="text-xs text-slate-500 font-medium">Franchise Analytics</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-600" />
              Team Performance & Run Rates
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Comprehensive statistical index ranking teams by net run rate, win percentage, and scoring efficiency.
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. DATA TABLE
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-3.5 pl-4 sm:pl-6 min-w-[200px]">Team</th>
                <th className="p-3.5 text-center w-12 font-bold">P</th>
                <th className="p-3.5 text-center w-12 font-bold text-emerald-700">W</th>
                <th className="p-3.5 text-center w-12 font-bold text-rose-600">L</th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors w-16" onClick={() => handleSort('points')}>
                  Pts {renderSortIcon('points')}
                </th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors w-20" onClick={() => handleSort('winPercent')}>
                  Win % {renderSortIcon('winPercent')}
                </th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors w-24" onClick={() => handleSort('battingRR')}>
                  Bat RR {renderSortIcon('battingRR')}
                </th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors w-24" onClick={() => handleSort('bowlingRR')}>
                  Bowl RR {renderSortIcon('bowlingRR')}
                </th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors w-20" onClick={() => handleSort('nrr')}>
                  NRR {renderSortIcon('nrr')}
                </th>
                <th className="p-3.5 pr-4 sm:pr-6 text-center min-w-[140px]">Recent Form</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {extendedStandings.length > 0 ? (
                extendedStandings.map((stat, idx) => (
                  <tr key={stat.teamId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 pl-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 w-4">{idx + 1}</span>
                        <img 
                          src={resolveTeamLogoUrl(stat.team.shortName)} 
                          alt={stat.team.shortName} 
                          className="w-7 h-7 object-contain shrink-0" 
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{stat.team.name}</div>
                          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{stat.team.shortName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 text-center text-slate-600 font-semibold tabular-nums">{stat.played}</td>
                    <td className="p-3.5 text-center font-bold text-emerald-700 tabular-nums">{stat.won}</td>
                    <td className="p-3.5 text-center font-medium text-rose-600 tabular-nums">{stat.lost}</td>
                    <td className="p-3.5 text-center text-sm font-black text-slate-900 tabular-nums">{stat.points}</td>
                    <td className="p-3.5 text-center text-xs font-bold text-slate-800 tabular-nums">{stat.winPercent.toFixed(1)}%</td>
                    <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.battingRR.toFixed(2)}</td>
                    <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.bowlingRR.toFixed(2)}</td>
                    <td className="p-3.5 text-center text-xs font-mono font-bold tabular-nums">
                      <span className={stat.nrr >= 0 ? "text-emerald-700" : "text-rose-600"}>
                        {stat.nrr > 0 ? '+' : ''}{stat.nrr.toFixed(3)}
                      </span>
                    </td>
                    <td className="p-3.5 pr-4 sm:pr-6">
                      <div className="flex items-center justify-center gap-1">
                        {stat.formStr ? (
                          stat.formStr.split('').map((res, i) => (
                            <span 
                              key={i} 
                              className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black",
                                res === 'W' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                res === 'L' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                'bg-slate-100 text-slate-600 border border-slate-200'
                              )}
                            >
                              {res}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-xs font-medium text-slate-400">
                    No stats available yet. Complete tournament matches to generate team performance analytics.
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
