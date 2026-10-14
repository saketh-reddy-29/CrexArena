import React from 'react';
import { Franchise, useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';
import { getIntlTeamLogoUrl } from '../../data/crexIntlTeams';

interface LeaderboardTabProps {
  franchises: Franchise[];
}

const IPL_TEAM_LOGOS: Record<string, string> = {
  MI:   'https://cricketvectors.akamaized.net/Teams/F.png',
  CSK:  'https://cricketvectors.akamaized.net/Teams/G.png',
  RCB:  'https://cricketvectors.akamaized.net/Teams/K.png',
  KKR:  'https://cricketvectors.akamaized.net/Teams/J.png',
  GT:   'https://cricketvectors.akamaized.net/Teams/KB.png',
  RR:   'https://cricketvectors.akamaized.net/Teams/M.png',
  DC:   'https://cricketvectors.akamaized.net/Teams/H.png',
  LSG:  'https://cricketvectors.akamaized.net/Teams/KC.png',
  SRH:  'https://cricketvectors.akamaized.net/Teams/L.png',
  PBKS: 'https://cricketvectors.akamaized.net/Teams/I.png',
};

function resolveLogo(shortName?: string, defaultLogo?: string): string {
  if (!shortName) return defaultLogo || '';
  return getIntlTeamLogoUrl(shortName) || IPL_TEAM_LOGOS[shortName] || defaultLogo || '';
}

export default function LeaderboardTab({ franchises }: LeaderboardTabProps) {
  const { standings, selectedFormat } = useGameStore();
  const isTest = (selectedFormat || '').toUpperCase() === 'TEST';
  
  const sortedStandings = [...standings].sort((a, b) => {
    if (isTest) {
      if ((b.pct ?? 0) !== (a.pct ?? 0)) return (b.pct ?? 0) - (a.pct ?? 0);
    }
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  
  return (
    <div className="space-y-4">
      {/* Points table card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Table Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 text-center w-10">Pos</th>
                <th className="py-3 px-3">Team</th>
                <th className="py-3 px-2 text-center w-12 font-bold">P</th>
                <th className="py-3 px-2 text-center w-12 font-bold">W</th>
                <th className="py-3 px-2 text-center w-12 font-bold">L</th>
                {isTest && <th className="py-3 px-2 text-center w-12 font-bold">D</th>}
                <th className="py-3 px-2 text-center w-14 font-black text-slate-800">PTS</th>
                {isTest ? (
                  <th className="py-3 px-2 text-center w-16 font-black text-blue-700">PCT%</th>
                ) : (
                  <th className="py-3 px-2 text-center w-20 font-bold">NRR</th>
                )}
                <th className="py-3 px-3 text-center w-28 hidden sm:table-cell">Recent Form</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStandings.map((s, idx) => {
                const team = franchises.find((f) => f.id === s.teamId);
                if (!team) return null;
                const isTop4 = idx < 4;
                const logo = resolveLogo(team.shortName, team.logo);

                return (
                  <tr
                    key={team.id}
                    className={cn(
                      'hover:bg-slate-50/70 transition-colors',
                      isTop4 && 'bg-blue-50/20'
                    )}
                  >
                    {/* Rank */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black tabular-nums',
                          isTop4
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {idx + 1}
                      </span>
                    </td>

                    {/* Team */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {logo ? (
                          <img
                            src={logo}
                            alt={team.shortName}
                            className="w-6 h-6 object-contain shrink-0"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-700">
                            {team.shortName?.[0]}
                          </div>
                        )}
                        <span className="font-bold text-slate-900 truncate">{team.name}</span>
                      </div>
                    </td>

                    {/* Played */}
                    <td className="py-3 px-2 text-center font-semibold text-slate-500 tabular-nums">
                      {s.played}
                    </td>

                    {/* Won */}
                    <td className="py-3 px-2 text-center font-bold text-emerald-700 tabular-nums">
                      {s.won}
                    </td>

                    {/* Lost */}
                    <td className="py-3 px-2 text-center font-medium text-rose-600 tabular-nums">
                      {s.lost}
                    </td>

                    {/* Drawn (for Tests) */}
                    {isTest && (
                      <td className="py-3 px-2 text-center font-medium text-slate-500 tabular-nums">
                        {s.drawn || 0}
                      </td>
                    )}

                    {/* Points */}
                    <td className="py-3 px-2 text-center font-black text-slate-900 tabular-nums text-sm">
                      {s.points}
                    </td>

                    {/* NRR or PCT */}
                    {isTest ? (
                      <td className="py-3 px-2 text-center font-black text-blue-700 tabular-nums">
                        {s.pct !== undefined ? `${s.pct.toFixed(1)}%` : '0.0%'}
                      </td>
                    ) : (
                      <td
                        className={cn(
                          'py-3 px-2 text-center font-bold tabular-nums text-xs',
                          s.nrr > 0
                            ? 'text-emerald-700'
                            : s.nrr < 0
                            ? 'text-rose-600'
                            : 'text-slate-400'
                        )}
                      >
                        {s.nrr > 0 ? `+${s.nrr.toFixed(3)}` : s.nrr.toFixed(3)}
                      </td>
                    )}

                    {/* Form Pills */}
                    <td className="py-3 px-3 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {s.form.length === 0 ? (
                          <span className="text-[10px] text-slate-300">--</span>
                        ) : (
                          s.form.map((res, fIdx) => (
                            <span
                              key={fIdx}
                              className={cn(
                                'w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center shadow-xs',
                                res === 'W'
                                  ? 'bg-emerald-600 text-white'
                                  : res === 'T'
                                  ? 'bg-amber-500 text-white'
                                  : res === 'D'
                                  ? 'bg-slate-400 text-white'
                                  : 'bg-rose-600 text-white'
                              )}
                            >
                              {res}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
        <div className="w-3 h-3 rounded-full bg-blue-600" />
        <span>Top 4 teams qualify for the Championship Playoffs</span>
      </div>
    </div>
  );
}
