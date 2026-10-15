import React, { useState, useMemo } from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchStatus, Fixture } from '../types/match';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { cn } from '../lib/utils';
import { Clock, MapPin, ChevronRight, Play, Eye } from 'lucide-react';

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

function resolveTeamLogo(shortName?: string): string {
  if (!shortName) return '';
  return getIntlTeamLogoUrl(shortName) || IPL_TEAM_LOGOS[shortName] || '';
}

type FilterCategory = 'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED' | 'T20' | 'ODI' | 'TEST';

export default function TopMatchesCarousel() {
  const { fixtures, franchises, setCurrentMatch, setGameState, generateSeasonFixtures, currentMatchId } = useGameStore();
  const [filter, setFilter] = useState<FilterCategory>('ALL');

  React.useEffect(() => {
    if (fixtures.length === 0) {
      generateSeasonFixtures();
    }
  }, [fixtures.length, generateSeasonFixtures]);

  const teamById = useMemo(() => {
    const map = new Map<string, typeof franchises[0]>();
    franchises.forEach((f) => map.set(f.id, f));
    return map;
  }, [franchises]);

  const filteredFixtures = useMemo(() => {
    return fixtures.filter((f) => {
      if (filter === 'LIVE') return f.status === MatchStatus.LIVE;
      if (filter === 'UPCOMING') return f.status === MatchStatus.UPCOMING;
      if (filter === 'COMPLETED') return f.status === MatchStatus.COMPLETED;
      if (filter === 'T20') return f.format === 'T20' || (!f.format && true);
      if (filter === 'ODI') return f.format === 'ODI';
      if (filter === 'TEST') return f.format === 'TEST';
      return true; // ALL
    });
  }, [fixtures, filter]);

  const handleCardClick = (fixture: Fixture) => {
    setCurrentMatch(fixture.id);
    if (fixture.status === MatchStatus.COMPLETED || fixture.status === MatchStatus.LIVE) {
      setGameState(GameState.MATCH_SIMULATION);
    } else {
      setGameState(GameState.PRE_MATCH);
    }
  };

  const formatCountdown = (startTime?: number): string => {
    if (!startTime) return 'Starts soon';
    const now = Date.now();
    const diff = startTime - now;
    if (diff <= 0) return 'Scheduled today';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Starts in ${days}d ${hours % 24}h`;
    }
    return `Starts in ${hours}h ${mins}m`;
  };

  return (
    <div className="w-full bg-white border-b border-slate-200/90 py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-2.5">
        
        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
              Matches
            </span>
            {(['ALL', 'LIVE', 'UPCOMING', 'COMPLETED', 'T20', 'ODI', 'TEST'] as FilterCategory[]).map((cat) => {
              const count = fixtures.filter((f) => {
                if (cat === 'LIVE') return f.status === MatchStatus.LIVE;
                if (cat === 'UPCOMING') return f.status === MatchStatus.UPCOMING;
                if (cat === 'COMPLETED') return f.status === MatchStatus.COMPLETED;
                if (cat === 'T20') return f.format === 'T20';
                if (cat === 'ODI') return f.format === 'ODI';
                if (cat === 'TEST') return f.format === 'TEST';
                return true;
              }).length;

              const isActive = filter === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all shrink-0 flex items-center gap-1",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  )}
                >
                  {cat === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
                  {cat === 'ALL' ? 'Top Matches' : cat}
                  <span className={cn(
                    "text-[10px] px-1 py-0.2 rounded-full",
                    isActive ? "bg-blue-700/60 text-white" : "bg-slate-200/80 text-slate-500"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Carousel Cards Track */}
        <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-0.5 custom-scrollbar snap-x">
          {filteredFixtures.length === 0 ? (
            <div className="w-full text-center py-6 text-xs font-semibold text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No matches found for {filter} filter.
            </div>
          ) : (
            filteredFixtures.map((fixture) => {
              const team1 = teamById.get(fixture.team1Id);
              const team2 = teamById.get(fixture.team2Id);
              const isSelected = fixture.id === currentMatchId;
              const isLive = fixture.status === MatchStatus.LIVE;
              const isCompleted = fixture.status === MatchStatus.COMPLETED;

              const team1Logo = resolveTeamLogo(team1?.shortName);
              const team2Logo = resolveTeamLogo(team2?.shortName);

              const inn1 = fixture.scorecard?.innings?.[0];
              const inn2 = fixture.scorecard?.innings?.[1];

              return (
                <div
                  key={fixture.id}
                  onClick={() => handleCardClick(fixture)}
                  className={cn(
                    "snap-start shrink-0 w-[275px] sm:w-[295px] p-3 rounded-2xl border transition-all cursor-pointer bg-white relative flex flex-col justify-between group",
                    isSelected
                      ? "border-blue-600 shadow-md ring-1 ring-blue-600/30"
                      : "border-slate-200/90 shadow-xs hover:border-blue-300 hover:shadow-sm"
                  )}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "text-[9px] font-black uppercase px-1.5 py-0.5 rounded tracking-wide",
                          fixture.format === 'TEST'
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : fixture.format === 'ODI'
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        )}>
                          {fixture.format || 'T20'}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 truncate max-w-[120px]">
                          {fixture.isPlayoff ? fixture.playoffType : `Match ${fixture.matchNumber}`}
                        </span>
                      </div>

                      {/* Status Pill */}
                      {isLive ? (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase tracking-wider shadow-xs animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE
                        </span>
                      ) : isCompleted ? (
                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          COMPLETED
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">
                          UPCOMING
                        </span>
                      )}
                    </div>

                    {/* Teams and Scores */}
                    <div className="space-y-1.5 my-2">
                      {/* Team 1 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {team1Logo ? (
                            <img src={team1Logo} alt={team1?.shortName} className="w-5 h-5 object-contain shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                              {team1?.shortName?.[0] || 'T1'}
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {team1?.name || fixture.team1Id}
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
                        <div className="flex items-center gap-2 min-w-0">
                          {team2Logo ? (
                            <img src={team2Logo} alt={team2?.shortName} className="w-5 h-5 object-contain shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                              {team2?.shortName?.[0] || 'T2'}
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {team2?.name || fixture.team2Id}
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
                  </div>

                  {/* Card Footer */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400 truncate max-w-[190px]">
                      {isCompleted && fixture.scorecard?.winnerId ? (
                        <span className="font-semibold text-emerald-700 truncate">
                          {fixture.scorecard.margin || `${teamById.get(fixture.scorecard.winnerId)?.shortName} won`}
                        </span>
                      ) : (
                        <>
                          <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                          <span className="truncate">{fixture.venue || 'Cricket Stadium'}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5 text-blue-600 font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">
                      <span>{isCompleted ? 'View' : 'Play'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

