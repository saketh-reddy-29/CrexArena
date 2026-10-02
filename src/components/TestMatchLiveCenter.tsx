import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import CricketActionVisualizer3D, { Visualizer3DProps, CameraMode } from './CricketActionVisualizer3D';
import {
  TestMatchPlaybackController,
  PlaybackSpeed,
} from '../engine/formats/test/TestMatchPlaybackController';
import {
  TestDeliveryRecord,
  TestMatchSummary,
  TestInningsData,
} from '../engine/formats/test/TestDeliveryModel';
import { FieldChangeOverlay } from '../game/ui/FieldChangeOverlay';
import { DeliveryStatus } from '../game/ui/DeliveryStatus';
import { DebugDeliveryPanel } from '../game/ui/DebugDeliveryPanel';
import { cn } from '../lib/utils';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';

export default function TestMatchLiveCenter() {
  const { currentMatchId, fixtures, franchises, players, selectedFranchiseId, setGameState } = useGameStore();

  const currentMatch = fixtures.find((f) => f.id === currentMatchId);
  const fallbackTeam1 = franchises[0];
  const fallbackTeam2 = franchises[1] || fallbackTeam1;
  const team1Franchise = franchises.find((t) => t.id === currentMatch?.team1Id) || fallbackTeam1;
  const team2Franchise = franchises.find((t) => t.id === currentMatch?.team2Id) || fallbackTeam2;

  // Build squads for both teams
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

  // Controller reference
  const controllerRef = useRef<TestMatchPlaybackController | null>(null);

  // Live match state
  const [matchSummary, setMatchSummary] = useState<TestMatchSummary | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1.0);
  const [currentStep, setCurrentStep] = useState<{ step: string; subtext: string }>({
    step: 'READY',
    subtext: 'Next delivery locked & ready',
  });

  // Overlays and modals
  const [showScorecardModal, setShowScorecardModal] = useState<boolean>(false);
  const [showReplayModal, setShowReplayModal] = useState<boolean>(false);
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
  const [sessionBreakBanner, setSessionBreakBanner] = useState<string | null>(null);

  // Initialize playback controller
  useEffect(() => {
    const controller = new TestMatchPlaybackController(
      currentMatchId || 'test-match-1',
      { id: team1Franchise.id, name: team1Franchise.name, shortName: team1Franchise.shortName, squad: team1Squad },
      { id: team2Franchise.id, name: team2Franchise.name, shortName: team2Franchise.shortName, squad: team2Squad },
      team1Franchise.id,
      {
        onStateUpdate: (summary) => setMatchSummary({ ...summary }),
        onDeliveryStep: (step, subtext) => setCurrentStep({ step, subtext }),
        onFieldChange: (bowlerName, strategy, plan, changes) => {
          setFieldChangeData({ isVisible: true, bowlerName, strategy, plan, changes });
          setTimeout(() => setFieldChangeData((prev) => ({ ...prev, isVisible: false })), 3500);
        },
        onOverComplete: (overNum, summary) => {
          setOverBanner(summary);
          setTimeout(() => setOverBanner(null), 2500);
        },
        onSessionBreak: (breakType, message) => {
          setSessionBreakBanner(message);
          setTimeout(() => setSessionBreakBanner(null), 4000);
        },
        onMilestone: (title, subtitle, badge) => {
          setActiveMilestone({ title, subtitle, badge });
          setTimeout(() => setActiveMilestone(null), 3500);
        },
      }
    );

    controllerRef.current = controller;
    setMatchSummary(controller.getSummary());

    // Start auto-playback
    controller.startContinuousMatch();

    return () => {
      controller.pause();
    };
  }, [currentMatchId, team1Franchise, team2Franchise, team1Squad, team2Squad]);

  // Handle Play / Pause
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

  // Handle Speed Change
  const handleSpeedChange = (newSpeed: PlaybackSpeed) => {
    setSpeedState(newSpeed);
    controllerRef.current?.setSpeed(newSpeed);
  };

  // Play next ball manually
  const handleNextBall = () => {
    if (!controllerRef.current) return;
    controllerRef.current.playNextBallManual();
  };

  // Take New Ball
  const handleTakeNewBall = () => {
    if (!controllerRef.current) return;
    controllerRef.current.takeNewBall();
  };

  // Helper variables
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

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white flex flex-col select-none overflow-x-hidden font-sans">
      {/* ── TOP BROADCAST TEST HEADER ── */}
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
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                  Test Match
                </span>
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                  Day {matchSummary?.day || 1} • {matchSummary?.sessionName || 'Morning Session'}
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

            {/* Lead / Trail / Target Indicator */}
            <div className="hidden sm:block text-left">
              {matchSummary?.target ? (
                <div className="text-xs font-bold text-emerald-400">
                  Target: {matchSummary.target} ({Math.max(0, matchSummary.target - (currentInning?.score || 0))} needed)
                </div>
              ) : matchSummary?.lead ? (
                <div className="text-xs font-bold text-blue-400">
                  Lead by {matchSummary.lead} runs
                </div>
              ) : matchSummary?.trail ? (
                <div className="text-xs font-bold text-amber-400">
                  Trail by {matchSummary.trail} runs
                </div>
              ) : (
                <div className="text-xs font-bold text-zinc-400">1st Innings</div>
              )}
              <div className="text-[10px] text-zinc-500">
                Overs Today: {matchSummary?.oversToday || 0}/90
              </div>
            </div>
          </div>

          {/* Quick Action Scorecard / Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScorecardModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 hover:bg-zinc-800 text-xs font-bold text-zinc-200 transition-colors shadow-sm"
            >
              <List className="w-3.5 h-3.5 text-amber-400" />
              <span>Full Scorecard</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN PLAYBACK VIEWPORT (3D GROUND + LIVE HUD) ── */}
      <div className="relative flex-1 min-h-[460px] lg:min-h-[580px] bg-zinc-950 flex flex-col justify-between">
        {/* 3D Ground Visualizer Viewport */}
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
            strikerStats={strikerStats ? {
              name: strikerStats.name,
              runs: strikerStats.runs,
              balls: strikerStats.balls,
              fours: strikerStats.fours,
              sixes: strikerStats.sixes,
              strikeRate: strikerStats.strikeRate,
              isStriker: true,
            } : undefined}
            nonStrikerStats={nonStrikerStats ? {
              name: nonStrikerStats.name,
              runs: nonStrikerStats.runs,
              balls: nonStrikerStats.balls,
              fours: nonStrikerStats.fours,
              sixes: nonStrikerStats.sixes,
              strikeRate: nonStrikerStats.strikeRate,
              isStriker: false,
            } : undefined}
            bowlerStats={bowlerStats ? {
              name: bowlerStats.name,
              overs: bowlerStats.overs,
              runs: bowlerStats.runs,
              wickets: bowlerStats.wickets,
              economy: bowlerStats.economy,
            } : undefined}
            ballCount={currentInning?.deliveries.length || 0}
            format="Test"
            battingTeamName={currentInning?.battingTeamName || 'Batting Team'}
            bowlingTeamName={currentInning?.bowlingTeamName || 'Bowling Team'}
            score={currentInning?.score || 0}
            wickets={currentInning?.wickets || 0}
            overs={currentInning?.overs || 0}
            balls={(currentInning?.overs || 0) * 6 + (currentInning?.balls || 0)}
            speed={speed === 0.75 ? 1 : (speed as any)}
            day={matchSummary?.day || 1}
            session={matchSummary?.session === 'MORNING' ? 1 : matchSummary?.session === 'AFTERNOON' ? 2 : 3}
            lead={matchSummary?.lead}
            trail={matchSummary?.trail}
            partnership={
              currentInning?.partnerships.find((p) => p.active)
                ? {
                    runs: currentInning.partnerships.find((p) => p.active)!.runs,
                    balls: currentInning.partnerships.find((p) => p.active)!.balls,
                  }
                : undefined
            }
          />
        </div>

        {/* ── OVERLAYS: Live Step Ticker, Field Change, Over Banner, Milestones ── */}
        <div className="relative z-30 pointer-events-none p-4 flex flex-col justify-between h-full">
          {/* Top Left Delivery Step Status Ticker */}
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

            {/* Field Setting Badge */}
            <div className="self-start mt-10 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 flex items-center gap-2 text-[10px] font-bold text-zinc-300">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>FIELD: {matchSummary?.fieldPreset.replace('_', ' ') || 'ATTACKING TEST'}</span>
            </div>
          </div>

          {/* Over Complete Banner */}
          <AnimatePresence>
            {overBanner && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="self-center bg-zinc-900/90 border border-amber-500/40 backdrop-blur-xl px-6 py-2.5 rounded-2xl shadow-2xl text-center"
              >
                <div className="text-[10px] font-black uppercase text-amber-400 tracking-wider">Over Complete</div>
                <div className="text-sm font-bold text-white">{overBanner}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Session Break Banner */}
          <AnimatePresence>
            {sessionBreakBanner && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="self-center bg-rose-950/90 border border-rose-500/40 backdrop-blur-xl px-8 py-4 rounded-3xl shadow-2xl text-center"
              >
                <div className="text-xs font-black uppercase text-rose-400 tracking-widest">Session Break</div>
                <div className="text-lg font-black text-white">{sessionBreakBanner}</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Milestone Toast Banner */}
          <AnimatePresence>
            {activeMilestone && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.9 }}
                className="self-center bg-gradient-to-r from-amber-600/90 to-yellow-500/90 backdrop-blur-xl border border-yellow-300/40 px-6 py-3 rounded-2xl shadow-[0_12px_40px_rgba(234,179,8,0.5)] text-center text-zinc-950"
              >
                <div className="text-[11px] font-black uppercase tracking-wider">{activeMilestone.badge || 'MILESTONE'}</div>
                <div className="text-base font-extrabold">{activeMilestone.title}</div>
                <div className="text-xs font-medium text-zinc-900">{activeMilestone.subtitle}</div>
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

      {/* ── BOTTOM LIVE HUD DASHBOARD (Section 39) ── */}
      <div className="bg-zinc-950 border-t border-zinc-800 p-4 z-40">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Current Batters */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between mb-2">
              <span>Current Batters</span>
              <span className="text-[9px] text-zinc-500">P'ship: {currentInning?.partnerships.find((p) => p.active)?.runs || 0} ({currentInning?.partnerships.find((p) => p.active)?.balls || 0})</span>
            </div>

            {/* Striker */}
            <div className="flex items-center justify-between py-1 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white truncate max-w-[120px]">{striker?.name || 'Striker'}*</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold uppercase">{strikerStats?.intent || 'SURVIVAL'}</span>
              </div>
              <div className="text-xs font-black text-zinc-100">
                {strikerStats?.runs || 0} <span className="text-[10px] text-zinc-400 font-normal">({strikerStats?.balls || 0})</span>
              </div>
            </div>

            {/* Non-Striker */}
            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-transparent border border-zinc-600" />
                <span className="text-xs font-medium text-zinc-300 truncate max-w-[120px]">{nonStriker?.name || 'Non-Striker'}</span>
              </div>
              <div className="text-xs font-semibold text-zinc-300">
                {nonStrikerStats?.runs || 0} <span className="text-[10px] text-zinc-500 font-normal">({nonStrikerStats?.balls || 0})</span>
              </div>
            </div>
          </div>

          {/* Card 2: Current Bowler & Tactics */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between mb-2">
              <span>Current Bowler</span>
              <span className="text-[9px] text-zinc-500">Ball Age: {matchSummary?.ballAge || 0} ov</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">{currentBowler?.name || 'Bowler'}</div>
                <div className="text-[10px] text-amber-400 font-semibold">{lastDelivery?.deliveryType || 'Good Length Outside Off'}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-black text-zinc-100">
                  {bowlerStats?.overs || 0}-{bowlerStats?.maidens || 0}-{bowlerStats?.runs || 0}-{bowlerStats?.wickets || 0}
                </div>
                <div className="text-[9px] text-zinc-400">Econ: {bowlerStats?.economy.toFixed(2) || '0.00'}</div>
              </div>
            </div>

            {matchSummary?.newBallAvailable && (
              <button
                onClick={handleTakeNewBall}
                className="mt-2 w-full py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-[10px] font-bold text-white uppercase tracking-wider transition-colors shadow-md animate-pulse"
              >
                Take New Ball
              </button>
            )}
          </div>

          {/* Card 3: Last 6 Balls */}
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

          {/* Card 4: Playback Controls (Play / Pause / Speed / Next Ball) */}
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-3 shadow-lg flex flex-col justify-between">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Playback Controls
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlayPause}
                className="flex-1 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
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

              {/* Speed Switcher */}
              <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 text-[10px] font-bold">
                {([0.75, 1.0, 1.5, 2.0] as PlaybackSpeed[]).map((s) => (
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

      {/* ── FULL TEST MATCH PROFESSIONAL SCORECARD MODAL ── */}
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
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950">
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-rose-500">Test Match Scorecard</div>
                  <div className="text-lg font-bold text-white">{team1Franchise.name} vs {team2Franchise.name}</div>
                </div>
                <button
                  onClick={() => setShowScorecardModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300"
                >
                  Close
                </button>
              </div>

              {/* Innings Tabs (1st, 2nd, 3rd, 4th) */}
              <div className="flex items-center gap-2 border-b border-zinc-800 px-6 py-2.5 bg-zinc-950/60 overflow-x-auto">
                {matchSummary?.innings.map((inn, idx) => (
                  <button
                    key={idx}
                    onClick={() => setScorecardTabInnings(idx)}
                    className={cn(
                      'px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors',
                      scorecardTabInnings === idx
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                    )}
                  >
                    {inn.battingTeamName} {inn.score}/{inn.wickets} ({idx + 1}st Inn)
                  </button>
                ))}
              </div>

              {/* Innings Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {(() => {
                  const activeInn = matchSummary?.innings[scorecardTabInnings];
                  if (!activeInn) return null;

                  const battersList = Object.values(activeInn.batters);
                  const bowlersList = Object.values(activeInn.bowlers).filter((b) => b.balls > 0);

                  return (
                    <>
                      {/* Innings Overview */}
                      <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4">
                        <div>
                          <div className="text-xs text-zinc-400 font-bold uppercase">{activeInn.battingTeamName} • {activeInn.statusText}</div>
                          <div className="text-2xl font-black text-white">{activeInn.score}/{activeInn.wickets}</div>
                        </div>
                        <div className="text-right text-xs text-zinc-400">
                          <div>Overs: <span className="font-bold text-white">{activeInn.overs}.{activeInn.balls}</span></div>
                          <div>Run Rate: <span className="font-bold text-white">{(activeInn.legalBalls > 0 ? (activeInn.score / (activeInn.legalBalls / 6)).toFixed(2) : '0.00')}</span></div>
                        </div>
                      </div>

                      {/* Batting Table */}
                      <div>
                        <div className="text-xs font-black uppercase text-amber-400 mb-2">Batting</div>
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

                      {/* Bowling Table */}
                      <div>
                        <div className="text-xs font-black uppercase text-amber-400 mb-2">Bowling</div>
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
                          <div className="text-xs font-black uppercase text-amber-400 mb-2">Fall of Wickets</div>
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

      {/* Development Debug Delivery Panel */}
      <DebugDeliveryPanel
        data={{
          format: 'TEST',
          innings: (matchSummary?.currentInningsIndex || 0) + 1,
          over: currentInning?.overs || 0,
          ball: currentInning?.balls || 0,
          batterName: striker?.name,
          bowlerName: currentBowler?.name,
          bowlerRole: currentBowler?.role,
          bowlingPlan: lastDelivery?.line || 'GOOD_LENGTH',
          shot: lastDelivery?.shot || 'FORWARD_DEFENCE',
          targetZone: lastDelivery?.targetZone || 'COVER',
          wicketProbability: 0.024,
          finalRoll: 0.55,
          result: lastDelivery?.result || 'DOT',
          ballState: currentStep.step,
          actionState: currentStep.subtext,
          score: `${currentInning?.score || 0}/${currentInning?.wickets || 0}`,
          nextState: 'READY_FOR_NEXT_BALL',
        }}
      />
    </div>
  );
}
