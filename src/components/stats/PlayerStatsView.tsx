import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../lib/utils';
import JerseyPlayerImage from '../JerseyPlayerImage';

type SortKey = 'runs' | 'strikeRate' | 'average' | 'highScore' | 'fours' | 'sixes' | 'wickets' | 'economy' | 'bowlingAverage' | 'matches';

export default function PlayerStatsView() {
  const { playerSeasonStats, players, franchises } = useGameStore();
  const [activeTab, setActiveTab] = useState<'BATTING' | 'BOWLING'>('BATTING');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('runs');
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true); // default to descending for stats
    }
  };

  const getTeamForPlayer = (playerId: string) => {
    return franchises.find(f => f.squad.includes(playerId));
  };

  const statsList = Object.values(playerSeasonStats).map(stat => {
    const player = players.find(p => p.id === stat.playerId);
    const team = getTeamForPlayer(stat.playerId);
    
    const battingAvg = stat.matches > 0 ? (stat.runs / stat.matches) : 0; // Simplified. Ideally Runs / Dismissals
    const bowlingAvg = stat.wickets > 0 && stat.runsConceded ? (stat.runsConceded / stat.wickets) : 0;
    
    return {
      ...stat,
      player,
      team,
      average: battingAvg,
      bowlingAverage: bowlingAvg
    };
  }).filter(s => s.player && s.player.name.toLowerCase().includes(searchQuery.toLowerCase()));

  statsList.sort((a, b) => {
    const valA = (a as any)[sortKey] || 0;
    const valB = (b as any)[sortKey] || 0;
    return sortDesc ? valB - valA : valA - valB;
  });

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDesc ? <ChevronDown className="w-3 h-3 inline-block ml-1 text-emerald-400" /> : <ChevronUp className="w-3 h-3 inline-block ml-1 text-emerald-400" />;
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setActiveTab('BATTING'); setSortKey('runs'); setSortDesc(true); }}
            className={cn("px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'BATTING' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white')}
          >
            Batting
          </button>
          <button 
            onClick={() => { setActiveTab('BOWLING'); setSortKey('wickets'); setSortDesc(true); }}
            className={cn("px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'BOWLING' ? 'bg-white text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white')}
          >
            Bowling
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search players..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 bg-zinc-900 border border-zinc-800 rounded-full pl-10 pr-4 py-2 text-xs font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950 border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                <th className="p-4 pl-6 font-semibold min-w-[250px]">Player</th>
                <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('matches')}>M {renderSortIcon('matches')}</th>
                
                {activeTab === 'BATTING' ? (
                  <>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('runs')}>Runs {renderSortIcon('runs')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('average')}>Avg {renderSortIcon('average')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('strikeRate')}>SR {renderSortIcon('strikeRate')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('highScore')}>HS {renderSortIcon('highScore')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('fours')}>4s {renderSortIcon('fours')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('sixes')}>6s {renderSortIcon('sixes')}</th>
                  </>
                ) : (
                  <>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('wickets')}>Wkts {renderSortIcon('wickets')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('economy')}>Econ {renderSortIcon('economy')}</th>
                    <th className="p-4 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('bowlingAverage')}>Avg {renderSortIcon('bowlingAverage')}</th>
                    <th className="p-4">BBI</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {statsList.length > 0 ? (
                statsList.map((stat, idx) => (
                  <tr key={stat.playerId} className="hover:bg-zinc-800/30 transition-colors group">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-zinc-600 w-4">{idx + 1}</span>
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0">
                          <JerseyPlayerImage 
                            player={stat.player!} 
                            franchiseId={stat.team?.id || null}
                            className="w-full h-full"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">{stat.player!.name}</div>
                          <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{stat.team?.shortName || 'UNSOLD'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-medium text-zinc-300">{stat.matches}</td>
                    
                    {activeTab === 'BATTING' ? (
                      <>
                        <td className="p-4 text-sm font-black text-white">{stat.runs}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.average.toFixed(1)}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.strikeRate?.toFixed(1) || '0.0'}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.highScore}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.fours || 0}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.sixes || 0}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-sm font-black text-white">{stat.wickets}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.economy?.toFixed(2) || '0.00'}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.bowlingAverage.toFixed(1)}</td>
                        <td className="p-4 text-xs font-medium text-zinc-300">{stat.bestBowling || '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm font-medium text-zinc-500">
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
