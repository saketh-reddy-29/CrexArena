import React from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { ArrowLeft, Trophy, CheckCircle2, Ban } from 'lucide-react';
import { cn } from '../lib/utils';
import type { InningsData, PlayerMatchStats } from '../types/match';

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-sm font-bold text-slate-500">No completed match selected.</p>
          <button
            onClick={handleBack}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
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
      <div key={index} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-xs font-black text-slate-900">{teamName(innings.battingTeamId)}</p>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Innings {index + 1}
            </p>
          </div>
          <p className="text-lg font-black tabular-nums text-slate-900">
            {innings.runs}/{innings.wickets}
            <span className="text-xs text-slate-400 ml-1 font-bold">
              ({innings.overs}.{innings.balls})
            </span>
          </p>
        </div>

        {batsmen.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Batting
            </p>
            <div className="space-y-1.5">
              {batsmen.map((b) => (
                <div key={b.playerId} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 truncate">{playerName(b.playerId)}</span>
                  <span className="tabular-nums text-slate-500 shrink-0">
                    {b.runs} ({b.balls})
                    {(b.fours || b.sixes) ? (
                      <span className="text-slate-400 ml-1">
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
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Bowling
            </p>
            <div className="space-y-1.5">
              {bowlers.map((b) => (
                <div key={b.playerId} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 truncate">{playerName(b.playerId)}</span>
                  <span className="tabular-nums text-slate-500 shrink-0">
                    {b.overs}.0-{b.runsConceded}-{b.wickets}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(innings.extras.wides || innings.extras.noBalls || innings.extras.byes || innings.extras.legByes) ? (
          <p className="px-4 pb-3 text-[10px] text-slate-400 font-semibold">
            Extras: {innings.extras.wides}w {innings.extras.noBalls}nb {innings.extras.byes}b {innings.extras.legByes}lb
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0 text-slate-600 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {fixture.format || 'T20'}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {fixture.isPlayoff ? fixture.playoffType : `Match ${fixture.matchNumber}`}
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                {isNoResult ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {isNoResult ? 'No Result' : 'Completed'}
              </span>
            </div>
            <h1 className="text-base font-black text-slate-900 truncate mt-0.5">
              {teamName(fixture.team1Id)} vs {teamName(fixture.team2Id)}
            </h1>
          </div>
        </div>

        {/* Result banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-blue-600">
            <Trophy className="w-5 h-5" />
          </div>
          {isNoResult || scorecard.result === 'DRAW' || scorecard.result === 'TIE' ? (
            <p className="text-sm font-black text-slate-900">
              {scorecard.result === 'DRAW' ? 'Match Drawn' : scorecard.result === 'TIE' ? 'Match Tied' : 'No Result'}
            </p>
          ) : (
            <p className="text-sm font-black text-slate-900">
              {teamShort(scorecard.winnerId) || teamName(scorecard.winnerId)} won
              {scorecard.margin ? (
                <span className="font-bold text-slate-500"> {scorecard.margin}</span>
              ) : null}
            </p>
          )}
          {scorecard.playerOfMatchId && (
            <p className="text-[11px] font-semibold text-slate-500">
              Player of the Match: {playerName(scorecard.playerOfMatchId)}
            </p>
          )}
        </div>

        {/* Innings */}
        {scorecard.innings.map((inn, i) => renderInnings(inn, i))}
      </div>
    </div>
  );
}
