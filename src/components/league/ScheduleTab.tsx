import React from 'react';
import { Franchise, useGameStore, GameState } from '../../stores/useGameStore';
import { MatchStatus, Fixture } from '../../types/match';
import { Play, CheckCircle2, FastForward, Lock, Calendar, MapPin, Eye, Trophy, Radio, CircleDot, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getIntlTeamLogoUrl } from '../../data/crexIntlTeams';
import {
  getFixtureProgress,
  getSeasonSummary,
  getNextUserFixture,
  canStartFixture,
  type FixtureProgress,
} from '../../engine/competition/seasonProgression';

interface ScheduleTabProps {
  franchises: Franchise[];
}

const IPL_TEAM_LOGOS: Record<string, string> = {
  MI: 'https://cricketvectors.akamaized.net/Teams/F.png',
  CSK: 'https://cricketvectors.akamaized.net/Teams/G.png',
  RCB: 'https://cricketvectors.akamaized.net/Teams/K.png',
  KKR: 'https://cricketvectors.akamaized.net/Teams/J.png',
  GT: 'https://cricketvectors.akamaized.net/Teams/KB.png',
  RR: 'https://cricketvectors.akamaized.net/Teams/M.png',
  DC: 'https://cricketvectors.akamaized.net/Teams/H.png',
  LSG: 'https://cricketvectors.akamaized.net/Teams/KC.png',
  SRH: 'https://cricketvectors.akamaized.net/Teams/L.png',
  PBKS: 'https://cricketvectors.akamaized.net/Teams/I.png',
};

function resolveLogo(shortName?: string, defaultLogo?: string): string {
  if (!shortName) return defaultLogo || '';
  return getIntlTeamLogoUrl(shortName) || IPL_TEAM_LOGOS[shortName] || defaultLogo || '';
}

export default function ScheduleTab({ franchises }: ScheduleTabProps) {
  const {
    fixtures,
    setCurrentMatch,
    setGameState,
    setViewingMatch,
    selectedFranchiseId,
    startMatch,
    autoSimulateMatch,
    generatePlayoffFixtures,
    generateSeasonFixtures,
  } = useGameStore();

  React.useEffect(() => {
    if (fixtures.length === 0) {
      generateSeasonFixtures();
    }
  }, [fixtures.length, generateSeasonFixtures]);

  const summary = React.useMemo(() => getSeasonSummary(fixtures), [fixtures]);
  const currentDay = summary.currentMatchDay;

  const handleStartMatch = (matchId: string) => {
    if (!startMatch(matchId)) return;
    setGameState(GameState.PRE_MATCH);
  };

  const handleWatchMatch = (matchId: string) => {
    if (!startMatch(matchId)) return;
    setGameState(GameState.MATCH_SIMULATION);
  };

  const handleViewMatch = (matchId: string) => {
    // Completed fixtures are view-only: open the read-only scorecard instead
    // of re-entering the simulation (which would allow a replay).
    setViewingMatch(matchId);
    setGameState(GameState.MATCH_RESULT);
  };

  const handleAutoSimulate = (matchId: string) => {
    autoSimulateMatch(matchId);
  };

  const progressOf = React.useCallback(
    (fixture: Fixture): FixtureProgress =>
      getFixtureProgress(fixture, fixtures, selectedFranchiseId),
    [fixtures, selectedFranchiseId],
  );

  const nextUserFixture = React.useMemo(
    () => getNextUserFixture(fixtures, selectedFranchiseId),
    [fixtures, selectedFranchiseId],
  );

  const playableAiFixtures = React.useMemo(
    () => fixtures.filter((f) => {
      const p = getFixtureProgress(f, fixtures, selectedFranchiseId);
      return p.state === 'PLAYABLE' && !p.isUserFixture;
    }),
    [fixtures, selectedFranchiseId],
  );

  const isSeasonComplete = fixtures.length > 0 && summary.remaining === 0;

  const handleContinueSeason = () => {
    if (nextUserFixture) {
      handleStartMatch(nextUserFixture.id);
      return;
    }
    if (playableAiFixtures.length > 0) {
      playableAiFixtures.forEach((f) => autoSimulateMatch(f.id));
    }
  };

  const totalLeague = fixtures.filter((f) => !f.isPlayoff).length;
  const isLeagueComplete =
    totalLeague > 0 &&
    fixtures.filter(
      (f) =>
        !f.isPlayoff &&
        (f.status === MatchStatus.COMPLETED || f.status === MatchStatus.ABANDONED),
    ).length === totalLeague;
  const hasPlayoffs = fixtures.some((f) => f.isPlayoff);

  const fixturesByDay = fixtures.reduce<Record<number, Fixture[]>>((acc, fixture) => {
    const day = fixture.day;
    if (!acc[day]) acc[day] = [];
    acc[day].push(fixture);
    return acc;
  }, {});

  const sortedDays = Object.keys(fixturesByDay)
    .map(Number)
    .sort((a, b) => a - b);

  const progressPct = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className="space-y-4 pb-20">
      {/* Season progression header */}
      {fixtures.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-black text-slate-900">
                  {isSeasonComplete ? 'Season Complete' : currentDay && currentDay >= 999 ? 'Playoff Stage' : `Match Day ${currentDay ?? '-'}`}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                {summary.completed} of {summary.total} fixtures resolved
                {nextUserFixture && <span className="text-blue-600"> · your team is up next</span>}
              </p>
            </div>

            {!isSeasonComplete && (nextUserFixture || playableAiFixtures.length > 0) && (
              <button
                onClick={handleContinueSeason}
                className={cn(
                  'px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-2 cursor-pointer active:scale-95',
                  nextUserFixture
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-slate-900 hover:bg-slate-800 text-white',
                )}
              >
                {nextUserFixture ? (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" /> Play Next Match
                  </>
                ) : (
                  <>
                    <FastForward className="w-3.5 h-3.5" /> Continue Season
                    <span className="opacity-70">({playableAiFixtures.length})</span>
                  </>
                )}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {fixtures.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm font-bold">
          No fixtures generated yet.
        </div>
      )}

      {isLeagueComplete && !hasPlayoffs && (
        <div className="flex justify-center py-2">
          <button
            onClick={generatePlayoffFixtures}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Trophy className="w-4 h-4" /> Generate Playoffs
          </button>
        </div>
      )}

      {sortedDays.map((day) => {
        const dayFixtures = fixturesByDay[day];
        const allCompleted = dayFixtures.every((f) => progressOf(f).state === 'COMPLETED');
        const isCurrentDay = day === currentDay;
        const isLockedDay = !allCompleted && !isCurrentDay;

        return (
          <div key={day} className="space-y-2.5">
            {/* Day Header Divider */}
            <div className={cn('flex items-center gap-3 px-1 py-1', isLockedDay && 'opacity-60')}>
              <div
                className={cn('h-px flex-1', isCurrentDay ? 'bg-blue-500/40' : 'bg-slate-200')}
              />
              <span
                className={cn(
                  'text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 px-2.5 py-0.5 rounded-full',
                  isCurrentDay
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs'
                    : allCompleted
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {day >= 999 ? 'Playoff Stage' : `Day ${day}`}
                {isCurrentDay && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                )}
                {isLockedDay && <Lock className="w-3 h-3 text-slate-400" />}
                {allCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
              </span>
              <div
                className={cn('h-px flex-1', isCurrentDay ? 'bg-blue-500/40' : 'bg-slate-200')}
              />
            </div>

            {/* Match Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {dayFixtures.map((fixture) => {
                const team1 = franchises.find((f) => f.id === fixture.team1Id);
                const team2 = franchises.find((f) => f.id === fixture.team2Id);
                if (!team1 || !team2) return null;

                const progress = progressOf(fixture);
                const isCompleted = progress.state === 'COMPLETED';
                const isLive = progress.state === 'LIVE';
                const isPlayable = progress.state === 'PLAYABLE';
                const isLocked = progress.state === 'LOCKED';
                const isMyMatch = progress.isUserFixture;
                const canStart = canStartFixture(fixture, fixtures, selectedFranchiseId).allowed;
                const isNoResult = fixture.scorecard?.result === 'NO_RESULT';

                const team1Logo = resolveLogo(team1.shortName, team1.logo);
                const team2Logo = resolveLogo(team2.shortName, team2.logo);

                const inn1 = fixture.scorecard?.innings?.[0];
                const inn2 = fixture.scorecard?.innings?.[1];

                return (
                  <div
                    key={fixture.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all bg-white relative flex flex-col justify-between space-y-3',
                      isPlayable && isMyMatch
                        ? 'border-blue-600 shadow-sm ring-1 ring-blue-600/30'
                        : isLive
                        ? 'border-rose-300 shadow-sm ring-1 ring-rose-300/40'
                        : isPlayable
                        ? 'border-blue-300 shadow-xs'
                        : isCompleted
                        ? 'border-slate-200/90 shadow-xs'
                        : 'border-slate-200 opacity-70'
                    )}
                  >
                    {/* Header: Match #, Format, Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {fixture.format || 'T20'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          {fixture.isPlayoff ? fixture.playoffType : `Match ${fixture.matchNumber}`}
                        </span>
                      </div>

                      {isCompleted ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {isNoResult ? 'No Result' : 'Done'}
                        </span>
                      ) : isLive ? (
                        <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1 animate-pulse">
                          <Radio className="w-3 h-3" /> Live
                        </span>
                      ) : isPlayable ? (
                        <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CircleDot className="w-3 h-3" /> Eligible
                        </span>
                      ) : (
                        <span
                          className="text-[10px] font-bold text-slate-400 flex items-center gap-1"
                          title={progress.lockedReason}
                        >
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>

                    {/* Teams row */}
                    <div className="space-y-2 py-1">
                      {/* Team 1 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {team1Logo ? (
                            <img
                              src={team1Logo}
                              alt={team1.shortName}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                              {team1.shortName?.[0]}
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {team1.name}
                          </span>
                        </div>
                        {inn1 && (
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-slate-900 tabular-nums">
                              {inn1.runs}/{inn1.wickets}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1 tabular-nums">
                              ({inn1.overs}.{inn1.balls})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Team 2 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {team2Logo ? (
                            <img
                              src={team2Logo}
                              alt={team2.shortName}
                              className="w-7 h-7 object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                              {team2.shortName?.[0]}
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {team2.name}
                          </span>
                        </div>
                        {inn2 && (
                          <div className="text-right shrink-0">
                            <span className="text-xs font-black text-slate-900 tabular-nums">
                              {inn2.runs}/{inn2.wickets}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1 tabular-nums">
                              ({inn2.overs}.{inn2.balls})
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer: venue/result + actions */}
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {isCompleted ? (
                          <p className="text-[10px] font-bold text-emerald-700 truncate">
                            {isNoResult
                              ? 'No Result'
                              : fixture.scorecard?.margin ||
                                (fixture.scorecard?.winnerId
                                  ? `${franchises.find((f) => f.id === fixture.scorecard?.winnerId)?.shortName ?? ''} won`
                                  : 'Result')}
                          </p>
                        ) : (
                          <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 truncate">
                            <MapPin className="w-2.5 h-2.5" /> {fixture.venue || 'Cricket Stadium'}
                          </p>
                        )}
                        {isLocked && progress.lockedReason && (
                          <p className="text-[10px] font-semibold text-amber-600 truncate mt-0.5">
                            {progress.lockedReason}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isCompleted ? (
                          <button
                            onClick={() => handleViewMatch(fixture.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Result
                          </button>
                        ) : !canStart ? (
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        ) : isLive ? (
                          <button
                            onClick={() => handleWatchMatch(fixture.id)}
                            className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Radio className="w-3 h-3" /> {isMyMatch ? 'Resume' : 'Watch Live'}
                          </button>
                        ) : isMyMatch ? (
                          <button
                            onClick={() => handleStartMatch(fixture.id)}
                            className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            <Play className="w-3 h-3 fill-current" /> Play Match
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleWatchMatch(fixture.id)}
                              title="Watch this AI match play out ball by ball"
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5" /> Watch
                            </button>
                            <button
                              onClick={() => handleAutoSimulate(fixture.id)}
                              title="Instantly simulate this AI match"
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <FastForward className="w-3.5 h-3.5" /> Skip
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isLocked && progress.lockedReason && (
                      <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> {progress.lockedReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
