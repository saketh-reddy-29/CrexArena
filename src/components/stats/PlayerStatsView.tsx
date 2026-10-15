import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Search, ChevronDown, ChevronUp, Trophy, Flame, Award, Shield, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import JerseyPlayerImage from '../JerseyPlayerImage';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';

type SortKey = 'runs' | 'strikeRate' | 'average' | 'highScore' | 'fours' | 'sixes' | 'wickets' | 'economy' | 'bowlingAverage' | 'matches';

export default function PlayerStatsView() {
  const { playerSeasonStats, players, franchises, selectedFormat } = useGameStore();
  const [activeTab, setActiveTab] = useState<'BATTING' | 'BOWLING'>('BATTING');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('runs');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true); // default descending
    }
  };

  const getTeamForPlayer = (playerId: string) => {
    return franchises.find(f => f.squad.includes(playerId));
  };

  // Compile player stats list
  const statsList = Object.values(playerSeasonStats).map(stat => {
    const player = players.find(p => p.id === stat.playerId);
    const team = getTeamForPlayer(stat.playerId);
    
    const battingAvg = stat.matches > 0 ? (stat.runs / Math.max(1, stat.matches)) : 0;
    const bowlingAvg = stat.wickets > 0 && stat.runsConceded ? (stat.runsConceded / stat.wickets) : 0;
    
    return {
      ...stat,
      player,
      team,
      average: battingAvg,
      bowlingAverage: bowlingAvg
    };
  }).filter(s => s.player && s.player.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Sort list
  statsList.sort((a, b) => {
    const valA = (a as any)[sortKey] || 0;
    const valB = (b as any)[sortKey] || 0;
    return sortDesc ? valB - valA : valA - valB;
  });

  // Top 3 Leaders for Podium
  const topBatters = [...Object.values(playerSeasonStats)]
    .map(stat => ({ ...stat, player: players.find(p => p.id === stat.playerId), team: getTeamForPlayer(stat.playerId) }))
    .filter(s => Boolean(s.player))
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 3);

  const topBowlers = [...Object.values(playerSeasonStats)]
    .map(stat => ({ ...stat, player: players.find(p => p.id === stat.playerId), team: getTeamForPlayer(stat.playerId) }))
    .filter(s => Boolean(s.player))
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 3);

  const podiumLeaders = activeTab === 'BATTING' ? topBatters : topBowlers;

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
          1. HEADER & FORMAT BADGE
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                {selectedFormat || 'IPL'} 2026 Season Records
              </span>
              <span className="text-xs text-slate-500 font-medium">Official Leaderboard</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Tournament Player Records & Caps
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Live tournament statistics tracking Orange Cap (Leading Run Scorer) and Purple Cap (Leading Wicket Taker).
            </p>
          </div>

          {/* Batting / Bowling Tabs */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl self-start sm:self-center">
            <button 
              onClick={() => { setActiveTab('BATTING'); setSortKey('runs'); setSortDesc(true); }}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                activeTab === 'BATTING' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Crown className="w-3.5 h-3.5 text-amber-500" />
              Orange Cap (Batting)
            </button>
            <button 
              onClick={() => { setActiveTab('BOWLING'); setSortKey('wickets'); setSortDesc(true); }}
              className={cn(
                "px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                activeTab === 'BOWLING' 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Award className="w-3.5 h-3.5 text-purple-200" />
              Purple Cap (Bowling)
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. TOP 3 PODIUM DISPLAY
      ───────────────────────────────────────────────────────────────── */}
      {podiumLeaders.length > 0 && podiumLeaders[0]?.player && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {podiumLeaders.map((leader, idx) => {
            if (!leader.player) return null;
            const isFirst = idx === 0;
            const isSecond = idx === 1;
            const rankLabel = isFirst ? '1st' : isSecond ? '2nd' : '3rd';
            const capColor = activeTab === 'BATTING' 
              ? (isFirst ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800')
              : (isFirst ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800');

            return (
              <div 
                key={leader.playerId}
                onClick={() => useGameStore.getState().setViewedPlayer(leader.playerId)}
                className={cn(
                  "bg-white rounded-2xl border p-4 shadow-xs relative overflow-hidden cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
                  isFirst ? "border-amber-300 ring-2 ring-amber-400/20" : "border-slate-200/90"
                )}
              >
                {/* Rank Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide", capColor)}>
                    {isFirst && <Crown className="w-3 h-3 inline-block mr-1 -mt-0.5" />}
                    {rankLabel} Place
                  </span>
                  {leader.team && (
                    <img 
                      src={resolveTeamLogoUrl(leader.team.shortName)} 
                      alt={leader.team.shortName} 
                      className="w-5 h-5 object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <JerseyPlayerImage 
                      player={leader.player} 
                      franchiseId={leader.team?.id || null}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-slate-900 truncate">{leader.player.name}</h3>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {leader.team?.shortName || 'FREE AGENT'} • {leader.player.role}
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-lg font-black text-slate-900 tabular-nums">
                        {activeTab === 'BATTING' ? `${leader.runs} Runs` : `${leader.wickets} Wkts`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold">
                        ({leader.matches} M)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Stats Footer */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
                  {activeTab === 'BATTING' ? (
                    <>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Avg</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {leader.matches > 0 ? (leader.runs / leader.matches).toFixed(1) : '0.0'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">SR</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {leader.strikeRate?.toFixed(1) || '0.0'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">HS</span>
                        <span className="font-black text-blue-600 tabular-nums">{leader.highScore}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Econ</span>
                        <span className="font-bold text-slate-800 tabular-nums">
                          {leader.economy?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">BBI</span>
                        <span className="font-black text-purple-600">{leader.bestBowling || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Dots</span>
                        <span className="font-bold text-slate-800 tabular-nums">{leader.dotBalls || 0}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          3. FULL SEARCH & SORTABLE DATA TABLE
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        
        {/* Table Filter / Search Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search player name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-72 bg-slate-50 border border-slate-200 rounded-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {statsList.length} players with recorded match figures
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="p-3.5 pl-4 sm:pl-6 min-w-[240px]">Player</th>
                <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('matches')}>
                  M {renderSortIcon('matches')}
                </th>
                
                {activeTab === 'BATTING' ? (
                  <>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('runs')}>
                      Runs {renderSortIcon('runs')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('average')}>
                      Avg {renderSortIcon('average')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('strikeRate')}>
                      SR {renderSortIcon('strikeRate')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('highScore')}>
                      HS {renderSortIcon('highScore')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('fours')}>
                      4s {renderSortIcon('fours')}
                    </th>
                    <th className="p-3.5 pr-4 sm:pr-6 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('sixes')}>
                      6s {renderSortIcon('sixes')}
                    </th>
                  </>
                ) : (
                  <>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('wickets')}>
                      Wkts {renderSortIcon('wickets')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('economy')}>
                      Econ {renderSortIcon('economy')}
                    </th>
                    <th className="p-3.5 text-center cursor-pointer hover:text-slate-900 transition-colors" onClick={() => handleSort('bowlingAverage')}>
                      Avg {renderSortIcon('bowlingAverage')}
                    </th>
                    <th className="p-3.5 pr-4 sm:pr-6 text-center">BBI</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statsList.length > 0 ? (
                statsList.map((stat, idx) => (
                  <tr 
                    key={stat.playerId} 
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => useGameStore.getState().setViewedPlayer(stat.playerId)}
                  >
                    <td className="p-3.5 pl-4 sm:pl-6">
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-xs font-black w-5 text-center",
                          idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : idx === 2 ? "text-amber-700" : "text-slate-400"
                        )}>
                          {idx + 1}
                        </span>
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <JerseyPlayerImage 
                            player={stat.player!} 
                            franchiseId={stat.team?.id || null}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {stat.player!.name}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            {stat.team && (
                              <img 
                                src={resolveTeamLogoUrl(stat.team.shortName)} 
                                alt={stat.team.shortName} 
                                className="w-3.5 h-3.5 object-contain" 
                              />
                            )}
                            {stat.team?.shortName || 'FREE AGENT'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.matches}</td>
                    
                    {activeTab === 'BATTING' ? (
                      <>
                        <td className="p-3.5 text-center text-sm font-black text-slate-900 tabular-nums">{stat.runs}</td>
                        <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.average.toFixed(1)}</td>
                        <td className="p-3.5 text-center text-xs font-bold text-slate-800 tabular-nums">{stat.strikeRate?.toFixed(1) || '0.0'}</td>
                        <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.highScore}</td>
                        <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.fours || 0}</td>
                        <td className="p-3.5 pr-4 sm:pr-6 text-center text-xs font-bold text-purple-700 tabular-nums">{stat.sixes || 0}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-3.5 text-center text-sm font-black text-slate-900 tabular-nums">{stat.wickets}</td>
                        <td className="p-3.5 text-center text-xs font-bold text-slate-800 tabular-nums">{stat.economy?.toFixed(2) || '0.00'}</td>
                        <td className="p-3.5 text-center text-xs font-medium text-slate-600 tabular-nums">{stat.bowlingAverage.toFixed(1)}</td>
                        <td className="p-3.5 pr-4 sm:pr-6 text-center text-xs font-bold text-purple-700 tabular-nums">{stat.bestBowling || '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-xs font-medium text-slate-400">
                    No stats available yet. Simulate matches to generate official tournament data.
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
