import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause,
  FastForward, 
  RotateCcw,
  Compass,
  Target,
  ChevronRight,
  Shield, 
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  RefreshCw,
  Flame,
  Award,
  Terminal,
  Bug,
  AlertTriangle
} from 'lucide-react';
import { PitchType, WeatherCondition } from '../types/match';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';
import { 
  BowlerFieldStrategyEngine, 
  FieldConfiguration, 
  Point
} from '../engine/strategy/BowlerFieldStrategyEngine';
import { DeliveryResult, DeliveryLifecycle } from '../types/delivery';
import { CaptainDecision } from '../engine/ai/AICaptainEngine';
import { DetailedBowlingPlan } from '../engine/ai/BowlingPlanEngine';
import { BattingIntent, BatterInningsState } from '../engine/ai/BatterDecisionEngine';

export type AnimationSpeed = 1 | 1.5 | 2 | 0; // 0 = Skip/Instant
export type BottomPanelTab = 'FIELD_MAP' | 'BOWLER_PLAN' | 'SCORING_ZONES' | 'AI_CAPTAIN';

export interface VisualizerProps {
  striker: Player | null;
  nonStriker: Player | null;
  bowler: Player | null;
  deliveryResult?: DeliveryResult | null;
  lifecycle?: DeliveryLifecycle;
  onPlaybackComplete?: () => void;
  onContactReached?: () => void;
  format: ArenaFormat;
  battingTeamName: string;
  bowlingTeamName: string;
  isFreeHit?: boolean;
  score?: { runs: number; wickets: number; overs: number; balls: number };
  target?: number;
  pitch?: PitchType;
  weather?: WeatherCondition;
  fieldingSquad?: Player[];
  partnershipRuns?: number;
  partnershipBalls?: number;
  testDaySession?: { day: number; session: 'Morning' | 'Afternoon' | 'Evening' };
  onFieldChangingChange?: (isChanging: boolean) => void;
  // AI Captain & Tactical Controls
  userTeamControlMode?: 'MANUAL' | 'AI_RECOMMENDATIONS' | 'FULL_AUTO';
  onUserTeamControlModeChange?: (mode: 'MANUAL' | 'AI_RECOMMENDATIONS' | 'FULL_AUTO') => void;
  aiCaptainRecommendation?: CaptainDecision | null;
  onApplyAIRecommendation?: (rec: CaptainDecision) => void;
  onIgnoreAIRecommendation?: () => void;
  userBattingIntent?: BattingIntent;
  onUserBattingIntentChange?: (intent: BattingIntent) => void;
  userBowlingPlan?: DetailedBowlingPlan | null;
  onUserBowlingPlanChange?: (plan: DetailedBowlingPlan) => void;
  isUserTeamBatting?: boolean;
  isUserTeamBowling?: boolean;
  opponentTacticalNotice?: string | null;
  eligibleBowlers?: Player[];
  onSelectBowlerManual?: (bowlerId: string) => void;
  batterState?: BatterInningsState | null;
  // Fallback compatibility
  lastBall?: any;
  ballCount?: number;
  className?: string;

  // Visualizer Header & Display Mode Customization
  hideTopHeader?: boolean;
  hideSideAndBottomPanels?: boolean;
  displayMode?: 'STANDARD' | 'LABELS';
  onDisplayModeChange?: (mode: 'STANDARD' | 'LABELS') => void;

  // Field preset & edit-field control (can be driven from outside the visualizer)
  fieldPresetKey?: string | null;
  onFieldPresetChange?: (presetKey: string | null) => void;
  editFieldMode?: boolean;
  onEditFieldModeChange?: (enabled: boolean) => void;
  playbackSpeed?: AnimationSpeed;
  onPlaybackSpeedChange?: (speed: AnimationSpeed) => void;
  isPlaybackPaused?: boolean;
  onTogglePause?: () => void;
  replayTrigger?: number;
  skipTrigger?: number;
  replayDeliveryResult?: DeliveryResult | null;
}

interface FielderLiveState {
  id: string;
  name: string;
  role: string;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  fromX: number;
  fromY: number;
  category: 'CATCHING' | 'RING' | 'BOUNDARY';
  isOutsideCircle: boolean;
  isCatching: boolean;
  tacticalRole: string;
  isMoving: boolean;
}

// 600 x 600 Circular Field Constants
const PITCH_CENTER: Point = { x: 300, y: 300 };
const BOWLER_CREASE: Point = { x: 300, y: 190 };
const BATTER_CREASE: Point = { x: 300, y: 410 };
const NON_STRIKER_CREASE: Point = { x: 300, y: 200 };
const BOUNDARY_RADIUS = 268;

export const clampFielderCoordinate = (p: Point): Point => {
  const dist = Math.hypot(p.x - 300, p.y - 300);
  const maxR = 260; // strictly inside 268 boundary
  let clampedX = dist > maxR ? 300 + ((p.x - 300) / dist) * maxR : p.x;
  let clampedY = dist > maxR ? 300 + ((p.y - 300) / dist) * maxR : p.y;

  // Guard pitch rectangle (x: 270-330, y: 165-435) - keep fielders off the central pitch strip
  if (clampedX >= 270 && clampedX <= 330 && clampedY >= 165 && clampedY <= 435) {
    clampedX = clampedX < 300 ? 255 : 345;
  }
  return { x: Math.round(clampedX), y: Math.round(clampedY) };
};

export default function CricketActionVisualizer({
  striker,
  nonStriker,
  bowler,
  deliveryResult,
  lifecycle = 'READY',
  onPlaybackComplete,
  onContactReached,
  format: initialFormat,
  battingTeamName,
  bowlingTeamName,
  isFreeHit = false,
  score,
  target,
  pitch = PitchType.BALANCED,
  weather = WeatherCondition.SUNNY,
  fieldingSquad,
  partnershipRuns = 0,
  partnershipBalls = 0,
  testDaySession = { day: 1, session: 'Morning' },
  onFieldChangingChange,
  userTeamControlMode = 'AI_RECOMMENDATIONS',
  onUserTeamControlModeChange,
  aiCaptainRecommendation,
  onApplyAIRecommendation,
  onIgnoreAIRecommendation,
  userBattingIntent = 'NORMAL',
  onUserBattingIntentChange,
  userBowlingPlan,
  onUserBowlingPlanChange,
  isUserTeamBatting = false,
  isUserTeamBowling = false,
  opponentTacticalNotice,
  eligibleBowlers = [],
  onSelectBowlerManual,
  batterState,
  lastBall,
  ballCount = 0,
  className,
  hideTopHeader = false,
  hideSideAndBottomPanels = false,
  displayMode: propDisplayMode,
  onDisplayModeChange,
  fieldPresetKey: propFieldPresetKey,
  onFieldPresetChange,
  editFieldMode: propEditFieldMode,
  onEditFieldModeChange,
  playbackSpeed: propSpeed,
  onPlaybackSpeedChange,
  isPlaybackPaused: propIsPaused,
  onTogglePause,
  replayTrigger,
  skipTrigger,
  replayDeliveryResult,
}: VisualizerProps) {
  // Format state
  const [selectedFormat, setSelectedFormat] = useState<ArenaFormat>(initialFormat);
  useEffect(() => {
    setSelectedFormat(initialFormat);
  }, [initialFormat]);

  // Display Mode state (Standard vs Labels)
  const [internalDisplayMode, setInternalDisplayMode] = useState<'STANDARD' | 'LABELS'>(propDisplayMode || 'LABELS');
  useEffect(() => {
    if (propDisplayMode) setInternalDisplayMode(propDisplayMode);
  }, [propDisplayMode]);
  const effectiveDisplayMode = propDisplayMode || internalDisplayMode;
  const handleDisplayModeToggle = (mode: 'STANDARD' | 'LABELS') => {
    setInternalDisplayMode(mode);
    onDisplayModeChange?.(mode);
  };

  // Controls State
  const [speed, setSpeed] = useState<AnimationSpeed>(propSpeed !== undefined ? propSpeed : 1);
  const [isPaused, setIsPaused] = useState<boolean>(propIsPaused !== undefined ? propIsPaused : false);
  const [activeBottomTab, setActiveBottomTab] = useState<BottomPanelTab>('FIELD_MAP');
  const [internalPresetKey, setInternalPresetKey] = useState<string | null>(null);
  const [showDebugHUD, setShowDebugHUD] = useState<boolean>(false);

  // Edit Field gate: fielders can only be dragged while editing is enabled
  const [internalEditField, setInternalEditField] = useState<boolean>(false);
  const editFieldEnabled = propEditFieldMode !== undefined ? propEditFieldMode : internalEditField;
  const handleEditFieldToggle = () => {
    const next = !editFieldEnabled;
    setInternalEditField(next);
    onEditFieldModeChange?.(next);
  };

  // Preset can be driven from outside (sidebar Field Setup menu) or from the field overlay select
  const activePresetKey = propFieldPresetKey !== undefined ? propFieldPresetKey : internalPresetKey;
  const setActivePresetKey = (key: string | null) => {
    setInternalPresetKey(key);
    if (propFieldPresetKey !== undefined) onFieldPresetChange?.(key);
  };

  useEffect(() => {
    if (propSpeed !== undefined) {
      setSpeed(propSpeed);
    }
  }, [propSpeed]);

  useEffect(() => {
    if (propIsPaused !== undefined) {
      setIsPaused(propIsPaused);
    }
  }, [propIsPaused]);

  // Field Strategy Configuration
  const [fieldConfig, setFieldConfig] = useState<FieldConfiguration>(() => {
    return BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: initialFormat,
      bowler,
      striker,
      nonStriker,
      overs: score?.overs || 0,
      balls: score?.balls || 0,
      wickets: score?.wickets || 0,
      runs: score?.runs || 0,
      target,
      pitch,
      weather,
      partnershipRuns,
      partnershipBalls,
      fieldingSquad,
      testDaySession,
    });
  });

  // Physical Fielders in 2D Space
  const [fielders, setFielders] = useState<FielderLiveState[]>(() => {
    return fieldConfig.fielders.map((f) => {
      const pos = clampFielderCoordinate(f.targetPos);
      return {
        id: f.id,
        name: f.name,
        role: f.positionName,
        currentX: pos.x,
        currentY: pos.y,
        targetX: pos.x,
        targetY: pos.y,
        fromX: pos.x,
        fromY: pos.y,
        category: f.isCatching ? 'CATCHING' : f.isOutsideCircle ? 'BOUNDARY' : 'RING',
        isOutsideCircle: f.isOutsideCircle,
        isCatching: f.isCatching,
        tacticalRole: f.tacticalRole,
        isMoving: false,
      };
    });
  });

  const [isFieldChanging, setIsFieldChanging] = useState<boolean>(false);
  const [fieldChangeProgress, setFieldChangeProgress] = useState<number>(100);
  const [changedFieldersList, setChangedFieldersList] = useState<FieldConfiguration['changedFielders']>([]);

  // 2D Continuous Ball Animation State
  const [ballPos, setBallPos] = useState<Point>(BOWLER_CREASE);
  const [ballVisible, setBallVisible] = useState<boolean>(false);
  const [ballTrail, setBallTrail] = useState<Point[]>([]);
  const [ballScale, setBallScale] = useState<number>(1);
  const [animProgress, setAnimProgress] = useState<number>(0);
  const [playbackStage, setPlaybackStage] = useState<'IDLE' | 'BOWLER_RELEASE' | 'PITCH_BOUNCE' | 'BAT_CONTACT' | 'BALL_TRAVEL' | 'OUTCOME'>('IDLE');
  
  // Interactive entities
  const [bowlerPos, setBowlerPos] = useState<Point>({ x: 300, y: 120 });
  const [strikerPos, setStrikerPos] = useState<Point>(BATTER_CREASE);
  const [nonStrikerPos, setNonStrikerPos] = useState<Point>(NON_STRIKER_CREASE);
  const [batRotation, setBatRotation] = useState<number>(0);
  const [bailsFlying, setBailsFlying] = useState<boolean>(false);
  const [boundaryEffect, setBoundaryEffect] = useState<{ x: number; y: number; active: boolean; isSix?: boolean } | null>(null);
  const [impactBurst, setImpactBurst] = useState<Point | null>(null);
  const [resultBanner, setResultBanner] = useState<string | null>(null);

  // Drag and drop tweaking
  const [draggedFielderId, setDraggedFielderId] = useState<string | null>(null);

  // Active delivery result reference (immutable)
  const activeDelivery = useMemo(() => {
    if (deliveryResult) return deliveryResult;
    // Fallback if raw lastBall passed from legacy callers
    if (lastBall) {
      return {
        id: `fb_${Date.now()}`,
        ballNumber: ballCount,
        overIndex: score?.overs || 0,
        ballInOver: (score?.balls || 0) + 1,
        strikerId: striker?.id || 'str',
        strikerName: striker?.name || 'Striker',
        nonStrikerId: nonStriker?.id || 'ns',
        nonStrikerName: nonStriker?.name || 'Non-Striker',
        bowlerId: bowler?.id || 'bw',
        bowlerName: bowler?.name || 'Bowler',
        legalBall: lastBall.extraType !== 'Wide' && lastBall.extraType !== 'No Ball',
        batterRuns: lastBall.isExtra ? 0 : lastBall.runs || 0,
        extraRuns: lastBall.isExtra ? lastBall.runs || 0 : 0,
        totalRuns: lastBall.runs || 0,
        wicket: Boolean(lastBall.isWicket),
        wicketType: lastBall.wicketType,
        shotType: lastBall.runs === 6 ? 'LOFTED_SIX' : lastBall.runs === 4 ? 'DRIVE_FOUR' : 'DEFENSE',
        targetZone: lastBall.runs === 6 ? 'LONG_ON' : 'PITCH',
        ballPath: {
          start: { x: 300, y: 190 },
          bounce: { x: 300, y: 330 },
          contact: { x: 300, y: 410 },
          target: lastBall.runs === 6 ? { x: 360, y: 55 } : lastBall.runs === 4 ? { x: 170, y: 285 } : { x: 300, y: 460 },
          isAerial: lastBall.runs === 6,
        },
        resultType: (lastBall.isWicket ? 'WICKET' : lastBall.runs === 6 ? 'SIX' : lastBall.runs === 4 ? 'FOUR' : lastBall.runs > 0 ? 'SINGLE' : 'DOT') as any,
        commentary: lastBall.commentary || 'Delivery in play',
        timestamp: Date.now(),
        strikeRotated: (lastBall.runs || 0) % 2 === 1,
        overCompleted: false,
      } as DeliveryResult;
    }
    return null;
  }, [deliveryResult, lastBall, ballCount, score, striker, nonStriker, bowler]);

  // Animation Frame Refs
  const animFrameRef = useRef<number | null>(null);
  const fieldMoveAnimFrameRef = useRef<number | null>(null);
  const onPlaybackCompleteRef = useRef(onPlaybackComplete);
  onPlaybackCompleteRef.current = onPlaybackComplete;
  const onContactReachedRef = useRef(onContactReached);
  onContactReachedRef.current = onContactReached;
  const onFieldChangingChangeRef = useRef(onFieldChangingChange);
  onFieldChangingChangeRef.current = onFieldChangingChange;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lastPlayedDeliveryIdRef = useRef<string | null>(null);

  // Tracking paused progress
  const pausedProgressRef = useRef<number>(0);
  const isPausedRef = useRef<boolean>(false);
  isPausedRef.current = isPaused;

  const isTest = selectedFormat === 'TEST';
  const ballColor = isTest ? '#DC2626' : '#FFFFFF';
  const ballStroke = isTest ? '#7F1D1D' : '#CBD5E1';

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 1. PHYSICAL 2D FIELDER MOVEMENT ENGINE
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const applyNewFieldConfiguration = useCallback((newConfig: FieldConfiguration) => {
    setFieldConfig(newConfig);

    const currentPositionsMap = new Map(fielders.map(f => [f.id, { x: f.currentX, y: f.currentY, role: f.role }]));
    let hasMovement = false;
    const movingList: FieldConfiguration['changedFielders'] = [];

    const updatedFielders: FielderLiveState[] = newConfig.fielders.map((f) => {
      const clampedTarget = clampFielderCoordinate(f.targetPos);
      const rawCurrent = currentPositionsMap.get(f.id) || { x: clampedTarget.x, y: clampedTarget.y, role: f.positionName };
      const clampedCurrent = clampFielderCoordinate(rawCurrent);
      const dist = Math.hypot(clampedTarget.x - clampedCurrent.x, clampedTarget.y - clampedCurrent.y);
      const isMoving = dist > 4;

      if (isMoving) {
        hasMovement = true;
        movingList.push({
          playerId: f.id,
          playerName: f.name,
          fromRole: rawCurrent.role,
          toRole: f.positionName,
          fromPoint: { x: clampedCurrent.x, y: clampedCurrent.y },
          toPoint: { x: clampedTarget.x, y: clampedTarget.y },
        });
      }

      return {
        id: f.id,
        name: f.name,
        role: f.positionName,
        currentX: clampedCurrent.x,
        currentY: clampedCurrent.y,
        targetX: clampedTarget.x,
        targetY: clampedTarget.y,
        fromX: clampedCurrent.x,
        fromY: clampedCurrent.y,
        category: f.isCatching ? 'CATCHING' : f.isOutsideCircle ? 'BOUNDARY' : 'RING',
        isOutsideCircle: f.isOutsideCircle,
        isCatching: f.isCatching,
        tacticalRole: f.tacticalRole,
        isMoving,
      };
    });

    setChangedFieldersList(movingList.length > 0 ? movingList : newConfig.changedFielders);

    if (!hasMovement || speed === 0) {
      setFielders(updatedFielders.map(f => ({ ...f, currentX: f.targetX, currentY: f.targetY, isMoving: false })));
      setIsFieldChanging(false);
      setFieldChangeProgress(100);
      onFieldChangingChangeRef.current?.(false);
      return;
    }

    setFielders(updatedFielders);
    setIsFieldChanging(true);
    setFieldChangeProgress(0);
    onFieldChangingChangeRef.current?.(true);

    if (fieldMoveAnimFrameRef.current) cancelAnimationFrame(fieldMoveAnimFrameRef.current);

    const duration = speed === 1 ? 1400 : speed === 1.5 ? 950 : 600;
    let startTime: number | null = null;

    const moveStep = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const rawProgress = Math.min(1, elapsed / duration);
      const ease = rawProgress < 0.5 
        ? 4 * rawProgress * rawProgress * rawProgress 
        : 1 - Math.pow(-2 * rawProgress + 2, 3) / 2;

      setFieldChangeProgress(Math.round(rawProgress * 100));

      setFielders(prev => prev.map(f => {
        if (!f.isMoving) return f;
        return {
          ...f,
          currentX: rawProgress >= 1 ? f.targetX : f.fromX + (f.targetX - f.fromX) * ease,
          currentY: rawProgress >= 1 ? f.targetY : f.fromY + (f.targetY - f.fromY) * ease,
          isMoving: rawProgress < 1,
        };
      }));

      if (rawProgress < 1) {
        fieldMoveAnimFrameRef.current = requestAnimationFrame(moveStep);
      } else {
        setIsFieldChanging(false);
        setFieldChangeProgress(100);
        onFieldChangingChangeRef.current?.(false);
      }
    };

    fieldMoveAnimFrameRef.current = requestAnimationFrame(moveStep);
  }, [fielders, speed]);

  const triggerTacticalRecalculation = useCallback((presetKey?: string) => {
    const newConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
      format: selectedFormat,
      bowler,
      striker,
      nonStriker,
      overs: score?.overs || 0,
      balls: score?.balls || 0,
      wickets: score?.wickets || 0,
      runs: score?.runs || 0,
      target,
      pitch,
      weather,
      partnershipRuns,
      partnershipBalls,
      fieldingSquad,
      previousConfig: fieldConfig,
      manualPresetKey: presetKey,
      testDaySession,
    });
    applyNewFieldConfiguration(newConfig);
  }, [selectedFormat, bowler, striker, nonStriker, score, target, pitch, weather, partnershipRuns, partnershipBalls, fieldingSquad, fieldConfig, testDaySession, applyNewFieldConfiguration]);

  // External preset changes (e.g. Field Setup menu in the live-match sidebar)
  useEffect(() => {
    if (propFieldPresetKey === undefined) return;
    if (propFieldPresetKey === internalPresetKey) return;
    setInternalPresetKey(propFieldPresetKey);
    triggerTacticalRecalculation(propFieldPresetKey || undefined);
  }, [propFieldPresetKey, internalPresetKey, triggerTacticalRecalculation]);

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // 2. CONTINUOUS 2D BALL MOVEMENT & TRAIL PLAYBACK
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const runContinuousBallAnimation = useCallback((delivery: DeliveryResult, resumeFromProgress: number = 0, isReplay: boolean = false) => {
    if (speed === 0) {
      // Instant / Skip mode
      setBallVisible(false);
      setBallPos(delivery.ballPath.target);
      setAnimProgress(100);
      setPlaybackStage('OUTCOME');
      setResultBanner(delivery.wicket ? (delivery.wicketType?.toUpperCase() || 'WICKET!') : delivery.totalRuns === 6 ? 'SIX!' : delivery.totalRuns === 4 ? 'FOUR!' : delivery.totalRuns > 0 ? `${delivery.totalRuns} RUNS` : 'DOT BALL');
      if (!isReplay) {
        onContactReachedRef.current?.();
        onPlaybackCompleteRef.current?.();
      }
      return;
    }

    const path = delivery.ballPath;
    const baseDuration = delivery.totalRuns === 6 ? 1500 : delivery.totalRuns === 4 ? 1300 : delivery.totalRuns > 0 ? 1150 : 950;
    const speedMult = speed === 1 ? 1 : speed === 1.5 ? 0.7 : 0.45;
    const totalDuration = baseDuration * speedMult;

    let startTime: number | null = null;
    let contactTriggered = false;

    setBallVisible(true);
    setBailsFlying(false);
    setBoundaryEffect(null);
    setImpactBurst(null);
    setResultBanner(null);
    setBallTrail([]);

    setBowlerPos({ x: 300, y: 120 });
    setStrikerPos(BATTER_CREASE);
    setNonStrikerPos(NON_STRIKER_CREASE);
    setBallPos(path.start);

    const step = (timestamp: number) => {
      if (isPausedRef.current) {
        animFrameRef.current = requestAnimationFrame(step);
        return;
      }

      if (!startTime) {
        startTime = timestamp - (resumeFromProgress * totalDuration);
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / totalDuration);
      pausedProgressRef.current = progress;
      setAnimProgress(Math.round(progress * 100));

      let curX = path.start.x;
      let curY = path.start.y;
      let curScale = 1;

      // â”€â”€ Stage 1: Bowler Run-up to Bowling Crease (0.00 - 0.22)
      if (progress < 0.22) {
        setPlaybackStage('BOWLER_RELEASE');
        const pNorm = progress / 0.22;
        const bY = 120 + (pNorm * 65);
        setBowlerPos({ x: 300, y: bY });

        // Ball remains in bowler's hand
        curX = 300;
        curY = bY;
        curScale = 1;
      }
      // â”€â”€ Stage 2: Bowler Crease to Pitch Bounce (0.22 - 0.45)
      else if (progress < 0.45) {
        setPlaybackStage('BOWLER_RELEASE');
        setBowlerPos({ x: 300, y: 185 });
        const pRelease = (progress - 0.22) / 0.23;

        curX = path.start.x + (path.bounce.x - path.start.x) * pRelease;
        curY = path.start.y + (path.bounce.y - path.start.y) * pRelease;
        curScale = 1 + Math.sin(pRelease * Math.PI) * 0.22;
      }
      // â”€â”€ Stage 3: Pitch Bounce to Bat Contact (0.45 - 0.58)
      else if (progress < 0.58) {
        setPlaybackStage('PITCH_BOUNCE');
        const pBounce = (progress - 0.45) / 0.13;
        curX = path.bounce.x + (path.contact.x - path.bounce.x) * pBounce;
        curY = path.bounce.y + (path.contact.y - path.bounce.y) * pBounce;
        // Batter swing anticipation
        setBatRotation(Math.sin(pBounce * Math.PI) * -38);
      }
      // â”€â”€ Stage 4: Bat Contact to Target Zone / Boundary (0.58 - 0.90)
      else if (progress < 0.90) {
        setPlaybackStage('BALL_TRAVEL');
        const pTravel = (progress - 0.58) / 0.32;

        if (!contactTriggered) {
          contactTriggered = true;
          setImpactBurst({ x: path.contact.x, y: path.contact.y });
          if (!isReplay) {
            onContactReachedRef.current?.();
          }
        }

        curX = path.contact.x + (path.target.x - path.contact.x) * pTravel;
        curY = path.contact.y + (path.target.y - path.contact.y) * pTravel;

        if (path.isAerial) {
          const arc = Math.sin(pTravel * Math.PI);
          curScale = 1 + arc * 0.75;
        } else {
          curScale = 1;
        }

        setBatRotation(Math.sin((1 - pTravel) * Math.PI) * 25);

        // Batters running between wickets
        if (delivery.totalRuns > 0 && !delivery.wicket) {
          const runSpeed = Math.min(1, pTravel * (delivery.totalRuns >= 2 ? 1.8 : 1.1));
          const sY = BATTER_CREASE.y - (runSpeed * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          const nsY = NON_STRIKER_CREASE.y + (runSpeed * (BATTER_CREASE.y - NON_STRIKER_CREASE.y));
          setStrikerPos({ x: 300, y: sY });
          setNonStrikerPos({ x: 300, y: nsY });
        }

        if (delivery.wicket && delivery.wicketType === 'Bowled') {
          setBailsFlying(true);
        }
      }
      // â”€â”€ Stage 5: Outcome & Boundary Wave (0.90 - 1.00)
      else {
        setPlaybackStage('OUTCOME');
        curX = path.target.x;
        curY = path.target.y;

        if (delivery.totalRuns >= 4) {
          setBoundaryEffect({
            x: path.target.x,
            y: path.target.y,
            active: true,
            isSix: delivery.totalRuns === 6,
          });
        }

        if (delivery.wicket) {
          setResultBanner(delivery.wicketType?.toUpperCase() || 'WICKET!');
        } else if (delivery.totalRuns === 6) {
          setResultBanner('SIX!');
        } else if (delivery.totalRuns === 4) {
          setResultBanner('FOUR!');
        } else if (delivery.totalRuns > 0) {
          setResultBanner(`${delivery.totalRuns} RUN${delivery.totalRuns > 1 ? 'S' : ''}`);
        } else {
          setResultBanner('DOT BALL');
        }
      }

      setBallPos({ x: curX, y: curY });
      setBallScale(curScale);

      // Record visible trail points (keeps last 6 coordinates)
      setBallTrail(prev => [...prev.slice(-5), { x: curX, y: curY }]);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        if (!isReplay) {
          onPlaybackCompleteRef.current?.();
        }
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [speed]);

  // Execute animation upon new deliveryResult arrival
  useEffect(() => {
    if (activeDelivery && activeDelivery.id !== lastPlayedDeliveryIdRef.current && !isFieldChanging) {
      lastPlayedDeliveryIdRef.current = activeDelivery.id;
      setIsPaused(false);
      pausedProgressRef.current = 0;
      runContinuousBallAnimation(activeDelivery, 0, false);
    }
  }, [activeDelivery, isFieldChanging, runContinuousBallAnimation]);

  // Clean up animation loop
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (fieldMoveAnimFrameRef.current) cancelAnimationFrame(fieldMoveAnimFrameRef.current);
    };
  }, []);

  // Replay Last Delivery
  const handleReplay = () => {
    if (!activeDelivery) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsPaused(false);
    pausedProgressRef.current = 0;
    runContinuousBallAnimation(activeDelivery, 0, true);
  };

  // Skip Current Playback
  const handleSkip = () => {
    if (!activeDelivery) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsPaused(false);
    setAnimProgress(100);
    setPlaybackStage('OUTCOME');
    onPlaybackCompleteRef.current?.();
  };

  const prevReplayRef = useRef(replayTrigger);
  useEffect(() => {
    if (replayTrigger !== undefined && replayTrigger !== prevReplayRef.current) {
      prevReplayRef.current = replayTrigger;
      handleReplay();
    }
  }, [replayTrigger]);

  const prevSkipRef = useRef(skipTrigger);
  useEffect(() => {
    if (skipTrigger !== undefined && skipTrigger !== prevSkipRef.current) {
      prevSkipRef.current = skipTrigger;
      handleSkip();
    }
  }, [skipTrigger]);

  const prevReplayDeliveryIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (replayDeliveryResult && replayDeliveryResult.id !== prevReplayDeliveryIdRef.current) {
      prevReplayDeliveryIdRef.current = replayDeliveryResult.id;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setIsPaused(false);
      pausedProgressRef.current = 0;
      runContinuousBallAnimation(replayDeliveryResult, 0, true);
    }
  }, [replayDeliveryResult, runContinuousBallAnimation]);

  // Drag & drop interactive fielder adjustment on SVG
  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedFielderId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * 600;
    const svgY = ((e.clientY - rect.top) / rect.height) * 600;
    const distFromCenter = Math.hypot(svgX - 300, svgY - 300);
    const maxR = 265;
    const finalX = distFromCenter > maxR ? 300 + ((svgX - 300) / distFromCenter) * maxR : svgX;
    const finalY = distFromCenter > maxR ? 300 + ((svgY - 300) / distFromCenter) * maxR : svgY;

    setFielders(prev => prev.map(f => f.id === draggedFielderId ? {
      ...f,
      currentX: Math.round(finalX),
      currentY: Math.round(finalY),
      targetX: Math.round(finalX),
      targetY: Math.round(finalY),
    } : f));
  };

  const bowlingPlan = fieldConfig.bowlingPlan;
  const isLeftHander = (striker as any)?.battingHand === 'Left' || false;

  return (
    <div className={cn(
      "w-full rounded-2xl overflow-hidden border border-slate-800/80 bg-gradient-to-b from-[#0a0f1d] via-[#070b14] to-[#04060a] text-slate-100 shadow-2xl font-sans select-none relative",
      className
    )}>
      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          TOP MATCH BAR: BRANDING, FORMAT, SCORE, SPEED & PLAYBACK CONTROLS
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {!hideTopHeader && (
        <div className="w-full px-4 py-3 bg-slate-950/90 backdrop-blur-xl border-b border-white/10 flex flex-wrap items-center justify-between gap-3 z-30">
        {/* Branding & Format Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <Compass className="w-4 h-4 text-white animate-spin-slow" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-cyan-400 uppercase leading-none">CRICKET ARENA</div>
              <div className="text-xs font-black tracking-wide text-white">FIELD TACTICS 2D</div>
            </div>
          </div>

          <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

          {/* Format Selector */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10">
            {(['T20', 'ODI', 'TEST'] as ArenaFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  setSelectedFormat(fmt);
                  const newConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
                    format: fmt,
                    bowler,
                    striker,
                    nonStriker,
                    overs: score?.overs || 0,
                    balls: score?.balls || 0,
                    wickets: score?.wickets || 0,
                    runs: score?.runs || 0,
                    target,
                    pitch,
                    weather,
                    partnershipRuns,
                    partnershipBalls,
                    fieldingSquad,
                    previousConfig: fieldConfig,
                    testDaySession,
                  });
                  applyNewFieldConfiguration(newConfig);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                  selectedFormat === fmt
                    ? fmt === 'TEST'
                      ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                      : fmt === 'ODI'
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                        : "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Live Scoreboard Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
              {isFieldChanging ? 'FIELD IN MOTION' : lifecycle === 'RESULT_LOCKED' || lifecycle === 'BALL_PATH_PLAYBACK' ? 'IN PLAY' : 'READY'}
            </span>
          </div>

          {score && (
            <div className="flex items-baseline gap-2 bg-white/[0.04] px-3 py-1 rounded-xl border border-white/5">
              <span className="text-xs font-bold text-slate-400 truncate max-w-[80px]">{battingTeamName}</span>
              <span className="text-sm font-black text-white tabular-nums tracking-tight">
                {score.runs}/{score.wickets}
              </span>
              <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                ({score.overs}.{score.balls} ov)
              </span>
            </div>
          )}

          {isTest && testDaySession && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/40 border border-red-500/30 text-[10px] font-bold text-red-200">
              <Award className="w-3 h-3 text-red-400" />
              <span>Day {testDaySession.day} â€¢ {testDaySession.session}</span>
            </div>
          )}
        </div>

        {/* Playback Controls (1x, 1.5x, 2x, Pause/Resume, Replay, Skip, Debug) */}
        <div className="flex items-center gap-1.5">
          {/* Speed Buttons */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10">
            {([1, 1.5, 2] as AnimationSpeed[]).map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-black transition-all",
                  speed === spd
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Pause / Resume */}
          <button
            onClick={() => setIsPaused(v => !v)}
            title={isPaused ? "Resume" : "Pause"}
            className={cn(
              "p-1.5 rounded-xl border text-xs transition-colors",
              isPaused 
                ? "bg-amber-500/20 border-amber-400 text-amber-300" 
                : "bg-slate-900 border-white/10 text-slate-300 hover:text-white"
            )}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>

          {/* Replay */}
          <button
            onClick={handleReplay}
            title="Replay Last Ball"
            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Skip */}
          <button
            onClick={handleSkip}
            title="Skip Animation"
            className="px-2 py-1 rounded-xl bg-slate-900 border border-white/10 text-[10px] font-black text-slate-300 hover:text-white transition-colors"
          >
            Skip
          </button>

          {/* Debug Panel Toggle */}
          <button
            onClick={() => setShowDebugHUD(v => !v)}
            title="Toggle Debug Panel"
            className={cn(
              "p-1.5 rounded-xl border text-xs transition-colors",
              showDebugHUD 
                ? "bg-purple-500/20 border-purple-400 text-purple-300" 
                : "bg-slate-900 border-white/10 text-slate-400 hover:text-white"
            )}
          >
            <Bug className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MAIN RESPONSIVE SECTION: CIRCULAR 2D FIELD + RIGHT TACTICS PANEL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="w-full flex flex-col lg:flex-row items-stretch justify-between relative bg-[#060913]">
        {/* â”€â”€ 2D CIRCULAR PLAYING GROUND (SVG) â”€â”€ */}
        <div className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden min-h-[460px] lg:min-h-[560px]">
          {/* Subtle Outer Stadium Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-500/10 blur-[90px]" />
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-blue-500/10 blur-[90px]" />
            <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px]" />
          </div>

          {/* Fielder Display Mode Pill (Standard vs Labels) */}
          <div className="absolute top-3.5 left-3.5 z-30 flex items-center gap-2">
            <div className="flex items-center bg-slate-950/85 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => handleDisplayModeToggle('STANDARD')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  effectiveDisplayMode === 'STANDARD'
                    ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => handleDisplayModeToggle('LABELS')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  effectiveDisplayMode === 'LABELS'
                    ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Labels
              </button>
            </div>
          </div>

          {/* Field Strategy Preset & Field Status Badge */}
          <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-1.5 sm:gap-2">
            {/* Edit Field Toggle (enables drag-repositioning of fielders) */}
            <button
              type="button"
              onClick={handleEditFieldToggle}
              title={editFieldEnabled ? 'Editing on â€” drag fielders to reposition them' : 'Turn on to drag fielders into position'}
              className={cn(
                "px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black backdrop-blur-md shadow-lg border flex items-center gap-1.5 transition-all",
                editFieldEnabled
                  ? "bg-cyan-500 text-slate-950 border-cyan-300"
                  : "bg-slate-950/90 text-slate-300 border-white/15 hover:text-white"
              )}
            >
              {editFieldEnabled ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              Edit Field
            </button>

            {/* Tactical Presets Dropdown */}
            <select
              value={activePresetKey || ''}
              onChange={(e) => {
                const val = e.target.value;
                setActivePresetKey(val || null);
                triggerTacticalRecalculation(val || undefined);
              }}
              className="bg-slate-950/90 backdrop-blur-md text-slate-200 text-[10px] sm:text-xs font-bold px-2.5 py-1.5 rounded-xl border border-white/15 focus:outline-none focus:border-cyan-400 shadow-lg cursor-pointer"
              title="Select Field Preset"
            >
              <option value="">Default Preset</option>
              {Object.entries(BowlerFieldStrategyEngine.PRESET_OVERLAYS).map(([pKey, pDef]) => (
                <option key={pKey} value={pKey}>
                  {pDef.name.split('(')[0].trim()}
                </option>
              ))}
            </select>

            {/* Field Status Pill */}
            <span
              className={cn(
                "px-2.5 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 tracking-wider backdrop-blur-md shadow-lg border",
                isFieldChanging
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
                  : playbackStage === 'BALL_TRAVEL' || playbackStage === 'PITCH_BOUNCE'
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isFieldChanging
                    ? "bg-amber-400"
                    : playbackStage === 'BALL_TRAVEL' || playbackStage === 'PITCH_BOUNCE'
                    ? "bg-blue-400"
                    : "bg-emerald-400"
                )}
              />
              <span className="hidden sm:inline">
                {isFieldChanging ? 'Fielders Moving' : playbackStage === 'BALL_TRAVEL' || playbackStage === 'PITCH_BOUNCE' ? 'Ball in Flight' : 'Field Settled'}
              </span>
              <span className="sm:hidden">
                {isFieldChanging ? 'Moving' : playbackStage === 'BALL_TRAVEL' || playbackStage === 'PITCH_BOUNCE' ? 'In Flight' : 'Settled'}
              </span>
            </span>
          </div>

          <div className="w-full max-w-[540px] aspect-square mx-auto relative flex items-center justify-center">
            <svg
              ref={svgRef}
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-full drop-shadow-[0_0_50px_rgba(0,0,0,0.95)] cursor-crosshair relative z-10 select-none"
              onMouseMove={handleSvgMouseMove}
              onMouseUp={() => setDraggedFielderId(null)}
            >
            <defs>
              {/* Field Turf Radial Gradient */}
              <radialGradient id="fieldGrass2D" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#15803d" />
                <stop offset="45%" stopColor="#166534" />
                <stop offset="85%" stopColor="#14532d" />
                <stop offset="100%" stopColor="#052e16" />
              </radialGradient>

              {/* Pitch Soil Texture Gradient */}
              <linearGradient id="pitchSoil2D" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#92400e" />
                <stop offset="20%" stopColor="#b45309" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="80%" stopColor="#b45309" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>

              {/* Cyan Arrowhead for Movement Paths */}
              <marker
                id="arrowCyan2D"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 9 5 L 0 9 z" fill="#22D3EE" />
              </marker>

              {/* Ball Glow Filter */}
              <filter id="ballGlow2D" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Circular Playing Ground Surface */}
            <circle cx="300" cy="300" r="280" fill="url(#fieldGrass2D)" stroke="#064e3b" strokeWidth="6" />

            {/* Concentric Lawn Mowing Rings */}
            {[250, 215, 180, 145, 110, 75].map((r, i) => (
              <circle
                key={r}
                cx="300"
                cy="300"
                r={r}
                fill="none"
                stroke={i % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.06)"}
                strokeWidth="18"
              />
            ))}

            {/* 2. Inner 30-Yard Circle (Ellipse: rx=160, ry=190) */}
            <ellipse
              cx="300"
              cy="300"
              rx="160"
              ry="190"
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.6"
              strokeDasharray="5 5"
            />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((ang) => {
              const rad = ang * (Math.PI / 180);
              const mx = 300 + 160 * Math.sin(rad);
              const my = 300 - 190 * Math.cos(rad);
              return <circle key={ang} cx={mx} cy={my} r="2" fill="white" opacity="0.4" />;
            })}

            {/* 3. Boundary Rope Circle */}
            <circle
              cx="300"
              cy="300"
              r={BOUNDARY_RADIUS}
              fill="none"
              stroke={boundaryEffect?.active ? (boundaryEffect.isSix ? "#C084FC" : "#38BDF8") : "rgba(255,255,255,0.3)"}
              strokeWidth={boundaryEffect?.active ? "4.5" : "2.2"}
              className="transition-all duration-300"
            />

            {/* 4. Central Cricket Pitch Strip */}
            <rect
              x="272"
              y="170"
              width="56"
              height="260"
              rx="4"
              fill="url(#pitchSoil2D)"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1"
            />
            {/* Bowling Crease (y=190) & Popping Crease (y=410) */}
            <line x1="272" y1="190" x2="328" y2="190" stroke="white" strokeWidth="1.8" />
            <line x1="272" y1="410" x2="328" y2="410" stroke="white" strokeWidth="2.2" />
            <line x1="284" y1="174" x2="284" y2="190" stroke="white" strokeWidth="1.2" />
            <line x1="316" y1="174" x2="316" y2="190" stroke="white" strokeWidth="1.2" />
            <line x1="284" y1="410" x2="284" y2="426" stroke="white" strokeWidth="1.2" />
            <line x1="316" y1="410" x2="316" y2="426" stroke="white" strokeWidth="1.2" />

            {/* Stumps & Bails (Bowler End y=182, Striker End y=418) */}
            <g transform="translate(300, 182)">
              <line x1="-3" y1="0" x2="-3" y2="8" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="0" x2="0" y2="8" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="0" x2="3" y2="8" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              <line x1="-4" y1="0" x2="4" y2="0" stroke="#FDE047" strokeWidth="1.5" />
            </g>
            <g transform="translate(300, 418)">
              <line x1="-3" y1="-8" x2="-3" y2="0" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              <line x1="0" y1="-8" x2="0" y2="0" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              <line x1="3" y1="-8" x2="3" y2="0" stroke="#FEF08A" strokeWidth="2" strokeLinecap="round" />
              {bailsFlying ? (
                <g className="animate-ping">
                  <line x1="-8" y1="-14" x2="-2" y2="-12" stroke="#F87171" strokeWidth="2" />
                  <line x1="2" y1="-12" x2="8" y2="-14" stroke="#F87171" strokeWidth="2" />
                </g>
              ) : (
                <line x1="-4" y1="-8" x2="4" y2="-8" stroke="#FDE047" strokeWidth="1.5" />
              )}
            </g>

            {/* Pitch Legend Indicator (Off / Leg side) */}
            <text x="250" y="300" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="900" letterSpacing="1">
              {isLeftHander ? 'LEG' : 'OFF'}
            </text>
            <text x="350" y="300" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="900" letterSpacing="1">
              {isLeftHander ? 'OFF' : 'LEG'}
            </text>

            {/* 5. Destination Markers & Movement Paths (During Field Changes) */}
            {isFieldChanging && fielders.map((f) => {
              if (!f.isMoving) return null;
              return (
                <g key={`arrow_${f.id}`}>
                  <line
                    x1={f.fromX}
                    y1={f.fromY}
                    x2={f.targetX}
                    y2={f.targetY}
                    stroke="#22D3EE"
                    strokeWidth="2.2"
                    strokeDasharray="4 3"
                    markerEnd="url(#arrowCyan2D)"
                    opacity="0.85"
                  />
                  <g transform={`translate(${f.targetX}, ${f.targetY})`}>
                    <circle r="11" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" className="animate-spin-slow" />
                    <circle r="4" fill="#06B6D4" opacity="0.6" className="animate-ping" />
                    <text y="-12" textAnchor="middle" fill="#38BDF8" fontSize="7.5" fontWeight="900">
                      {f.role}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 6. Active Fielders in 2D Positions */}
            {fielders.map((fielder) => {
              const isCatching = fielder.category === 'CATCHING';
              const isBoundary = fielder.category === 'BOUNDARY';

              return (
                <g
                  key={fielder.id}
                  transform={`translate(${fielder.currentX}, ${fielder.currentY})`}
                  onMouseDown={() => { if (editFieldEnabled) setDraggedFielderId(fielder.id); }}
                  className={editFieldEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
                >
                  <title>{editFieldEnabled ? `${fielder.role} (${fielder.name}) â€” drag to reposition` : `${fielder.role} (${fielder.name})`}</title>
                  <circle
                    r="9.5"
                    fill={fielder.isMoving ? "#22D3EE" : "#2563EB"}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    opacity={fielder.isMoving ? "0.95" : "0.92"}
                  />
                  <circle r="2.8" fill="#FFFFFF" />

                  {/* Position Label Pill: Only displayed in LABELS mode */}
                  {effectiveDisplayMode === 'LABELS' && (
                    <g transform={`translate(0, ${fielder.currentY > 480 ? -14 : 14})`}>
                      <rect
                        x="-26"
                        y="-7"
                        width="52"
                        height="13"
                        rx="3.5"
                        fill="#0B132B"
                        stroke={fielder.isMoving ? "#22D3EE" : "rgba(255,255,255,0.25)"}
                        strokeWidth="0.8"
                        opacity="0.92"
                      />
                      <text
                        textAnchor="middle"
                        y="2.5"
                        fill={fielder.isMoving ? "#22D3EE" : "#F8FAFC"}
                        fontSize="7"
                        fontWeight="900"
                      >
                        {fielder.role}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 7. Wicketkeeper (Anchor at y=460) */}
            <g transform="translate(300, 460)">
              <title>Wicketkeeper</title>
              <circle r="9" fill="#F59E0B" opacity="0.6" />
              <circle r="7.5" fill="#FBBF24" stroke="#FFF" strokeWidth="1.8" />
              <circle r="2.8" fill="#78350F" />
              {effectiveDisplayMode === 'LABELS' && (
                <g transform="translate(0, 14)">
                  <rect x="-24" y="-7" width="48" height="13" rx="3.5" fill="#0B132B" stroke="#F59E0B" strokeWidth="0.8" opacity="0.9" />
                  <text textAnchor="middle" y="2.5" fill="#FDE68A" fontSize="7" fontWeight="900">
                    Wicketkeeper
                  </text>
                </g>
              )}
            </g>

            {/* 8. Non-Striker & Bowler Markers */}
            <g transform={`translate(${nonStrikerPos.x + 16}, ${nonStrikerPos.y})`}>
              <circle r="8" fill="#0284C7" stroke="white" strokeWidth="1.6" />
              <circle r="3" fill="white" />
              <text y="14" textAnchor="middle" fill="#7DD3FC" fontSize="6.5" fontWeight="900">Non-Str</text>
            </g>
            <g transform={`translate(${bowlerPos.x - 16}, ${bowlerPos.y})`}>
              <circle r="8.5" fill="#DC2626" stroke="white" strokeWidth="1.6" />
              <circle r="3" fill="white" />
              <text y="14" textAnchor="middle" fill="#FCA5A5" fontSize="6.5" fontWeight="900">Bowler</text>
            </g>

            {/* 9. Striker & Bat Marker */}
            <g transform={`translate(${strikerPos.x}, ${strikerPos.y})`}>
              <circle r="9" fill="#2563EB" stroke="white" strokeWidth="1.8" />
              <circle r="3.5" fill="white" />
              <line
                x1="0"
                y1="0"
                x2="13"
                y2="-6"
                stroke="#F59E0B"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${batRotation})`}
              />
              <text y="15" textAnchor="middle" fill="#93C5FD" fontSize="6.5" fontWeight="900">Striker</text>
            </g>

            {/* 10. Visible Ball Motion Trail */}
            {ballVisible && ballTrail.map((pt, i) => (
              <circle
                key={`trail_${i}`}
                cx={pt.x}
                cy={pt.y}
                r={Math.max(1.8, 4.2 * ((i + 1) / ballTrail.length))}
                fill={isTest ? "#EF4444" : "#38BDF8"}
                opacity={((i + 1) / ballTrail.length) * 0.65}
              />
            ))}

            {/* 11. Moving Cricket Ball */}
            {ballVisible && (
              <g transform={`translate(${ballPos.x}, ${ballPos.y}) scale(${ballScale})`}>
                <circle
                  r={isTest ? 4.8 : 4.2}
                  fill={ballColor}
                  stroke={ballStroke}
                  strokeWidth="1.2"
                  filter="url(#ballGlow2D)"
                />
              </g>
            )}

            {/* 12. Bat Contact Impact Burst */}
            {impactBurst && (
              <circle
                cx={impactBurst.x}
                cy={impactBurst.y}
                r="16"
                fill="none"
                stroke="#FDE047"
                strokeWidth="2.8"
                className="animate-ping"
              />
            )}

            {/* 13. Boundary LED Wave */}
            {boundaryEffect?.active && (
              <g>
                <circle
                  cx={boundaryEffect.x}
                  cy={boundaryEffect.y}
                  r={boundaryEffect.isSix ? "36" : "24"}
                  fill="none"
                  stroke={boundaryEffect.isSix ? "#C084FC" : "#38BDF8"}
                  strokeWidth="3.5"
                  className="animate-ping"
                />
              </g>
            )}
          </svg>
          </div>

          {/* Delivery Result Banner Overlay */}
          <AnimatePresence>
            {resultBanner && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-7 py-3 rounded-2xl backdrop-blur-xl border font-black text-2xl tracking-wider shadow-2xl z-40 text-center pointer-events-none flex items-center gap-2",
                  resultBanner.includes('SIX') && "bg-purple-950/90 border-purple-400 text-purple-200 shadow-purple-500/40 text-3xl animate-pulse",
                  resultBanner.includes('FOUR') && "bg-blue-950/90 border-blue-400 text-blue-200 shadow-blue-500/40 text-3xl",
                  resultBanner.includes('WICKET') && "bg-red-950/90 border-red-500 text-red-100 shadow-red-500/50 text-3xl",
                  resultBanner.includes('RUN') && "bg-zinc-900/90 border-white/20 text-white text-xl",
                  resultBanner.includes('DOT') && "bg-black/90 border-white/10 text-white/70 text-base"
                )}
              >
                {resultBanner.includes('SIX') && <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />}
                {resultBanner}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Field Changing Badge */}
          {isFieldChanging && (
            <div className="absolute top-14 left-3.5 bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-cyan-300 shadow-xl z-20">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>FIELDERS MOVING... ({fieldChangeProgress}%)</span>
            </div>
          )}

          {/* Opponent AI Action Banner */}
          {opponentTacticalNotice && (
            <div className="absolute top-14 right-3.5 bg-slate-950/90 backdrop-blur-md border border-purple-500/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-bold text-purple-200 shadow-2xl z-20 animate-pulse">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{opponentTacticalNotice}</span>
            </div>
          )}
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            RIGHT-SIDE FIELD TACTICS PANEL
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {!hideSideAndBottomPanels && (
          <div className="w-full lg:w-84 xl:w-96 bg-slate-950/80 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/10 p-4 flex flex-col justify-between gap-4 z-20">
            <div className="space-y-4 overflow-y-auto max-h-[520px] pr-1">
              {/* Team Tactical Control Mode */}
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-400 uppercase tracking-wider">Tactical Control</span>
                <span className="text-cyan-400 font-black">{userTeamControlMode.replace('_', ' ')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {(['MANUAL', 'AI_RECOMMENDATIONS', 'FULL_AUTO'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => onUserTeamControlModeChange?.(m)}
                    className={cn(
                      "py-1 rounded text-[8px] font-black uppercase transition-all truncate border",
                      userTeamControlMode === m
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400 shadow-sm"
                        : "bg-black/30 text-slate-400 hover:text-white border-white/5"
                    )}
                  >
                    {m === 'AI_RECOMMENDATIONS' ? 'AI REC' : m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Captain Recommendation Card */}
            {aiCaptainRecommendation && (
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-950/40 to-slate-950/80 border border-indigo-500/30 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    AI Captain Rec
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    {aiCaptainRecommendation.confidence}% Conf
                  </span>
                </div>

                <div className="space-y-1.5 text-[10px]">
                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 block font-bold text-[8px] uppercase tracking-wider">Observation</span>
                    <span className="text-slate-200 font-medium">{aiCaptainRecommendation.observation}</span>
                  </div>

                  <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                    <span className="text-slate-400 block font-bold text-[8px] uppercase tracking-wider">Recommendation</span>
                    <span className="text-cyan-300 font-bold">{aiCaptainRecommendation.reasoning}</span>
                  </div>

                  {aiCaptainRecommendation.tradeOff && (
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-slate-400 block font-bold text-[8px] uppercase tracking-wider">Expected Trade-Off</span>
                      <span className="text-amber-300/90 font-medium">{aiCaptainRecommendation.tradeOff}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onApplyAIRecommendation?.(aiCaptainRecommendation)}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black flex items-center justify-center gap-1 shadow-md shadow-indigo-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Apply Recommendation
                  </button>
                  <button
                    onClick={() => onIgnoreAIRecommendation?.()}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-bold border border-white/10 transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            )}

            {/* Interactive Batting Intent Selector (When User Team is Batting) */}
            {isUserTeamBatting && (
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3 h-3 text-amber-400" />
                    My Batting Intent
                  </span>
                  <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    {userBattingIntent}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['SURVIVAL', 'DEFENSIVE', 'SETTLING', 'ROTATE_STRIKE', 'NORMAL', 'CONTROLLED_ATTACK', 'ACCELERATE'] as const).map((intent) => (
                    <button
                      key={intent}
                      onClick={() => onUserBattingIntentChange?.(intent)}
                      className={cn(
                        "py-1 px-1 rounded text-[8px] font-black uppercase transition-all border truncate",
                        userBattingIntent === intent
                          ? "bg-amber-500/30 text-amber-200 border-amber-400 shadow-sm"
                          : "bg-black/30 text-slate-400 hover:text-white border-white/5"
                      )}
                    >
                      {intent === 'ROTATE_STRIKE' ? 'ROTATE' : intent === 'CONTROLLED_ATTACK' ? 'ATTACK' : intent}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* Bowler Profile */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-red-500 to-amber-500 flex items-center justify-center font-black text-white text-sm shadow-md">
                  {bowler?.name ? bowler.name.substring(0, 2).toUpperCase() : 'BW'}
                </div>
                <div>
                  <div className="text-xs font-black text-white">{bowler?.name || 'Current Bowler'}</div>
                  <div className="text-[10px] font-bold text-slate-400">{bowler?.bowlingStyle || bowler?.role || 'Fast Bowler'}</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-black text-cyan-400 uppercase tracking-wider block">Overs</span>
                <span className="text-xs font-bold text-slate-300">{score?.overs || 0}.{score?.balls || 0}</span>
              </div>
            </div>

            {/* Bowling Plan */}
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-cyan-400" />
                  Bowling Plan
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {bowlingPlan.intent}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Target Line</span>
                  <span className="font-black text-white">{bowlingPlan.line.replace(/_/g, ' ')}</span>
                </div>
                <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                  <span className="text-slate-400 block font-bold text-[8px] uppercase">Target Length</span>
                  <span className="font-black text-amber-300">{bowlingPlan.length}</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-300 leading-relaxed font-medium bg-black/20 p-2 rounded-lg border border-white/5">
                {bowlingPlan.summary}
              </div>
            </div>

            {/* Tactical Intent & Configuration */}
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Flame className="w-3 h-3 text-purple-400" />
                  Tactical Intent
                </span>
                <span className="text-[9px] font-bold text-purple-300">{fieldConfig.phase}</span>
              </div>

              <div className="text-xs font-black text-white">
                {fieldConfig.name}
              </div>

              <div className="text-[10px] text-slate-300 leading-relaxed font-medium">
                {fieldConfig.tacticalIntent}
              </div>
            </div>

            {/* Moving Fielders List */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Field Adjustments ({changedFieldersList.length})
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase flex items-center gap-1",
                  isFieldChanging 
                    ? "bg-cyan-500/20 text-cyan-300 animate-pulse border border-cyan-500/40" 
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                )}>
                  {isFieldChanging ? (
                    <>
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      FIELD CHANGING
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      FIELD READY
                    </>
                  )}
                </span>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    isFieldChanging ? "bg-gradient-to-r from-cyan-400 to-blue-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${fieldChangeProgress}%` }}
                />
              </div>

              <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                {changedFieldersList.length > 0 ? (
                  changedFieldersList.map((ch, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px] bg-black/30 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="font-bold text-slate-300 truncate max-w-[80px]">{ch.playerName}</span>
                      <div className="flex items-center gap-1 text-[9px]">
                        <span className="text-slate-400">{ch.fromRole}</span>
                        <ChevronRight className="w-2.5 h-2.5 text-cyan-400" />
                        <span className="font-black text-cyan-300">{ch.toRole}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-[10px] text-slate-500 italic py-1 text-center">
                    Field settled and configured.
                  </div>
                )}
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Tactical Presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(BowlerFieldStrategyEngine.PRESET_OVERLAYS).map(([pKey, pDef]) => (
                  <button
                    key={pKey}
                    onClick={() => {
                      setActivePresetKey(pKey);
                      triggerTacticalRecalculation(pKey);
                    }}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-left text-[9px] font-bold transition-all border truncate",
                      activePresetKey === pKey
                        ? "bg-cyan-500/20 text-cyan-200 border-cyan-400"
                        : "bg-white/[0.03] text-slate-400 hover:text-white border-white/5"
                    )}
                  >
                    {pDef.name.split('(')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-white/10 flex items-center gap-2">
            <button
              onClick={() => {
                setActivePresetKey(null);
                triggerTacticalRecalculation();
              }}
              className="flex-1 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              Auto Field
            </button>
            <button
              onClick={() => {
                setIsFieldChanging(false);
                setFieldChangeProgress(100);
                onFieldChangingChangeRef.current?.(false);
              }}
              className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-black flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirm Field
            </button>
          </div>
        </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          BOTTOM PANEL: TABS & DELIVERY STATUS
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {!hideSideAndBottomPanels && (
        <div className="w-full bg-slate-950/95 backdrop-blur-xl border-t border-white/10">
          <div className="px-4 py-2 border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {(['FIELD MAP', 'BOWLER PLAN', 'SCORING ZONES', 'AI CAPTAIN'] as const).map((tab) => {
              const tabKey = tab.replace(' ', '_') as BottomPanelTab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveBottomTab(tabKey)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all",
                    activeBottomTab === tabKey
                      ? "bg-white text-slate-950 shadow-md"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className={cn(
              "px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 tracking-wider",
              isFieldChanging || lifecycle === 'DELIVERY_SIMULATION' || lifecycle === 'BALL_PATH_PLAYBACK'
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            )}>
              {isFieldChanging ? (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  DELIVERY LOCKED â€” FIELD IN MOTION
                </>
              ) : lifecycle === 'BALL_PATH_PLAYBACK' ? (
                <>
                  <Lock className="w-3 h-3 text-amber-400" />
                  BALL IN FLIGHT ({animProgress}%)
                </>
              ) : (
                <>
                  <Unlock className="w-3 h-3 text-emerald-400" />
                  READY FOR NEXT DELIVERY
                </>
              )}
            </span>
          </div>
        </div>

        <div className="p-4">
          {activeBottomTab === 'FIELD_MAP' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">30-Yard Ring Split</span>
                <span className="text-base font-black text-cyan-400">
                  {11 - fieldConfig.actualOutsideCircle - 2} Inside / {fieldConfig.actualOutsideCircle} Outside
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  Max allowed deep: {fieldConfig.maxOutsideCircle}
                </span>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Side Balance</span>
                <span className="text-base font-black text-white">
                  {fieldConfig.offSideCount} Off / {fieldConfig.legSideCount} Leg
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">
                  Max leg side: 5 (Lawful)
                </span>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Format Restrictions</span>
                <span className="text-xs font-black text-emerald-400">
                  {fieldConfig.isCompliant ? 'Fully Compliant' : 'Warning: Ring breach'}
                </span>
                <span className="text-[9px] text-slate-500 block mt-0.5">{fieldConfig.phase}</span>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Interactive Tweak</span>
                <span className="text-xs font-black text-purple-400">Drag & Drop Active</span>
                <span className="text-[9px] text-slate-500 block mt-0.5">Drag any fielder to adjust</span>
              </div>
            </div>
          )}

          {activeBottomTab === 'BOWLER_PLAN' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Line & Length Strategy</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-bold text-[10px]">{bowlingPlan.line}</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-bold text-[10px]">{bowlingPlan.length}</span>
                </div>
                <p className="text-[10px] text-slate-300 pt-1 leading-relaxed">
                  Target release angle planned to challenge {isLeftHander ? "left-hander's outside edge" : "right-hander's off-stump"}.
                </p>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Ball Variation</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold text-[10px]">{bowlingPlan.variation}</span>
                  <span className="text-[10px] text-slate-400">{pitch} Pitch</span>
                </div>
                <p className="text-[10px] text-slate-300 pt-1 leading-relaxed">
                  Surface conditions ({pitch}) offer grip and variable bounce for variation execution.
                </p>
              </div>
              <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Tactical Intent</span>
                <span className="text-sm font-black text-cyan-400">{bowlingPlan.intent}</span>
                <p className="text-[10px] text-slate-300 pt-1 leading-relaxed">{bowlingPlan.summary}</p>
              </div>
            </div>
          )}

          {activeBottomTab === 'SCORING_ZONES' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
                <span>360Â° Ground Wagon Wheel Zone</span>
                <span>Protection & Risk Status</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {fieldConfig.scoringZones.map((z, idx) => (
                  <div key={idx} className="bg-white/[0.03] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-black text-white">{z.zone}</div>
                      <div className="text-[9px] text-slate-400">Angle: {z.angleRange[0]}Â° to {z.angleRange[1]}Â°</div>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase block",
                        z.protection === 'COVERED' 
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      )}>
                        {z.protection}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 tabular-nums">{z.riskLevel} Risk</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeBottomTab === 'AI_CAPTAIN' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Batter Psychological & Innings State Gauge */}
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Striker Psychology</span>
                    <span className="text-[9px] font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {batterState ? (
                        batterState.settledness < 30 ? 'Tentative' :
                        batterState.settledness < 60 ? 'Building Rhythm' :
                        batterState.settledness < 80 ? 'Well Settled' : 'Dominant'
                      ) : 'Normal'}
                    </span>
                  </div>

                  {/* Settledness Gauge */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">Settledness</span>
                      <span className="text-cyan-300 font-black">{batterState ? `${Math.round(batterState.settledness)}%` : '50%'}</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${batterState ? Math.min(100, Math.max(5, batterState.settledness)) : 50}%` }}
                      />
                    </div>
                  </div>

                  {/* Concentration & Confidence */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[9px]">
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-slate-500 block font-bold">Concentration</span>
                      <span className="text-white font-black">{batterState ? `${Math.round(batterState.concentration)}%` : '75%'}</span>
                    </div>
                    <div className="bg-black/40 p-2 rounded-lg border border-white/5">
                      <span className="text-slate-500 block font-bold">Confidence</span>
                      <span className="text-amber-300 font-black">{batterState ? `${Math.round(batterState.confidence)}%` : '60%'}</span>
                    </div>
                  </div>
                </div>

                {/* Matchup Breakdown */}
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Striker vs Bowler Matchup</span>
                  <div className="space-y-1.5 text-[10px]">
                    <div className="flex items-center justify-between bg-black/40 p-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-400">{striker?.name || 'Striker'}</span>
                      <span className="text-cyan-300 font-bold">{isLeftHander ? 'LHB' : 'RHB'} Â· {striker?.role || 'Batter'}</span>
                    </div>
                    <div className="flex items-center justify-between bg-black/40 p-1.5 rounded-lg border border-white/5">
                      <span className="text-slate-400">{bowler?.name || 'Bowler'}</span>
                      <span className="text-amber-300 font-bold">{bowler?.bowlingStyle || bowler?.role || 'Fast'}</span>
                    </div>
                    <div className="text-[9px] text-slate-300 bg-cyan-950/20 p-1.5 rounded border border-cyan-500/20">
                      Targeting: {bowlingPlan.line.replace(/_/g, ' ')} ({bowlingPlan.length})
                    </div>
                  </div>
                </div>

                {/* Tactical Trade-Offs & Strategic Reasoning */}
                <div className="bg-white/[0.03] p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Tactical Trade-Offs</span>
                  <div className="space-y-1 text-[9px] text-slate-300">
                    <p className="bg-black/30 p-2 rounded-lg border border-white/5">
                      <span className="text-amber-400 font-bold block mb-0.5">Plan Trade-Off:</span>
                      {bowlingPlan.intent === 'ATTACKING'
                        ? 'Aggressive lines create wicket chances but leave boundary gaps if bowler errs in length.'
                        : bowlingPlan.intent === 'DEFENSIVE'
                        ? 'Deep boundary protection limits 4s/6s, but concedes easy singles and strike rotation.'
                        : 'Balanced field seeks to build dot-ball pressure without taking excessive boundary risk.'}
                    </p>
                    {aiCaptainRecommendation?.tradeOff && (
                      <p className="bg-indigo-950/30 p-2 rounded-lg border border-indigo-500/20 text-indigo-200">
                        <span className="text-indigo-400 font-bold block mb-0.5">Captain Analysis:</span>
                        {aiCaptainRecommendation.tradeOff}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Captain Quick Action Bar */}
              {aiCaptainRecommendation && (
                <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-900/40 p-3 rounded-xl border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div>
                      <span className="font-bold text-white text-xs">{aiCaptainRecommendation.observation}</span>
                      <span className="text-[10px] text-slate-400 block">{aiCaptainRecommendation.reasoning}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApplyAIRecommendation?.(aiCaptainRecommendation)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] transition-colors shadow-md"
                    >
                      Apply Recommendation
                    </button>
                    <button
                      onClick={() => onIgnoreAIRecommendation?.()}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-[10px] font-bold border border-white/10"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          DEVELOPMENT-ONLY DEBUG HUD PANEL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showDebugHUD && (
        <div className="p-3 bg-black/95 border-t border-purple-500/30 font-mono text-[10px] text-purple-300 space-y-2">
          <div className="flex items-center justify-between font-bold text-white border-b border-purple-500/20 pb-1">
            <span className="flex items-center gap-1.5 text-purple-400">
              <Terminal className="w-3.5 h-3.5" />
              CRICKET ENGINE DEBUG HUD & LIFECYCLE MONITOR
            </span>
            <span className="text-[9px] bg-purple-950 px-2 py-0.5 rounded border border-purple-500/40">DEV_MODE</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px]">
            <div className="bg-purple-950/30 p-2 rounded border border-purple-500/20">
              <span className="text-purple-400 block font-bold">LIFECYCLE</span>
              <span className="text-white font-black">{lifecycle}</span>
            </div>
            <div className="bg-purple-950/30 p-2 rounded border border-purple-500/20">
              <span className="text-purple-400 block font-bold">PLAYBACK STAGE</span>
              <span className="text-cyan-300 font-black">{playbackStage} ({animProgress}%)</span>
            </div>
            <div className="bg-purple-950/30 p-2 rounded border border-purple-500/20">
              <span className="text-purple-400 block font-bold">CURRENT BALL POS</span>
              <span className="text-white font-bold">X:{Math.round(ballPos.x)} Y:{Math.round(ballPos.y)}</span>
            </div>
            <div className="bg-purple-950/30 p-2 rounded border border-purple-500/20">
              <span className="text-purple-400 block font-bold">TARGET COORDS</span>
              <span className="text-amber-300 font-bold">
                X:{activeDelivery ? Math.round(activeDelivery.ballPath.target.x) : 300} Y:{activeDelivery ? Math.round(activeDelivery.ballPath.target.y) : 460}
              </span>
            </div>
          </div>

          {activeDelivery && (
            <div className="bg-black/60 p-2 rounded border border-white/10 text-[9px] space-y-1 overflow-x-auto">
              <span className="text-purple-400 font-bold block">IMMUTABLE DELIVERY RESULT:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-slate-300">
                <div>ID: <span className="text-white">{activeDelivery.id}</span></div>
                <div>Result: <span className="text-cyan-300 font-black">{activeDelivery.resultType}</span></div>
                <div>Runs: <span className="text-white">{activeDelivery.totalRuns} (B:{activeDelivery.batterRuns} E:{activeDelivery.extraRuns})</span></div>
                <div>Legal: <span className="text-white">{activeDelivery.legalBall ? 'YES' : 'NO'}</span></div>
                <div>Wicket: <span className="text-red-400 font-bold">{activeDelivery.wicket ? `${activeDelivery.wicketType}` : 'NONE'}</span></div>
                <div>Shot: <span className="text-white">{activeDelivery.shotType}</span></div>
                <div>Zone: <span className="text-white">{activeDelivery.targetZone}</span></div>
                <div>Rotated: <span className="text-white">{activeDelivery.strikeRotated ? 'YES' : 'NO'}</span></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

