import React from 'react';
import { Franchise, useGameStore, GameState } from '../../stores/useGameStore';
import { MatchStatus, Fixture, SeriesFormat } from '../../types/match';
import { Play, CheckCircle2, FastForward, Eye, Plus, X, Trophy, Settings2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getIntlTeamLogoUrl } from '../../data/crexIntlTeams';

interface SeriesTabProps {
  franchises: Franchise[];
}

const FORMAT_OPTIONS: SeriesFormat[] = ['T20', 'ODI', 'TEST'];
const MATCH_COUNTS = [1, 2, 3, 4, 5, 6, 7];

function teamLogo(shortName?: string, fallback?: string): string {
  if (!shortName) return fallback || '';
  return getIntlTeamLogoUrl(shortName) || fallback || '';
}

function TeamBadge({ team }: { team?: Franchise }) {
  if (!team) return <div className="w-7 h-7 rounded-full bg-slate-100" />;
  const logo = teamLogo(team.shortName, team.logo);
  return logo ? (
    <img src={logo} alt={team.shortName} className="w-7 h-7 object-contain shrink-0" />
  ) : (
    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
      {team.shortName?.[0]}
    </div>
  );
}

export default function SeriesTab({ franchises }: SeriesTabProps) {
  const {
    seriesConfig,
    fixtures,
    standings,
    selectedFranchiseId,
    createSeries,
    clearSeries,
    setCurrentMatch,
    setGameState,
    autoSimulateMatch,
  } = useGameStore();

  const [format, setFormat] = React.useState<SeriesFormat>('T20');
  const [team1Id, setTeam1Id] = React.useState<string>('');
  const [team2Id, setTeam2Id] = React.useState<string>('');
  const [matchCount, setMatchCount] = React.useState<number>(3);
  const [name, setName] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);

  const canCreate = team1Id && team2Id && team1Id !== team2Id && matchCount >= 1;

  const handleCreate = () => {
    try {
      setError(null);
      createSeries({
        format,
        team1Id,
        team2Id,
        matchCount,
        name: name.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create series');
    }
  };

  const handleStartMatch = (matchId: string) => {
    setCurrentMatch(matchId);
    setGameState(GameState.PRE_MATCH);
  };

  const handleViewMatch = (matchId: string) => {
    setCurrentMatch(matchId);
    setGameState(GameState.MATCH_SIMULATION);
  };

  // ── Setup screen ────────────────────────────────────────────────────────────
  if (!seriesConfig) {
    return (
      <div className="space-y-4 pb-20">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs">
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-blue-600" /> Create a Bilateral Series
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pick two teams and a format. The fixture list and points table are generated for you.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          {/* Format */}
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Format</label>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer',
                    format === f
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300',
                  )}
                >
                  {f === 'TEST' ? 'Test' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Home Team</label>
              <select
                value={team1Id}
                onChange={(e) => setTeam1Id(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Select team…</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id} disabled={f.id === team2Id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Away Team</label>
              <select
                value={team2Id}
                onChange={(e) => setTeam2Id(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Select team…</option>
                {franchises.map((f) => (
                  <option key={f.id} value={f.id} disabled={f.id === team1Id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Length + name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Number of Matches</label>
              <div className="flex flex-wrap gap-1.5">
                {MATCH_COUNTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setMatchCount(n)}
                    className={cn(
                      'w-9 h-9 rounded-xl text-xs font-black border transition-all cursor-pointer',
                      matchCount === n
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Series Name (optional)</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={format === 'TEST' ? 'e.g. The Ashes' : 'e.g. India tour of Australia'}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className={cn(
              'w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all',
              canCreate
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-[0.99] cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            )}
          >
            <Plus className="w-4 h-4" /> Create Series
          </button>
        </div>
      </div>
    );
  }

  // ── Active series ───────────────────────────────────────────────────────────
  const isTest = seriesConfig.format === 'TEST';
  const team1 = franchises.find((f) => f.id === seriesConfig.team1Id);
  const team2 = franchises.find((f) => f.id === seriesConfig.team2Id);

  const upcoming = fixtures.filter((f) => f.status === MatchStatus.UPCOMING);
  const currentDay = upcoming.length > 0 ? Math.min(...upcoming.map((f) => f.day)) : -1;
  const isPlayable = (f: Fixture) => f.status === MatchStatus.UPCOMING && f.day === currentDay;

  const sortedStandings = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (isTest && (b.pct ?? 0) !== (a.pct ?? 0)) return (b.pct ?? 0) - (a.pct ?? 0);
    return b.nrr - a.nrr;
  });

  const completedCount = fixtures.filter((f) => f.status === MatchStatus.COMPLETED).length;
  const isComplete = completedCount >= seriesConfig.matchCount;
  const leader = sortedStandings[0];

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-3">
            <TeamBadge team={team1} />
            <TeamBadge team={team2} />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              {seriesConfig.name}
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {seriesConfig.format}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {completedCount}/{seriesConfig.matchCount} matches played
              {isComplete && leader && ` · ${leader.teamId === seriesConfig.team1Id ? team1?.name : team2?.name} lead the series`}
            </p>
          </div>
        </div>
        <button
          onClick={clearSeries}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 self-start sm:self-center cursor-pointer"
        >
          <X className="w-3.5 h-3.5" /> New Series
        </button>
      </div>

      {/* Series points table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            {isTest ? 'World Test Championship Points' : 'Series Points Table'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-10">Pos</th>
                <th className="py-2.5 px-3">Team</th>
                <th className="py-2.5 px-2 text-center w-10">P</th>
                <th className="py-2.5 px-2 text-center w-10">W</th>
                <th className="py-2.5 px-2 text-center w-10">L</th>
                {isTest && <th className="py-2.5 px-2 text-center w-10">D</th>}
                <th className="py-2.5 px-2 text-center w-14 font-black text-slate-800">PTS</th>
                {isTest ? (
                  <th className="py-2.5 px-2 text-center w-16 font-black text-blue-700">PCT%</th>
                ) : (
                  <th className="py-2.5 px-2 text-center w-20 font-bold">NRR</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedStandings.map((s, idx) => {
                const team = franchises.find((f) => f.id === s.teamId);
                return (
                  <tr key={s.teamId} className={cn('hover:bg-slate-50/70', idx === 0 && 'bg-blue-50/20')}>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black tabular-nums',
                          idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamBadge team={team} />
                        <span className="font-bold text-slate-900 truncate">{team?.name || s.teamId}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-semibold text-slate-500 tabular-nums">{s.played}</td>
                    <td className="py-2.5 px-2 text-center font-bold text-emerald-700 tabular-nums">{s.won}</td>
                    <td className="py-2.5 px-2 text-center font-medium text-rose-600 tabular-nums">{s.lost}</td>
                    {isTest && (
                      <td className="py-2.5 px-2 text-center font-medium text-slate-500 tabular-nums">{s.drawn || 0}</td>
                    )}
                    <td className="py-2.5 px-2 text-center font-black text-slate-900 tabular-nums text-sm">{s.points}</td>
                    {isTest ? (
                      <td className="py-2.5 px-2 text-center font-black text-blue-700 tabular-nums">
                        {(s.pct ?? 0).toFixed(1)}%
                      </td>
                    ) : (
                      <td
                        className={cn(
                          'py-2.5 px-2 text-center font-bold tabular-nums',
                          s.nrr > 0 ? 'text-emerald-700' : s.nrr < 0 ? 'text-rose-600' : 'text-slate-400',
                        )}
                      >
                        {s.nrr > 0 ? `+${s.nrr.toFixed(3)}` : s.nrr.toFixed(3)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fixtures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fixtures.map((fixture) => {
          const fTeam1 = franchises.find((f) => f.id === fixture.team1Id);
          const fTeam2 = franchises.find((f) => f.id === fixture.team2Id);
          const playable = isPlayable(fixture);
          const isMyMatch =
            fixture.team1Id === selectedFranchiseId || fixture.team2Id === selectedFranchiseId;
          const completed = fixture.status === MatchStatus.COMPLETED;
          const innings = fixture.scorecard?.innings ?? [];

          return (
            <div
              key={fixture.id}
              className={cn(
                'p-4 rounded-2xl border bg-white flex flex-col justify-between space-y-3 transition-all',
                playable && isMyMatch
                  ? 'border-blue-600 shadow-sm ring-1 ring-blue-600/30'
                  : playable
                  ? 'border-blue-300 shadow-xs'
                  : completed
                  ? 'border-slate-200/90 shadow-xs'
                  : 'border-slate-200 opacity-60',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  Match {fixture.matchNumber}
                </span>
                {completed ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Done
                  </span>
                ) : playable ? (
                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md animate-pulse">
                    Active
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400">Upcoming</span>
                )}
              </div>

              <div className="space-y-2">
                {[fTeam1, fTeam2].map((team, i) => {
                  const teamId = i === 0 ? fixture.team1Id : fixture.team2Id;
                  const rowInnings = innings.filter((inn) => inn.battingTeamId === teamId);
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TeamBadge team={team} />
                        <span className="text-xs font-bold text-slate-900 truncate">{team?.name || teamId}</span>
                      </div>
                      {rowInnings.length > 0 && (
                        <div className="text-right shrink-0 text-xs font-black text-slate-900 tabular-nums">
                          {rowInnings.map((inn, k) => (
                            <div key={k}>
                              {inn.runs}/{inn.wickets}
                              {inn.declared && <span className="text-slate-400">d</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                  {completed && fixture.scorecard?.margin ? (
                    <span className="font-bold text-emerald-700">{fixture.scorecard.margin}</span>
                  ) : (
                    fixture.venue || 'Cricket Stadium'
                  )}
                </div>
                <div>
                  {completed ? (
                    <button
                      onClick={() => handleViewMatch(fixture.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Scorecard
                    </button>
                  ) : playable ? (
                    isMyMatch ? (
                      <button
                        onClick={() => handleStartMatch(fixture.id)}
                        className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Play className="w-3 h-3 fill-current" /> Play Match
                      </button>
                    ) : (
                      <button
                        onClick={() => autoSimulateMatch(fixture.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <FastForward className="w-3.5 h-3.5" /> Auto Sim
                      </button>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">Scheduled</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
