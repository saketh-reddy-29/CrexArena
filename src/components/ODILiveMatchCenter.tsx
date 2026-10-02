import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Shield,
  Clock,
  Sparkles,
  Award,
  Layers,
  ChevronRight,
  TrendingUp,
  Activity,
  Maximize2,
  List,
  Eye,
  ArrowLeft,
  Flame,
  Zap,
} from 'lucide-react';
import { Player } from '../types/common';
import { useGameStore, GameState } from '../stores/useGameStore';
import CricketActionVisualizer3D from './CricketActionVisualizer3D';
import {
  ODIMatchPlaybackController,
  ODIPlaybackSpeed,
} from '../engine/formats/odi/ODIMatchPlaybackController';
import {
  ODIDeliveryRecord,
  ODIMatchSummary,
  ODIInningsData,
} from '../engine/formats/odi/ODIDeliveryModel';
import { FieldChangeOverlay } from '../game/ui/FieldChangeOverlay';
import { DeliveryStatus } from '../game/ui/DeliveryStatus';
import { cn } from '../lib/utils';

export default function ODILiveMatchCenter() {
  const { currentMatchId, fixtures, franchises, players, setGameState } = useGameStore();

  const currentMatch = fixtures.find((f) => f.id === currentMatchId);
  const fallbackTeam1 = franchises[0];
  const fallbackTeam2 = franchises[1] || fallbackTeam1;
  const team1Franchise = franchises.find((t) => t.id === currentMatch?.team1Id) || fallbackTeam1;
  const team2Franchise = franchises.find((t) => t.id === currentMatch?.team2Id) || fallbackTeam2;

  const team1Squad = useMemo(() => {
    return team1Franchise.squad
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [team1Franchise, players]);

  const team2Squad = useMemo(() => {
    return team2Franchise.squad
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [team2Franchise, players]);

  const controllerRef = useRef<ODIMatchPlaybackController | null>(null);

  const [matchSummary, setMatchSummary] = useState<ODIMatchSummary | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeedState] = useState<ODIPlaybackSpeed>(1.0);
  const [currentStep, setCurrentStep] = useState<{ step: string; subtext: string }>({
    step: 'READY',
    subtext: 'Next delivery locked & ready',
  });

  const [showScorecardModal, setShowScorecardModal] = useState<boolean>(false);
  const [scorecardTabInnings, setScorecardTabInnings] = useState<number>(0);
  const [activeMilestone, setActiveMilestone] = useState<{ title: string; subtitle: string; badge?: string } | null>(null);
  const [fieldChangeData, setFieldChangeData] = useState<{
    isVisible: boolean;
    bowlerName: string;
    strategy: string;
    plan: string;
    changes: string[];
  }>({
    isVisible: false,
    bowlerName: '',
    strategy: '',
    plan: '',
    changes: [],
  });

  const [overBanner, setOverBanner] = useState<string | null>(null);
  const [phaseBanner, setPhaseBanner] = useState<string | null>(null);

  // Initialize playback controller
  useEffect(() => {
    const controller = new ODIMatchPlaybackController(
      currentMatchId || 'odi-match-1',
      { id: team1Franchise.id, name: team1Franchise.name, shortName: team1Franchise.shortName, squad: team1Squad },
      { id: team2Franchise.id, name: team2Franchise.name, shortName: team2Franchise.shortName, squad: team2Squad },
      team1Franchise.id,
      {
        onStateUpdate: (summary) => setMatchSummary({ ...summary }),
        onDeliveryStep: (step, subtext) => setCurrentStep({ step, subtext }),
        onFieldChange: (bowlerName, strategy, plan, changes) => {
          setFieldChangeData({ isVisible: true, bowlerName, strategy, plan, changes });
          setTimeout(() => setFieldChangeData((prev) => ({ ...prev, isVisible: false })), 3200);
        },
        onOverComplete: (overNum, summary) => {
          setOverBanner(summary);
          setTimeout(() => setOverBanner(null), 2500);
        },
        onPhaseChange: (phase, description) => {
          setPhaseBanner(description);
          setTimeout(() => setPhaseBanner(null), 4000);
        },
        onMilestone: (title, subtitle, badge) => {
          setActiveMilestone({ title, subtitle, badge });
          setTimeout(() => setActiveMilestone(null), 3200);
        },
      }
    );

    controllerRef.current = controller;
    setMatchSummary(controller.getSummary());
    controller.startContinuousMatch();

    return () => {
      controller.pause();
    };
  }, [currentMatchId, team1Franchise, team2Franchise, team1Squad, team2Squad]);

  const togglePlayPause = () => {
    if (!controllerRef.current) return;
    if (isPlaying) {
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      controllerRef.current.resume();
      setIsPlaying(true);
    }
  };

  const handleSpeedChange = (newSpeed: ODIPlaybackSpeed) => {
    setSpeedState(newSpeed);
    controllerRef.current?.setSpeed(newSpeed);
  };

  const handleNextBall = () => {
    controllerRef.current?.playNextBallManual();
  };

  const currentInning = matchSummary?.innings[matchSummary.currentInningsIndex];
  const allBattingSquad = currentInning?.battingTeamId === team1Franchise.id ? team1Squad : team2Squad;
  const allBowlingSquad = currentInning?.bowlingTeamId === team1Franchise.id ? team1Squad : team2Squad;

  const striker = allBattingSquad.find((p) => p.id === matchSummary?.strikerId) || null;
  const nonStriker = allBattingSquad.find((p) => p.id === matchSummary?.nonStrikerId) || null;
  const currentBowler = allBowlingSquad.find((p) => p.id === matchSummary?.bowlerId) || null;

  const strikerStats = currentInning?.batters[striker?.id || ''];
  const nonStrikerStats = currentInning?.batters[nonStriker?.id || ''];
  const bowlerStats = currentInning?.bowlers[currentBowler?.id || ''];

  const lastDelivery = controllerRef.current?.getLastDelivery();
  const recentDeliveries = currentInning?.deliveries.slice(-6) || [];
  const activePship = currentInning?.partnerships.find((p) => p.active);

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white flex flex-col select-none overflow-x-hidden font-sans">
      {/* ── TOP BROADCAST ODI HEADER ── */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-2.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGameState(GameState.LANDING)}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 hover:bg-zinc-800 text-zinc-300 transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-600 text-white shadow-sm">
                  ODI 50 Overs
                </span>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  {matchSummary?.phaseName || 'Powerplay (Overs 1-10)'}
                </span>
              </div>
              <div className="text-[11px] font-medium text-zinc-400">
                {team1Franchise.name} vs {team2Franchise.name}
              </div>
            </div>
          </div>

          {/* Current Live Match Score */}
          <div className="flex items-center gap-4 text-center">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-1.5 shadow-inner">
              <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {currentInning?.battingTeamName || 'Batting'} • {currentInning?.statusText || '1st Innings'}
              </div>
              <div className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {currentInning?.score || 0}/{currentInning?.wickets || 0}
                <span className="text-xs font-bold text-zinc-400 ml-2">
                  ({currentInning?.overs || 0}.{currentInning?.balls || 0} ov)
                </span>
              </div>
            </div>

            {/* Run Rate & Target Metrics */}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-sky-400">
                CRR: {matchSummary?.currentRunRate.toFixed(2) || '0.00'}
                {matchSummary?.projectedScore ? (
                  <span className="text-zinc-400 ml-2 font-normal">Proj: {Math.round(matchSummary.projectedScore)}</span>
                ) : null}
              </div>
              {matchSummary?.target ? (
                <div className="text-xs font-bold text-emerald-400">
                  Target: {matchSummary.target} • RRR: {matchSummary.requiredRunRate?.toFixed(2) || '0.00'}
                  <span className="text-zinc-400 ml-1.5 font-normal">({matchSummary.runsRequired} off {matchSummary.ballsRemaining}b)</span>
                </div>
              ) : (
                <div className="text-[10px] text-zinc-500">1st Innings • Max 50.0 Overs</div>
              )}
            </div>
          </div>

          {/* Scorecard Quick Button */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScorecardModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 hover:bg-zinc-800 text-xs font-bold text-zinc-200 transition-colors shadow-sm"
            >
              <List className="w-3.5 h-3.5 text-sky-400" />
              <span>Full Scorecard</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN PLAYBACK VIEWPORT (3D GROUND + LIVE HUD) ── */}
      <div className="relative flex-1 min-h-[460px] lg:min-h-[580px] bg-zinc-950 flex flex-col justify-between">
        {/* 3D Ground Viewport */}
        <div className="absolute inset-0 w-full h-full">
          <CricketActionVisualizer3D
            striker={striker}
            nonStriker={nonStriker}
            bowler={currentBowler}
            lastBall={
              lastDelivery
                ? {
                    runs: lastDelivery.runs,
                    isWicket: lastDelivery.wicket,
                    wicketType: lastDelivery.wicketType || undefined,
                    isExtra: false,
                    bowlingTactic: 'OUTSWING',
                  }
                : null
            }
            ballCount={currentInning?.deliveries.length || 0}
            format="ODI"
            battingTeamName={currentInning?.battingTeamName || 'Batting Team'}
            bowlingTeamName={currentInning?.bowlingTeamName || 'Bowling Team'}
            score={currentInning?.score || 0}
            wickets={currentInning?.wickets || 0}
            overs={currentInning?.overs || 0}
            balls={currentInning?.balls || 0}
            totalOvers={50}
            target={matchSummary?.target}
            currentRunRate={matchSummary?.currentRunRate}
            requiredRunRate={matchSummary?.requiredRunRate}
            speed={speed === 0.75 ? 1 : (speed as any)}
            partnership={activePship ? { runs: activePship.runs, balls: activePship.balls } : undefined}
          />
        </div>

        {/* ── OVERLAYS: Live Step Ticker, Phase Banner, Milestones, Field Change ── */}
        <div className="relative z-30 pointer-events-none p-4 flex flex-col justify-between h-full">
          {/* Top Left Step Status & Phase Badges */}
          <div className="flex flex-col gap-2">
            <DeliveryStatus
              stateName={currentStep.step}
              shotName={lastDelivery?.shot}
              targetZone={lastDelivery?.targetZone}
              batterOutcome={lastDelivery?.result}
              isWicket={lastDelivery?.wicket}
              bowlerName={currentBowler?.name}
              batterName={striker?.name}
            />

            {/* ODI Phase Indicator (Section 42) */}
            <div className="self-start mt-10 bg-black/75 backdrop-blur-md border border-sky-500/30 rounded-2xl p-2.5 shadow-xl max-w-xs">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-ping" />
                <span className="text-[10px] font-black uppercase text-sky-400 tracking-wider">
                  {matchSummary?.currentPhase.replace('_', ' ')}
                </span>
              </div>
              <div className="text-[10px] text-zinc-300 font-medium">
                {matchSummary?.phaseDescription}
              </div>
            </div>
          </div>

          {/* Phase Transition Banner */}
          <AnimatePresence>
            {phaseBanner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="self-center bg-sky-950/90 border border-sky-400/40 backdrop-blur-xl px-8 py-3.5 rounded-3xl shadow-2xl text-center"
              >
                <div className="text-xs font-black uppercase text-sky-300 tracking-widest">ODI Phase Transition</div>
                <div className="text-base font-extrabold text-white">{phaseBanner}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Over Banner */}
          <AnimatePresence>
            {overBanner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="self-center bg-zinc-900/90 border border-sky-500/40 backdrop-blur-xl px-6 py-2.5 rounded-2xl shadow-2xl text-center"
              >
                <div className="text-[10px] font-black uppercase text-sky-400 tracking-wider">Over Complete</div>
                <div className="text-sm font-bold text-white">{overBanner}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Milestone Toast */}
          <AnimatePresence>
            {activeMilestone && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                className="self-center bg-gradient-to-r from-sky-600/90 to-blue-500/90 backdrop-blur-xl border border-sky-300/40 px-6 py-3 rounded-2xl shadow-[0_12px_40px_rgba(14,165,233,0.5)] text-center text-white"
              >
                <div className="text-[11px] font-black uppercase tracking-wider">{activeMilestone.badge || 'MILESTONE'}</div>
                <div className="text-base font-extrabold">{activeMilestone.title}</div>
                <div className="text-xs font-medium text-sky-100">{activeMilestone.subtitle}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Field Change Notification Overlay */}
          <FieldChangeOverlay
            isVisible={fieldChangeData.isVisible}
            bowlerName={fieldChangeData.bowlerName}
            bowlingPlan={fieldChangeData.plan}
            strategyName={fieldChangeData.strategy}
            changes={fieldChangeData.changes}
          />
        </div>
      </div>

      {/* ── BOTTOM LIVE HUD DASHBOARD (Section 40) ── */}
      <div className="bg-zinc-950 border-t border-zinc-800 p-4 z-40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Batters */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between mb-2">
              <span>Batters</span>
              <span className="text-[9px] text-zinc-500">P'ship: {activePship?.runs || 0} ({activePship?.balls || 0}b)</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{striker?.name || 'Striker'}*</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-sky-400 font-bold uppercase">{strikerStats?.intent || 'ROTATE'}</span>
              </div>
              <div className="text-xs font-black text-zinc-100">
                {strikerStats?.runs || 0} <span className="text-[10px] text-zinc-400 font-normal">({strikerStats?.balls || 0}) • {strikerStats?.fours || 0}x4 {strikerStats?.sixes || 0}x6</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-transparent border border-zinc-600" />
                <span className="text-xs font-medium text-zinc-300 truncate max-w-[120px]">{nonStriker?.name || 'Non-Striker'}</span>
              </div>
              <div className="text-xs font-semibold text-zinc-300">
                {nonStrikerStats?.runs || 0} <span className="text-[10px] text-zinc-500 font-normal">({nonStrikerStats?.balls || 0}) • {nonStrikerStats?.fours || 0}x4</span>
              </div>
            </div>
          </div>

          {/* Card 2: Bowler */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between mb-2">
              <span>Current Bowler</span>
              <span className="text-[9px] text-zinc-500">Max 10 Overs</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{currentBowler?.name || 'Bowler'}</div>
                <div className="text-[10px] text-sky-400 font-semibold">{lastDelivery?.deliveryType || 'Good Length Outside Off'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-zinc-100">
                  {bowlerStats?.overs || 0}-{bowlerStats?.maidens || 0}-{bowlerStats?.runs || 0}-{bowlerStats?.wickets || 0}
                </div>
                <div className="text-[9px] text-zinc-400">ER: {bowlerStats?.economy.toFixed(2) || '0.00'}</div>
              </div>
            </div>
          </div>

          {/* Card 3: Last 6 Deliveries */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Last 6 Deliveries
            </div>
            <div className="flex items-center gap-2">
              {recentDeliveries.length === 0 ? (
                <span className="text-xs text-zinc-500">Starting over...</span>
              ) : (
                recentDeliveries.map((d, i) => (
                  <div
                    key={d.deliveryId || i}
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-inner border',
                      d.wicket
                        ? 'bg-red-600 border-red-400 text-white animate-bounce'
                        : d.runs === 4
                        ? 'bg-blue-600 border-blue-400 text-white'
                        : d.runs === 6
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : d.runs > 0
                        ? 'bg-emerald-700 border-emerald-500 text-white'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                    )}
                  >
                    {d.wicket ? 'W' : d.runs}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Playback Controls */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Playback Controls
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="flex-1 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'Pause' : 'Play'}</span>
              </button>

              <button
                onClick={handleNextBall}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-colors"
                title="Next Ball"
              >
                <FastForward className="w-4 h-4" />
              </button>

              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 text-[10px] font-bold">
                {([0.75, 1.0, 1.5, 2.0] as ODIPlaybackSpeed[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={cn(
                      'px-2 py-1 rounded-lg transition-all',
                      speed === s ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FULL 50-OVER ODI SCORECARD MODAL ── */}
      <AnimatePresence>
        {showScorecardModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-sky-400">ODI Match Scorecard</div>
                  <div className="text-lg font-bold text-white">{team1Franchise.name} vs {team2Franchise.name}</div>
                </div>
                <button
                  onClick={() => setShowScorecardModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300"
                >
                  Close
                </button>
              </div>

              {/* Innings Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-2.5 bg-zinc-950/60 overflow-x-auto">
                {matchSummary?.innings.map((inn, idx) => (
                  <button
                    key={idx}
                    onClick={() => setScorecardTabInnings(idx)}
                    className={cn(
                      'px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors',
                      scorecardTabInnings === idx
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    )}
                  >
                    {inn.battingTeamName} {inn.score}/{inn.wickets} ({idx === 0 ? '1st Inn' : '2nd Inn Chase'})
                  </button>
                ))}
              </div>

              {/* Innings Table */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {(() => {
                  const activeInn = matchSummary?.innings[scorecardTabInnings];
                  if (!activeInn) return null;

                  const battersList = Object.values(activeInn.batters);
                  const bowlersList = Object.values(activeInn.bowlers).filter((b) => b.balls > 0);

                  return (
                    <>
                      <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4">
                        <div>
                          <div className="text-xs text-zinc-400 font-bold uppercase">{activeInn.battingTeamName} • {activeInn.statusText}</div>
                          <div className="text-2xl font-black text-white">{activeInn.score}/{activeInn.wickets}</div>
                        </div>
                        <div className="text-right text-xs text-zinc-400">
                          <div>Overs: <span className="font-bold text-white">{activeInn.overs}.{activeInn.balls} / 50.0</span></div>
                          <div>CRR: <span className="font-bold text-white">{(activeInn.legalBalls > 0 ? (activeInn.score / (activeInn.legalBalls / 6)).toFixed(2) : '0.00')}</span></div>
                        </div>
                      </div>

                      {/* Batting */}
                      <div>
                        <div className="text-xs font-black uppercase text-sky-400 mb-2">Batting</div>
                        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold border-b border-zinc-800">
                              <tr>
                                <th className="p-3">Batter</th>
                                <th className="p-3">Dismissal</th>
                                <th className="p-3 text-right">R</th>
                                <th className="p-3 text-right">B</th>
                                <th className="p-3 text-right">4s</th>
                                <th className="p-3 text-right">6s</th>
                                <th className="p-3 text-right">SR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {battersList.map((b) => (
                                <tr key={b.id} className="hover:bg-zinc-800/30">
                                  <td className="p-3 font-bold text-white">{b.name} {!b.out && b.balls > 0 && '*'}</td>
                                  <td className="p-3 text-zinc-400 text-[11px]">{b.dismissalInfo}</td>
                                  <td className="p-3 text-right font-black text-white">{b.runs}</td>
                                  <td className="p-3 text-right text-zinc-400">{b.balls}</td>
                                  <td className="p-3 text-right text-zinc-400">{b.fours}</td>
                                  <td className="p-3 text-right text-zinc-400">{b.sixes}</td>
                                  <td className="p-3 text-right text-zinc-400">{b.strikeRate.toFixed(1)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bowling */}
                      <div>
                        <div className="text-xs font-black uppercase text-sky-400 mb-2">Bowling</div>
                        <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-900/80 text-zinc-400 text-[10px] uppercase font-bold border-b border-zinc-800">
                              <tr>
                                <th className="p-3">Bowler</th>
                                <th className="p-3 text-right">O</th>
                                <th className="p-3 text-right">M</th>
                                <th className="p-3 text-right">R</th>
                                <th className="p-3 text-right">W</th>
                                <th className="p-3 text-right">Econ</th>
                                <th className="p-3 text-right">Dots</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/60">
                              {bowlersList.map((bw) => (
                                <tr key={bw.id} className="hover:bg-zinc-800/30">
                                  <td className="p-3 font-bold text-white">{bw.name}</td>
                                  <td className="p-3 text-right text-zinc-300 font-semibold">{bw.overs}</td>
                                  <td className="p-3 text-right text-zinc-400">{bw.maidens}</td>
                                  <td className="p-3 text-right text-zinc-400">{bw.runs}</td>
                                  <td className="p-3 text-right font-black text-rose-400">{bw.wickets}</td>
                                  <td className="p-3 text-right text-zinc-400">{bw.economy.toFixed(2)}</td>
                                  <td className="p-3 text-right text-zinc-400">{bw.dots}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Fall of Wickets */}
                      {activeInn.fallOfWickets.length > 0 && (
                        <div>
                          <div className="text-xs font-black uppercase text-sky-400 mb-2">Fall of Wickets</div>
                          <div className="flex flex-wrap gap-2">
                            {activeInn.fallOfWickets.map((fow, i) => (
                              <div key={i} className="bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-1.5 text-[11px]">
                                <span className="font-bold text-rose-400">{fow.wicketNumber}-{fow.score}</span>
                                <span className="text-zinc-400 ml-1.5">({fow.batterName}, {fow.over} ov)</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
