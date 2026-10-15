import React, { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { QualificationEngine, QualificationAnalysisResult } from '../../engine/analytics/QualificationEngine';
import { Trophy, TrendingUp, AlertCircle, CheckCircle2, XCircle, Zap, ShieldCheck } from 'lucide-react';
import { cn } from '../../lib/utils';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';

export default function QualificationTab() {
  const { standings, fixtures, franchises, players, selectedFormat } = useGameStore();
  const [filter, setFilter] = useState<'ALL' | 'CONTENDERS' | 'QUALIFIED' | 'ELIMINATED'>('ALL');

  // Compute qualification projections using the Monte Carlo engine
  const analysis: QualificationAnalysisResult = useMemo(() => {
    return QualificationEngine.calculateProbabilities(
      standings,
      fixtures,
      franchises,
      players,
      {
        numSimulations: 1000,
        targetTopN: 4,
        safeCutoff: selectedFormat === 'IPL' ? 16 : 14,
      }
    );
  }, [standings, fixtures, franchises, players, selectedFormat]);

  const { projections, bracket, totalSimulations } = analysis;

  const qualifiedCount = projections.filter(p => p.status === 'QUALIFIED').length;
  const eliminatedCount = projections.filter(p => p.status === 'ELIMINATED').length;
  const contentionCount = projections.filter(p => p.status === 'CONTENTION').length;

  const filteredProjections = useMemo(() => {
    if (filter === 'CONTENDERS') return projections.filter(p => p.status === 'CONTENTION');
    if (filter === 'QUALIFIED') return projections.filter(p => p.status === 'QUALIFIED');
    if (filter === 'ELIMINATED') return projections.filter(p => p.status === 'ELIMINATED');
    return projections;
  }, [projections, filter]);

  const getProbColor = (prob: number) => {
    if (prob >= 80) return 'bg-emerald-500';
    if (prob >= 45) return 'bg-blue-600';
    if (prob >= 15) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getProbTextColor = (prob: number) => {
    if (prob >= 80) return 'text-emerald-700';
    if (prob >= 45) return 'text-blue-700';
    if (prob >= 15) return 'text-amber-700';
    return 'text-rose-700';
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 sm:p-6 font-sans">
      
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER & SIMULATION STATS BANNER
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800">
                Playoff Analytics
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Monte Carlo Model ({totalSimulations.toLocaleString()} runs)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Qualification & Playoff Probability
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Real-time projection simulating all remaining league matches based on current standings, squad balance, and net run rate permutations.
            </p>
          </div>

          {/* Quick Counter Pills */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-center">
              <div className="text-xs font-black text-emerald-800 tabular-nums">{qualifiedCount}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">Qualified</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200/80 text-center">
              <div className="text-xs font-black text-blue-800 tabular-nums">{contentionCount}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600">Contending</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
              <div className="text-xs font-black text-slate-700 tabular-nums">{eliminatedCount}</div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Eliminated</div>
            </div>
          </div>
        </div>

        {/* Benchmark Info Bar */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Safe Qualification Cutoff: <strong className="text-slate-900 font-bold">{bracket?.safeCutoffPoints || 16} Pts</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Remaining League Matches: <strong className="text-slate-900 font-bold">{bracket?.totalRemainingMatches || 0}</strong></span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. PROJECTED PLAYOFF BRACKET CARD
      ───────────────────────────────────────────────────────────────── */}
      {bracket && (
        <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-5 text-white shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">Projected Playoff Matchups</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/80">
              Top 4 Final Projections
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Qualifier 1 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400 uppercase tracking-wide">Qualifier 1 (Rank 1 vs Rank 2)</span>
                <span className="text-[10px] font-semibold text-white/70">{bracket.qualifier1.confidence}% Probability</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <img 
                    src={resolveTeamLogoUrl(bracket.qualifier1.team1?.shortName)} 
                    alt={bracket.qualifier1.team1?.name} 
                    className="w-7 h-7 object-contain" 
                  />
                  <span className="text-sm font-bold">{bracket.qualifier1.team1?.shortName || 'TBD'}</span>
                </div>
                <span className="text-xs font-black text-amber-400">VS</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{bracket.qualifier1.team2?.shortName || 'TBD'}</span>
                  <img 
                    src={resolveTeamLogoUrl(bracket.qualifier1.team2?.shortName)} 
                    alt={bracket.qualifier1.team2?.name} 
                    className="w-7 h-7 object-contain" 
                  />
                </div>
              </div>
              <p className="text-[10px] text-white/60">Winner advances directly to the Grand Final. Loser plays Qualifier 2.</p>
            </div>

            {/* Eliminator */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 backdrop-blur-sm space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-blue-300 uppercase tracking-wide">Eliminator (Rank 3 vs Rank 4)</span>
                <span className="text-[10px] font-semibold text-white/70">{bracket.eliminator.confidence}% Probability</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <img 
                    src={resolveTeamLogoUrl(bracket.eliminator.team1?.shortName)} 
                    alt={bracket.eliminator.team1?.name} 
                    className="w-7 h-7 object-contain" 
                  />
                  <span className="text-sm font-bold">{bracket.eliminator.team1?.shortName || 'TBD'}</span>
                </div>
                <span className="text-xs font-black text-blue-300">VS</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{bracket.eliminator.team2?.shortName || 'TBD'}</span>
                  <img 
                    src={resolveTeamLogoUrl(bracket.eliminator.team2?.shortName)} 
                    alt={bracket.eliminator.team2?.name} 
                    className="w-7 h-7 object-contain" 
                  />
                </div>
              </div>
              <p className="text-[10px] text-white/60">Winner plays in Qualifier 2. Loser is eliminated from the tournament.</p>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          3. QUALIFICATION PROBABILITY TABLE & CARDS
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        
        {/* Filter Pills Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['ALL', 'CONTENDERS', 'QUALIFIED', 'ELIMINATED'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all",
                  filter === tab
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tab === 'ALL' ? 'All Teams' : tab}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 font-medium self-end sm:self-center">
            {filteredProjections.length} Teams Listed
          </span>
        </div>

        {/* Projections Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                <th className="py-3 pl-4 sm:pl-6 w-12 text-center">Rank</th>
                <th className="py-3 px-3 min-w-[200px]">Team</th>
                <th className="py-3 px-2 w-12 text-center font-bold">P</th>
                <th className="py-3 px-2 w-12 text-center font-bold">Pts</th>
                <th className="py-3 px-2 w-16 text-center font-bold">NRR</th>
                <th className="py-3 px-4 min-w-[220px]">Playoff Probability</th>
                <th className="py-3 px-3 w-28 text-center font-bold">Top 2 %</th>
                <th className="py-3 px-3 w-28 text-center font-bold">Pts Needed</th>
                <th className="py-3 pr-4 sm:pr-6 w-32 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjections.map((p) => {
                const prob = p.qualificationProbability;

                return (
                  <tr key={p.teamId} className="hover:bg-slate-50/70 transition-colors">
                    
                    {/* Rank */}
                    <td className="py-3.5 pl-4 sm:pl-6 text-center">
                      <span className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black",
                        p.currentRank <= 4 ? "bg-blue-100 text-blue-700" : "text-slate-400 bg-slate-100"
                      )}>
                        {p.currentRank}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={resolveTeamLogoUrl(p.shortName)} 
                          alt={p.teamName} 
                          className="w-7 h-7 object-contain shrink-0" 
                        />
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            {p.teamName}
                            {p.status === 'QUALIFIED' && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            )}
                            {p.status === 'ELIMINATED' && (
                              <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {p.remainingMatches} matches remaining
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Played */}
                    <td className="py-3.5 px-2 text-center text-slate-600 font-semibold tabular-nums">
                      {p.played}
                    </td>

                    {/* Points */}
                    <td className="py-3.5 px-2 text-center font-black text-slate-900 tabular-nums">
                      {p.currentPoints}
                    </td>

                    {/* NRR */}
                    <td className="py-3.5 px-2 text-center text-slate-600 font-mono text-[11px] tabular-nums">
                      {p.currentNRR > 0 ? `+${p.currentNRR}` : p.currentNRR}
                    </td>

                    {/* Probability Progress Bar */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn("font-black tabular-nums", getProbTextColor(prob))}>
                            {prob.toFixed(1)}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Max {p.maxPossiblePoints} Pts
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all duration-500", getProbColor(prob))} 
                            style={{ width: `${Math.max(2, prob)}%` }} 
                          />
                        </div>
                      </div>
                    </td>

                    {/* Top 2 Probability */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 tabular-nums">
                        {p.top2Probability.toFixed(1)}%
                      </span>
                    </td>

                    {/* Pts Needed */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={cn(
                        "text-xs font-bold tabular-nums",
                        p.pointsNeededSafe === 0 ? "text-emerald-600" : "text-slate-700"
                      )}>
                        {p.pointsNeededSafe === 0 ? 'Achieved' : `${p.pointsNeededSafe} pts`}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 pr-4 sm:pr-6 text-center">
                      {p.status === 'QUALIFIED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Qualified
                        </span>
                      ) : p.status === 'ELIMINATED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800">
                          <XCircle className="w-3 h-3" />
                          Eliminated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-800">
                          <AlertCircle className="w-3 h-3" />
                          Contending
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
