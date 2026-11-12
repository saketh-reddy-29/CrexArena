import React from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { ArrowLeft, Trophy, CheckCircle2, Ban } from 'lucide-react';
import { cn } from '../lib/utils';
import type { InningsData, PlayerMatchStats } from '../types/match';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';

/**
 * Read-only scorecard for a completed fixture.
 *
 * This view is intentionally pure presentation: it never starts a match,
 * never touches live simulation state and never writes results. It is the
 * only destination for a completed fixture, which is what makes the replay
 * prevention airtight at the UI layer (the store additionally refuses any
 * attempt to start a finalised fixture).
 */
export default function MatchResultView() {
  const { fixtures, franchises, players, viewingMatchId, setViewingMatch, setGameState } =
    useGameStore();

  const fixture = fixtures.find((f) => f.id === viewingMatchId) ?? null;
  const [tab, setTab] = React.useState<'scorecard' | 'stats'>('scorecard');

  const teamName = (id?: string) =>
    franchises.find((f) => f.id === id)?.name || id || '—';
  const teamShort = (id?: string) =>
    franchises.find((f) => f.id === id)?.shortName || '';
  const playerName = (id: string) => players.find((p) => p.id === id)?.name || id;

  const handleBack = () => {
    setViewingMatch(null);
    setGameState(GameState.ARENA_HUB);
  };

  if (!fixture || !fixture.scorecard) {
    return (
      <div className="min-h-screen bg-[#071426] flex items-center justify-center p-6 text-[#F6F8FC]">
        <div className="text-center space-y-4">
          <p className="text-sm font-bold text-[#9DAEC4]">No completed match selected.</p>
          <button
            onClick={handleBack}
            className="px-5 py-2.5 rounded-xl bg-[#258BFF] hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-blue-500/20"
          >
            Back to Hub
          </button>
        </div>
      </div>
    );
  }

  const scorecard = fixture.scorecard;
  const isNoResult = scorecard.result === 'NO_RESULT';

  const renderInnings = (innings: InningsData, index: number) => {
    const batsmen = Object.values(innings.batsmen) as PlayerMatchStats[];
    const bowlers = Object.values(innings.bowlers) as PlayerMatchStats[];

    return (
      <div key={index} className="bg-[#10233D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0D1C32] border-b border-white/10">
          <div>
            <p className="text-xs font-black text-[#F6F8FC]">{teamName(innings.battingTeamId)}</p>
            <p className="text-[10px] font-semibold text-[#258BFF] uppercase tracking-wider">
              Innings {index + 1}
            </p>
          </div>
          <p className="text-lg font-black tabular-nums text-[#F5B82E]">
            {innings.runs}/{innings.wickets}
            <span className="text-xs text-[#9DAEC4] ml-1 font-bold">
              ({innings.overs}.{innings.balls})
            </span>
          </p>
        </div>

        {batsmen.length > 0 && (
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#9DAEC4] mb-2">
              Batting
            </p>
            <div className="space-y-2">
              {batsmen.map((b) => (
                <div key={b.playerId} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#0D1C32]/50 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getPlayerImage(playerName(b.playerId))}
                      alt={playerName(b.playerId)}
                      onError={handlePlayerImageError}
                      className="w-6 h-6 rounded-full object-cover border border-white/10 bg-[#152C4D] shrink-0"
                    />
                    <span className="font-bold text-[#F6F8FC] truncate">{playerName(b.playerId)}</span>
                  </div>
                  <span className="tabular-nums text-[#9DAEC4] shrink-0 font-medium">
                    <strong className="text-[#F6F8FC]">{b.runs}</strong> ({b.balls})
                    {(b.fours || b.sixes) ? (
                      <span className="text-[#9DAEC4]/70 ml-1.5">
                        {b.fours ? `${b.fours}x4 ` : ''}{b.sixes ? `${b.sixes}x6` : ''}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {bowlers.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-[#9DAEC4] mb-2">
              Bowling
            </p>
            <div className="space-y-2">
              {bowlers.map((b) => (
                <div key={b.playerId} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#0D1C32]/50 border border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={getPlayerImage(playerName(b.playerId))}
                      alt={playerName(b.playerId)}
                      onError={handlePlayerImageError}
                      className="w-6 h-6 rounded-full object-cover border border-white/10 bg-[#152C4D] shrink-0"
                    />
                    <span className="font-bold text-[#F6F8FC] truncate">{playerName(b.playerId)}</span>
                  </div>
                  <span className="tabular-nums text-[#9DAEC4] shrink-0 font-medium">
                    {b.overs}.0-{b.runsConceded}-<strong className="text-[#F5B82E]">{b.wickets}w</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(innings.extras.wides || innings.extras.noBalls || innings.extras.byes || innings.extras.legByes) ? (
          <p className="px-4 pb-3 text-[10px] text-[#9DAEC4] font-semibold">
            Extras: {innings.extras.wides}w {innings.extras.noBalls}nb {innings.extras.byes}b {innings.extras.legByes}lb
          </p>
        ) : null}
      </div>
    );
  };

  const statsBatters = scorecard.innings
    .flatMap((inn) =>
      Object.values(inn.batsmen).map((b) => ({ stats: b as PlayerMatchStats, teamId: inn.battingTeamId })),
    )
    .sort((a, b) => b.stats.runs - a.stats.runs)
    .slice(0, 10);

  const statsBowlers = scorecard.innings
    .flatMap((inn) =>
      Object.values(inn.bowlers).map((b) => ({ stats: b as PlayerMatchStats, teamId: inn.bowlingTeamId })),
    )
    .sort((a, b) => b.stats.wickets - a.stats.wickets || a.stats.runsConceded - b.stats.runsConceded)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-[#071426] text-[#F6F8FC]">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-[#10233D] border border-white/10 flex items-center justify-center hover:bg-[#152C4D] transition-colors shrink-0 text-[#9DAEC4] hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-[#258BFF] border border-blue-500/20">
                {fixture.format || 'T20'}
              </span>
              <span className="text-[10px] font-bold text-[#9DAEC4] uppercase tracking-wide">
                {fixture.isPlayoff ? fixture.playoffType : `Match ${fixture.matchNumber}`}
              </span>
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                {isNoResult ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {isNoResult ? 'No Result' : 'Completed'}
              </span>
            </div>
            <h1 className="text-base font-black text-[#F6F8FC] truncate mt-0.5">
              {teamName(fixture.team1Id)} vs {teamName(fixture.team2Id)}
            </h1>
          </div>
        </div>

        {/* Result banner */}
        <div className="bg-[#10233D] rounded-2xl border border-white/10 p-5 text-center space-y-2 shadow-xl">
          <div className="flex items-center justify-center gap-2 text-[#F5B82E]">
            <Trophy className="w-6 h-6" />
          </div>
          {isNoResult || scorecard.result === 'DRAW' || scorecard.result === 'TIE' ? (
            <p className="text-base font-black text-[#F6F8FC]">
              {scorecard.result === 'DRAW' ? 'Match Drawn' : scorecard.result === 'TIE' ? 'Match Tied' : 'No Result'}
            </p>
          ) : (
            <p className="text-base font-black text-[#F6F8FC]">
              <span className="text-[#F5B82E]">{teamShort(scorecard.winnerId) || teamName(scorecard.winnerId)}</span> won
              {scorecard.margin ? (
                <span className="font-bold text-[#9DAEC4]"> by {scorecard.margin}</span>
              ) : null}
            </p>
          )}
          {scorecard.playerOfMatchId && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D1C32] border border-white/10">
              <img
                src={getPlayerImage(playerName(scorecard.playerOfMatchId))}
                alt={playerName(scorecard.playerOfMatchId)}
                onError={handlePlayerImageError}
                className="w-5 h-5 rounded-full object-cover border border-amber-400"
              />
              <span className="text-[11px] font-semibold text-[#9DAEC4]">
                Player of the Match: <strong className="text-[#F5B82E]">{playerName(scorecard.playerOfMatchId)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Tab switch: scorecard vs aggregated stats */}
        <div className="flex gap-1.5 bg-[#0D1C32] border border-white/10 rounded-2xl p-1.5">
          {(['scorecard', 'stats'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer',
                tab === key ? 'bg-[#258BFF] text-white shadow-md shadow-blue-500/20' : 'text-[#9DAEC4] hover:text-white hover:bg-white/5',
              )}
            >
              {key === 'scorecard' ? 'Scorecard' : 'Stats'}
            </button>
          ))}
        </div>

        {tab === 'scorecard' ? (
          scorecard.innings.map((inn, i) => renderInnings(inn, i))
        ) : (
          <>
            <div className="bg-[#10233D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <p className="px-4 py-3 bg-[#0D1C32] border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-[#258BFF]">
                Top Batting
              </p>
              <div className="divide-y divide-white/5">
                {statsBatters.length === 0 && (
                  <p className="px-4 py-3 text-xs text-[#9DAEC4] font-semibold">No batting data.</p>
                )}
                {statsBatters.map(({ stats, teamId }, i) => (
                  <div key={`${stats.playerId}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-[#152C4D]/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getPlayerImage(playerName(stats.playerId))}
                        alt={playerName(stats.playerId)}
                        onError={handlePlayerImageError}
                        className="w-6 h-6 rounded-full object-cover border border-white/10 bg-[#0D1C32] shrink-0"
                      />
                      <span className="font-bold text-[#F6F8FC] truncate">{playerName(stats.playerId)}</span>
                      <span className="text-[#9DAEC4] text-[10px] font-semibold bg-white/5 px-1.5 py-0.5 rounded">{teamShort(teamId)}</span>
                    </div>
                    <span className="tabular-nums text-[#9DAEC4] shrink-0 font-semibold">
                      <strong className="text-[#F6F8FC]">{stats.runs}</strong> ({stats.balls})
                      <span className="text-[#9DAEC4]/70 ml-1.5">
                        {stats.fours ? `${stats.fours}x4 ` : ''}{stats.sixes ? `${stats.sixes}x6` : ''}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#10233D] rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <p className="px-4 py-3 bg-[#0D1C32] border-b border-white/10 text-[10px] font-black uppercase tracking-wider text-[#258BFF]">
                Top Bowling
              </p>
              <div className="divide-y divide-white/5">
                {statsBowlers.length === 0 && (
                  <p className="px-4 py-3 text-xs text-[#9DAEC4] font-semibold">No bowling data.</p>
                )}
                {statsBowlers.map(({ stats, teamId }, i) => (
                  <div key={`${stats.playerId}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-xs hover:bg-[#152C4D]/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={getPlayerImage(playerName(stats.playerId))}
                        alt={playerName(stats.playerId)}
                        onError={handlePlayerImageError}
                        className="w-6 h-6 rounded-full object-cover border border-white/10 bg-[#0D1C32] shrink-0"
                      />
                      <span className="font-bold text-[#F6F8FC] truncate">{playerName(stats.playerId)}</span>
                      <span className="text-[#9DAEC4] text-[10px] font-semibold bg-white/5 px-1.5 py-0.5 rounded">{teamShort(teamId)}</span>
                    </div>
                    <span className="tabular-nums text-[#9DAEC4] shrink-0 font-semibold">
                      <strong className="text-[#F5B82E]">{stats.wickets}w</strong> · {stats.runsConceded}r
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
