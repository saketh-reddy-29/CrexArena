import React from 'react';
import { Franchise, useGameStore, GameState } from '../../stores/useGameStore';
import { MatchStatus, Fixture } from '../../types/match';
import { Play, CheckCircle2, FastForward, Lock } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ScheduleTabProps {
  franchises: Franchise[];
}

export default function ScheduleTab({ franchises }: ScheduleTabProps) {
  const { fixtures, setCurrentMatch, setGameState, selectedFranchiseId, autoSimulateMatch, generatePlayoffFixtures, generateSeasonFixtures } = useGameStore();

  React.useEffect(() => {
    if (fixtures.length === 0) {
      generateSeasonFixtures();
    }
  }, [fixtures.length, generateSeasonFixtures]);

  const handleStartMatch = (matchId: string) => {
    setCurrentMatch(matchId);
    setGameState(GameState.PRE_MATCH);
  };
  
  const handleAutoSimulate = (matchId: string) => {
    autoSimulateMatch(matchId);
  };

  const totalLeague = fixtures.filter(f => !f.isPlayoff).length;
  const isLeagueComplete = totalLeague > 0 && fixtures.filter(f => !f.isPlayoff && f.status === MatchStatus.COMPLETED).length === totalLeague;
  const hasPlayoffs = fixtures.some(f => f.isPlayoff);

  const upcomingFixtures = fixtures.filter(f => f.status === MatchStatus.UPCOMING);
  const currentDay = upcomingFixtures.length > 0
    ? Math.min(...upcomingFixtures.map(f => f.day))
    : -1;

  const isMatchPlayable = (fixture: Fixture) => {
    return fixture.status === MatchStatus.UPCOMING && fixture.day === currentDay;
  };

  const fixturesByDay = fixtures.reduce<Record<number, typeof fixtures>>((acc, fixture) => {
    const day = fixture.day;
    if (!acc[day]) acc[day] = [];
    acc[day].push(fixture);
    return acc;
  }, {});
  const sortedDays = Object.keys(fixturesByDay).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-4 pb-20">
        {fixtures.length === 0 && (
            <div className="premium-card p-8 text-center text-white/30 text-sm font-bold">
                No fixtures generated yet.
            </div>
        )}

        {isLeagueComplete && !hasPlayoffs && (
            <div className="flex justify-center py-4">
                <button 
                  onClick={generatePlayoffFixtures}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl btn-glow active:scale-95 transition-all"
                >
                  Generate Playoffs
                </button>
            </div>
        )}

        {sortedDays.map(day => {
            const dayFixtures = fixturesByDay[day];
            const allCompleted = dayFixtures.every(f => f.status === MatchStatus.COMPLETED);
            const isCurrentDay = day === currentDay;
            const isLockedDay = !allCompleted && !isCurrentDay;

            return (
                <div key={day} className="space-y-2">
                    {/* Day header */}
                    <div className={cn(
                        "flex items-center gap-2 px-1 py-1",
                        isLockedDay && "opacity-40"
                    )}>
                        <div className={cn(
                            "h-px flex-1",
                            isCurrentDay ? "bg-green-500/30" : "bg-white/[.06]"
                        )} />
                        <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                            isCurrentDay ? "text-cyan-300" : allCompleted ? "text-white/30" : "text-white/20"
                        )}>
                            {day >= 1000 ? 'Playoff' : `Day ${day}`}
                            {isCurrentDay && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/15 border border-cyan-500/25 text-cyan-300 font-bold">LIVE</span>
                            )}
                            {isLockedDay && <Lock className="w-3 h-3" />}
                            {allCompleted && <CheckCircle2 className="w-3 h-3" />}
                        </span>
                        <div className={cn(
                            "h-px flex-1",
                            isCurrentDay ? "bg-green-500/30" : "bg-white/[.06]"
                        )} />
                    </div>

                    {/* Match cards */}
                    {dayFixtures.map(fixture => {
                        const team1 = franchises.find(f => f.id === fixture.team1Id);
                        const team2 = franchises.find(f => f.id === fixture.team2Id);
                        if (!team1 || !team2) return null;
                        const playable = isMatchPlayable(fixture);
                        const isMyMatch = fixture.team1Id === selectedFranchiseId || fixture.team2Id === selectedFranchiseId;

                        return (
                            <div key={fixture.id} className={cn(
                                "premium-card p-3 sm:p-4 transition-all",
                                playable && "border-cyan-500/15 bg-[#0f1629]",
                                !playable && fixture.status !== MatchStatus.COMPLETED && "opacity-40"
                            )}>
                                {/* Match number + status row */}
                                <div className="flex items-center justify-between mb-2.5">
                                    <span className="text-[9px] font-bold text-white/30 uppercase">
                                        {fixture.isPlayoff ? fixture.playoffType : `Match ${fixture.matchNumber}`}
                                    </span>
                                    {fixture.status === MatchStatus.COMPLETED ? (
                                        <span className="text-[9px] font-bold text-cyan-300 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Done
                                        </span>
                                    ) : playable ? (
                                        <span className="text-[9px] font-bold text-cyan-300">Live Day</span>
                                    ) : (
                                        <span className="text-[9px] font-bold text-white/20 flex items-center gap-1">
                                            <Lock className="w-2.5 h-2.5" /> Locked
                                        </span>
                                    )}
                                </div>

                                {/* Teams row */}
                                <div className="flex items-center gap-3">
                                    {/* Team 1 */}
                                    <div className="flex-1 flex items-center gap-2.5 min-w-0">
                                        <img src={team1.logo} alt={team1.shortName} className="w-8 h-8 shrink-0 object-contain drop-shadow" />
                                        <span className="text-sm font-bold truncate">{team1.name}</span>
                                    </div>

                                    <span className="text-[10px] font-bold text-white/20 shrink-0">VS</span>

                                    {/* Team 2 */}
                                    <div className="flex-1 flex items-center gap-2.5 min-w-0 justify-end">
                                        <span className="text-sm font-bold truncate text-right">{team2.name}</span>
                                        <img src={team2.logo} alt={team2.shortName} className="w-8 h-8 shrink-0 object-contain drop-shadow" />
                                    </div>
                                </div>

                                {/* Action row */}
                                <div className="mt-3 flex items-center justify-between">
                                    {fixture.status === MatchStatus.COMPLETED ? (
                                        <div className="text-xs font-semibold text-cyan-300">
                                            {franchises.find(f => f.id === fixture.scorecard?.winnerId)?.shortName} Won
                                        </div>
                                    ) : (
                                        <div />
                                    )}

                                    {playable && (
                                        isMyMatch ? (
                                            <button 
                                                onClick={() => handleStartMatch(fixture.id)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg font-bold text-xs active:scale-95 transition-all btn-glow"
                                            >
                                                <Play className="w-3.5 h-3.5 fill-current" />
                                                PLAY
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleAutoSimulate(fixture.id)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/[.06] rounded-lg font-bold text-xs transition-all active:scale-95"
                                            >
                                                <FastForward className="w-3.5 h-3.5" />
                                                Simulate
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            );
        })}
    </div>
  );
}
