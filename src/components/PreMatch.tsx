import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchEngine } from '../lib/matchEngine';
import { TossDecision, PitchType, WeatherCondition } from '../types/match';
import { ArrowLeft, Users, Trophy, CheckCircle2, ChevronRight, Sparkles, Shield, AlertTriangle, Star, Activity, CloudSun, Wind, MapPin, Droplets, Gauge, Lightbulb } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { getPlayerRating } from '../lib/ratingEngine';
import { WorkloadRotationEngine } from '../engine/ai/WorkloadRotationEngine';
import { TossRecommendationEngine, describeGround, describePitch, describeWeather, summarizeConditionsForLive } from '../engine/conditions';
import type { MatchFormatKey } from '../engine/conditions';
import type { Player } from '../types/common';

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

export default function PreMatch() {
  const {
    currentMatchId,
    fixtures,
    franchises,
    players,
    selectedFranchiseId,
    selectedSquadIds,
    playingXIIds,
    playerFatigue,
    setPlayingXIIds,
    setFixturePlayingXI,
    setCurrentMatchToss,
    setCaptain,
    setGameState,
    ensureMatchConditions,
  } = useGameStore();

  const isIPL = useGameStore((s) => s.selectedFormat === 'IPL');
  const format = (useGameStore((s) => s.selectedFormat) || 'T20') as any;

  const currentMatch = fixtures.find((f) => f.id === currentMatchId);
  const userTeam = franchises.find((f) => f.id === selectedFranchiseId);

  const team1 = franchises.find((f) => f.id === currentMatch?.team1Id);
  const team2 = franchises.find((f) => f.id === currentMatch?.team2Id);
  const opponentTeam = team1?.id === userTeam?.id ? team2 : team1;

  useEffect(() => {
    if (!userTeam || !opponentTeam) {
      setGameState(GameState.LANDING);
    }
  }, [userTeam, opponentTeam, setGameState]);

  if (!userTeam || !opponentTeam) return null;

  // Step state: squad selection vs toss
  const [step, setStep] = useState<'squad' | 'toss'>('squad');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(userTeam.captainId || null);
  const [tossResult, setTossResult] = useState<{ winnerId: string; decision: TossDecision | null } | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  // Match Conditions — pulled from the fixture's persisted, seeded report so
  // the same pitch/weather is shown here, live, and after any refresh.
  useEffect(() => {
    if (currentMatch && !currentMatch.conditionReport) {
      ensureMatchConditions(currentMatch.id);
    }
  }, [currentMatch, ensureMatchConditions]);

  const conditionReport = currentMatch?.conditionReport ?? null;
  const conditions = conditionReport?.model ?? null;
  const pitchType = conditionReport?.legacyPitchType ?? PitchType.BALANCED;
  const weather = conditionReport?.legacyWeatherCondition ?? WeatherCondition.SUNNY;

  // User Squad
  const userSquad = useMemo(() => {
    if (isIPL) {
      return players.filter((p) => userTeam.squad.includes(p.id));
    }
    if (selectedSquadIds && selectedSquadIds.length > 0) {
      const selected = players.filter((p) => selectedSquadIds.includes(p.id));
      if (selected.length > 0) return selected;
    }
    const intended = players.filter((p) => p.intendedTeamId === userTeam.id);
    if (intended.length > 0) return intended;
    return players.filter((p) => userTeam.squad.includes(p.id));
  }, [isIPL, players, userTeam, selectedSquadIds]);

  // Opponent Squad
  const opponentSquad = useMemo(() => {
    if (isIPL) {
      return players.filter((p) => opponentTeam.squad.includes(p.id));
    }
    const intended = players.filter((p) => p.intendedTeamId === opponentTeam.id);
    if (intended.length > 0) return intended;
    return players.filter((p) => opponentTeam.squad.includes(p.id));
  }, [isIPL, players, opponentTeam]);

  // Opponent Tactical AI Playing XI
  const opponentOptimalSelection = useMemo(() => {
    return WorkloadRotationEngine.selectOptimalPlayingXI({
      squad: opponentSquad,
      pitchType,
      format,
      fatigueMap: playerFatigue,
      previousXI: currentMatch?.team2PlayingXI || [],
    });
  }, [opponentSquad, pitchType, format, playerFatigue, currentMatch]);

  // Initial Squad Auto-Selection for User
  useEffect(() => {
    if (userSquad.length === 0) return;
    if (selectedIds.length === 0) {
      const existingFixtureXI = currentMatch
        ? currentMatch.team1Id === userTeam.id
          ? currentMatch.team1PlayingXI
          : currentMatch.team2PlayingXI
        : undefined;

      if (existingFixtureXI && existingFixtureXI.length === 11) {
        setSelectedIds(existingFixtureXI);
      } else {
        const auto = WorkloadRotationEngine.selectOptimalPlayingXI({
          squad: userSquad,
          pitchType,
          format,
          fatigueMap: playerFatigue,
          mustIncludeIds: userTeam.captainId ? [userTeam.captainId] : [],
        });
        setSelectedIds(auto.playingXI);
      }
    }
  }, [userSquad, currentMatch, userTeam, pitchType, format, playerFatigue]);

  // Validate composition
  const selectedPlayers = useMemo(
    () => userSquad.filter((p) => selectedIds.includes(p.id)),
    [userSquad, selectedIds]
  );

  const keepersCount = selectedPlayers.filter((p) => p.role === 'Wicketkeeper').length;
  const bowlersCount = selectedPlayers.filter((p) => p.role === 'Bowler' || p.role === 'All-rounder').length;
  const isValidXI = selectedIds.length === 11 && keepersCount >= 1 && bowlersCount >= 5;

  // ── Conditions report text + intelligent toss recommendation ──
  const opponentPlayers = useMemo(
    () => opponentOptimalSelection.playingXI
      .map((id) => opponentSquad.find((p) => p.id === id))
      .filter(Boolean) as Player[],
    [opponentOptimalSelection, opponentSquad],
  );

  const strengthOf = (list: Player[]) => {
    const batters = list.filter((p) => p.role === 'Batsman' || p.role === 'Wicketkeeper' || p.role === 'All-rounder');
    const bowlers = list.filter((p) => p.role === 'Bowler' || p.role === 'All-rounder');
    const avg = (arr: Player[], key: 'batting' | 'bowling') =>
      arr.length ? arr.reduce((s, p) => s + (p.stats?.[key] ?? 60), 0) / arr.length : 60;
    return { batting: avg(batters, 'batting'), bowling: avg(bowlers, 'bowling') };
  };

  const evaluateToss = (strength: { batting: number; bowling: number }) => {
    if (!conditionReport || !conditions) return null;
    return TossRecommendationEngine.evaluate({
      format: format as MatchFormatKey,
      conditions,
      pitch: conditionReport.pitch,
      weather: conditionReport.weather,
      venue: conditionReport.venue,
      teamBattingDepth: strength.batting,
      teamBowlingStrength: strength.bowling,
    });
  };

  const recommendation = useMemo(
    () => evaluateToss(strengthOf(selectedPlayers)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conditionReport, conditions, selectedPlayers, format],
  );

  const groundText = conditionReport ? describeGround(conditionReport.venue) : '';
  const pitchText = conditionReport ? describePitch(conditionReport.pitch) : null;
  const weatherText = conditionReport ? describeWeather(conditionReport.weather, format as MatchFormatKey) : null;
  const conditionsSummary = conditions ? summarizeConditionsForLive(conditions) : '';

  const handleAutoBalance = () => {
    const auto = WorkloadRotationEngine.selectOptimalPlayingXI({
      squad: userSquad,
      pitchType,
      format,
      fatigueMap: playerFatigue,
      mustIncludeIds: captainId ? [captainId] : [],
    });
    setSelectedIds(auto.playingXI);
  };

  const togglePlayer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((pId) => pId !== id));
      if (captainId === id) setCaptainId(null);
    } else {
      if (selectedIds.length < 11) {
        setSelectedIds([...selectedIds, id]);
        if (!captainId) setCaptainId(id);
      }
    }
  };

  const handleToss = () => {
    setIsFlipping(true);
    setTimeout(() => {
      setIsFlipping(false);
      const isUserWinner = Math.random() > 0.5;
      const winnerId = isUserWinner ? userTeam.id : opponentTeam.id;
      // If the opponent wins the toss their AI captain reads the persisted
      // conditions and makes its own call — mostly following the recommendation,
      // occasionally backing its own judgement. The user always decides for
      // themselves (see the toss panel below).
      let decision: TossDecision | null = null;
      if (!isUserWinner) {
        const oppRec = evaluateToss(strengthOf(opponentPlayers));
        if (oppRec) {
          const aiFollows = Math.random() > 0.15;
          const aiChoice = aiFollows
            ? oppRec.recommendation
            : oppRec.recommendation === 'BAT' ? 'BOWL' : 'BAT';
          decision = aiChoice === 'BAT' ? TossDecision.BAT : TossDecision.BOWL;
        } else {
          decision = pitchType === PitchType.PACE || weather === WeatherCondition.CLOUDY ? TossDecision.BOWL : TossDecision.BAT;
        }
      }
      setTossResult({ winnerId, decision });
    }, 1500);
  };

  const proceedToToss = () => {
    if (!isValidXI) return;
    let effCaptain = captainId;
    if (!effCaptain || !selectedIds.includes(effCaptain)) {
      const best = selectedPlayers.sort((a, b) => b.rating - a.rating)[0];
      effCaptain = best ? best.id : selectedIds[0];
      setCaptainId(effCaptain);
    }
    if (effCaptain) {
      setCaptain(userTeam.id, effCaptain);
    }
    setStep('toss');
  };

  const startMatch = () => {
    if (captainId) {
      setCaptain(userTeam.id, captainId);
    }
    if (tossResult && tossResult.decision) {
      setCurrentMatchToss({ winnerId: tossResult.winnerId, decision: tossResult.decision });
    }

    const team1XI = currentMatch?.team1Id === userTeam.id ? selectedIds : opponentOptimalSelection.playingXI;
    const team2XI = currentMatch?.team1Id === userTeam.id ? opponentOptimalSelection.playingXI : selectedIds;

    if (currentMatch) {
      setFixturePlayingXI(currentMatch.id, team1XI, team2XI);
    }
    setPlayingXIIds(selectedIds);
    setGameState(GameState.MATCH_SIMULATION);
  };

  const getPitchAdvice = (type: PitchType) => {
    switch (type) {
      case PitchType.PACE:
        return 'Green grass top: sharp bounce and early seam movement. Fast bowlers highly effective.';
      case PitchType.SPIN:
        return 'Dry and dusty surface: sharp turn and grip. Spinners will dictate the game.';
      case PitchType.BATTING:
        return 'Flat batting paradise: true bounce and high-scoring ground. Deep batting lineup recommended.';
      case PitchType.SLOW:
        return 'Two-paced, low surface: pace-off cutters and tight defensive lines are critical.';
      default:
        return 'Evenly balanced sporting pitch offering equal competition between bat and ball.';
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 font-sans flex flex-col">
      {/* CREX Top Bar */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGameState(GameState.ARENA_HUB)}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Match Day Squad & Toss
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {currentMatch?.isPlayoff ? currentMatch.playoffType : `Match ${currentMatch?.matchNumber || 1}`}
                </span>
              </div>
              <h1 className="text-base font-black text-slate-900">
                {userTeam.name} <span className="text-slate-400 font-normal">vs</span> {opponentTeam.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">
              Venue: <strong className="text-slate-800">{currentMatch?.venue || 'Cricket Stadium'}</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-4">
        
        {/* Conditions Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black shrink-0">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pitch Deck</span>
                <span className="text-sm font-black text-slate-900">
                  {pitchText ? `${pitchText.surface} Wicket` : `${pitchType} Wicket`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black shrink-0">
                <CloudSun className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weather</span>
                <span className="text-sm font-black text-slate-900">
                  {weatherText ? weatherText.headline : `${weather} Skies`}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black shrink-0">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ground</span>
                <span className="text-sm font-black text-slate-900 truncate block">
                  {conditionReport?.venue.name || currentMatch?.venue || 'Cricket Stadium'}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed venue / pitch / weather report */}
          {conditionReport && pitchText && weatherText ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] leading-relaxed">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-1.5 font-black text-slate-700 mb-1">
                  <MapPin className="w-3.5 h-3.5" /> Ground & Outfield
                </div>
                <p className="text-slate-600 font-medium">{groundText}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-1.5 font-black text-slate-700 mb-1">
                  <Gauge className="w-3.5 h-3.5" /> Pitch Report
                </div>
                <p className="text-slate-600 font-medium">{pitchText.detail}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {pitchText.traits.map((t) => (
                    <span key={t} className="text-[9px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <div className="flex items-center gap-1.5 font-black text-slate-700 mb-1">
                  <Droplets className="w-3.5 h-3.5" /> Weather Report
                </div>
                <p className="text-slate-600 font-medium">{weatherText.detail}</p>
                <p className="text-slate-500 font-medium mt-1">{weatherText.swingNote} {weatherText.dewNote}</p>
              </div>
            </div>
          ) : (
            <div className="text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
              {getPitchAdvice(pitchType)}
            </div>
          )}

          {conditionsSummary && (
            <div className="text-[10px] font-bold text-slate-500 bg-slate-900/5 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
              Gameplay influence: {conditionsSummary}
            </div>
          )}
        </div>

        {step === 'squad' ? (
          /* SQUAD SELECTION STEP */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* LEFT 2 COLUMNS: User Team Squad Picker */}
            <div className="lg:col-span-2 space-y-3">
              {/* Squad Header and Controls */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      Select Playing XI ({selectedIds.length}/11)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Tap players to toggle them into your match squad. Star marks the Captain.
                    </p>
                  </div>

                  <button
                    onClick={handleAutoBalance}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> AI Auto-Pick & Balance
                  </button>
                </div>

                {/* Team Validation Bar */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className={cn(
                    "p-2 rounded-xl border flex items-center gap-2 font-bold",
                    selectedIds.length === 11 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-600"
                  )}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{selectedIds.length}/11 Players</span>
                  </div>

                  <div className={cn(
                    "p-2 rounded-xl border flex items-center gap-2 font-bold",
                    keepersCount >= 1 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                    {keepersCount >= 1 ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{keepersCount} WKs (Min 1)</span>
                  </div>

                  <div className={cn(
                    "p-2 rounded-xl border flex items-center gap-2 font-bold",
                    bowlersCount >= 5 ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                    {bowlersCount >= 5 ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{bowlersCount} Bowlers (Min 5)</span>
                  </div>
                </div>
              </div>

              {/* Player Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar">
                {userSquad.map((player) => {
                  const isSelected = selectedIds.includes(player.id);
                  const isCap = captainId === player.id;
                  const fatigue = playerFatigue[player.id] || 0;
                  const isFatigued = fatigue >= 65;
                  const isCritical = fatigue >= 85;

                  return (
                    <div
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all cursor-pointer bg-white relative flex items-center justify-between gap-3 group select-none",
                        isSelected
                          ? "border-blue-600 shadow-sm bg-blue-50/20"
                          : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60"
                      )}
                    >
                      {/* Left: Player Avatar & Name */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={getPlayerImage(player.name)}
                            alt={player.name}
                            onError={handlePlayerImageError}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100"
                          />
                          {isCap && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                              C
                            </span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">{player.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                              {player.rating}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              {player.role}
                            </span>

                            {/* Fatigue Indicator */}
                            <span
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0.2 rounded",
                                isCritical
                                  ? "bg-red-100 text-red-700"
                                  : isFatigued
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              )}
                              title={`Workload fatigue: ${fatigue}%`}
                            >
                              {fatigue > 0 ? `${fatigue}% workload` : 'Fresh'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isSelected && (
                          <button
                            onClick={() => setCaptainId(player.id)}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors",
                              isCap ? "text-amber-500 hover:text-amber-600 bg-amber-50" : "text-slate-300 hover:text-amber-500 hover:bg-slate-100"
                            )}
                            title="Set as Captain"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                        )}

                        <div
                          onClick={() => togglePlayer(player.id)}
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer",
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 hover:border-slate-400"
                          )}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Opponent Announced XI & Confirmation */}
            <div className="space-y-3">
              {/* Opponent Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                  {resolveTeamLogo(opponentTeam.shortName) ? (
                    <img
                      src={resolveTeamLogo(opponentTeam.shortName)}
                      alt={opponentTeam.shortName}
                      className="w-7 h-7 object-contain"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                      {opponentTeam.shortName?.[0]}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Opponent Lineup</span>
                    <h3 className="text-xs font-black text-slate-900">{opponentTeam.name}</h3>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-medium">
                  {opponentOptimalSelection.tacticalSummary}
                </div>

                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {opponentOptimalSelection.playingXI.map((pId, idx) => {
                    const p = opponentSquad.find((player) => player.id === pId);
                    if (!p) return null;
                    return (
                      <div key={pId} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 tabular-nums w-3.5">{idx + 1}</span>
                          <span className="font-bold text-slate-800">{p.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold">{p.role}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Proceed to Toss Button */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2">
                <button
                  disabled={!isValidXI}
                  onClick={proceedToToss}
                  className={cn(
                    "w-full py-3 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-xs",
                    isValidXI
                      ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-[0.99]"
                      : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  )}
                >
                  Confirm Squad & Proceed to Toss <ChevronRight className="w-4 h-4" />
                </button>
                {!isValidXI && (
                  <p className="text-[10px] text-rose-600 text-center font-medium">
                    Select exactly 11 players including at least 1 Wicketkeeper and 5 Bowlers.
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* TOSS STEP */
          <div className="max-w-xl mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm text-center space-y-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  Match Day Protocol
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">The Coin Toss</h2>
                <p className="text-xs text-slate-500">
                  {userTeam.name} vs {opponentTeam.name} at {currentMatch?.venue || 'Stadium'}
                </p>
              </div>

              {/* Intelligent toss advisor (decision support only) */}
              {recommendation && (
                <div className="text-left bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Toss Advisor</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">Confidence {Math.round(recommendation.confidence * 100)}%</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-black",
                      recommendation.recommendation === 'BAT' ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                    )}>
                      {recommendation.recommendation === 'BAT' ? 'Bat First' : 'Bowl First'}
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">
                      recommended in these conditions
                    </span>
                  </div>

                  {/* Bat vs Bowl scores */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <span className="w-14">Bat {recommendation.batFirstScore}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${recommendation.batFirstScore}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <span className="w-14">Bowl {recommendation.bowlFirstScore}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${recommendation.bowlFirstScore}%` }} />
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-1">
                    {recommendation.rationale.map((r, i) => (
                      <li key={i} className="text-[11px] text-slate-600 font-medium flex gap-1.5">
                        <span className="text-slate-400">•</span><span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-slate-400 font-medium italic">{recommendation.alternative}</p>
                  <p className="text-[9px] text-slate-400">Advisory only — you are free to choose either option.</p>
                </div>
              )}

              {/* Coin Flip Visual */}
              <div className="py-6 flex justify-center">
                <motion.div
                  animate={isFlipping ? { rotateY: 1800, scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.5, ease: 'easeInOut' }}
                  className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-400 to-yellow-200 border-4 border-amber-500 shadow-md flex items-center justify-center text-amber-900 font-black text-2xl select-none"
                >
                  {isFlipping ? '...' : tossResult ? (tossResult.winnerId === userTeam.id ? userTeam.shortName : opponentTeam.shortName) : 'CRX'}
                </motion.div>
              </div>

              {!tossResult && (
                <button
                  disabled={isFlipping}
                  onClick={handleToss}
                  className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  {isFlipping ? 'Flipping Coin...' : 'Spin the Coin'}
                </button>
              )}

              {tossResult && (
                <div className="space-y-4 pt-2">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <span className="text-xs font-black text-blue-900 block">
                      {tossResult.winnerId === userTeam.id ? userTeam.name : opponentTeam.name} won the toss!
                    </span>
                  </div>

                  {tossResult.winnerId === userTeam.id ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-700">Choose your match strategy:</p>
                      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                        <button
                          onClick={() => setTossResult({ ...tossResult, decision: TossDecision.BAT })}
                          className={cn(
                            "py-2.5 px-4 rounded-xl font-black text-xs border transition-all cursor-pointer",
                            tossResult.decision === TossDecision.BAT
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                          )}
                        >
                          Bat First
                          {recommendation?.recommendation === 'BAT' && (
                            <span className="block text-[9px] font-bold text-amber-500">★ Recommended</span>
                          )}
                        </button>
                        <button
                          onClick={() => setTossResult({ ...tossResult, decision: TossDecision.BOWL })}
                          className={cn(
                            "py-2.5 px-4 rounded-xl font-black text-xs border transition-all cursor-pointer",
                            tossResult.decision === TossDecision.BOWL
                              ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-blue-400"
                          )}
                        >
                          Bowl First
                          {recommendation?.recommendation === 'BOWL' && (
                            <span className="block text-[9px] font-bold text-amber-500">★ Recommended</span>
                          )}
                        </button>
                      </div>
                      {recommendation && tossResult.decision && (
                        (tossResult.decision === TossDecision.BAT ? 'BAT' : 'BOWL') !== recommendation.recommendation && (
                          <p className="text-[10px] text-amber-600 font-medium text-center">
                            Going against the advisor's call — brave, but conditions favour {recommendation.recommendation === 'BAT' ? 'batting' : 'bowling'} first.
                          </p>
                        )
                      )}
                      <p className="text-[9px] text-slate-400 text-center">
                        Your choice is final and never changes the simulation's fairness.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-slate-600">
                      {opponentTeam.name} decided to <strong className="text-slate-900">{tossResult.decision} first</strong> on this {pitchType} wicket
                      {recommendation && ` (their captain's call — advisor leaned ${recommendation.recommendation === 'BAT' ? 'bat-first' : 'bowl-first'})`}.
                    </p>
                  )}

                  {tossResult.decision && (
                    <button
                      onClick={startMatch}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Walk Out to the Middle & Start Match
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="text-center">
              <button
                onClick={() => setStep('squad')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                ← Back to Squad Selection
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

