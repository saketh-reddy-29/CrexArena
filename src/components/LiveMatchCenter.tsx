import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Trophy,
  Play,
  Pause,
  RotateCcw,
  Compass,
  Sparkles,
  Shield,
  Flame,
  UserCheck,
  RefreshCw,
  ChevronRight,
  Target,
  Clock,
  Layers,
  ChevronDown,
  Lightbulb,
  Search,
  Bell,
  User,
  Newspaper,
  TrendingUp,
  Activity,
  CheckCircle2,
  Info,
  Award,
  Radio,
  BarChart3,
  Home,
  Calendar,
  Users,
  Settings,
  Maximize2,
  Minimize2,
  Video,
  MessageSquare,
  Sliders,
  Eye,
  Star,
  X,
  Save,
  WifiOff,
  AlertTriangle,
  RotateCw,
  Check
} from 'lucide-react';
import { GameState, useGameStore } from '../stores/useGameStore';
import type { Player } from '../types/common';
import { MatchEngine } from '../lib/matchEngine';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import { MatchStatus, PitchType, WeatherCondition, type InningsData, type PlayerMatchStats, type MatchResultType, DRSResult } from '../types/match';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import CricketActionVisualizer, { AnimationSpeed } from './CricketActionVisualizer';
import JerseyPlayerImage from './JerseyPlayerImage';
import SettingsModal from './common/SettingsModal';
import GoogleAccountModal from './auth/GoogleAccountModal';
import GoogleLoginButton from './auth/GoogleLoginButton';
import PlayerSelectionDrawer from './PlayerSelectionDrawer';
import FieldSetupDashboard from './FieldSetupDashboard';
import { ArenaFormat } from '../engine/models/ArenaState';
import { DeliveryLifecycle, DeliveryResult } from '../types/delivery';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { AICaptainEngine, CaptainDecision } from '../engine/ai/AICaptainEngine';
import type { ScoringZoneName } from '../engine/ai/AdaptiveCaptainEngine';
import { BatterDecisionEngine, BatterInningsState, BattingIntent } from '../engine/ai/BatterDecisionEngine';
import { BowlingPlanEngine, DetailedBowlingPlan } from '../engine/ai/BowlingPlanEngine';
import { BowlerFieldStrategyEngine, CANONICAL_POSITIONS, type FieldConfiguration } from '../engine/strategy/BowlerFieldStrategyEngine';
import { BallLifecycleController, BallLifecycleState } from '../engine/fielding/BallLifecycleController';
import type { MatchCheckpoint, MatchSaveStatus } from '../types/matchRecovery';
import { matchRecoveryStorage } from '../engine/storage/MatchRecoveryStorage';
import { validateField, getFieldingPhase, getRestrictionSummary, overFromBalls } from '../engine/fielding/FieldingRestrictionEngine';
import { restoreFieldState, serializeFieldState } from '../engine/fielding/fieldPersistence';
import {
  computeControlPermissions,
  canPerformAction,
  describeControlOwnership,
  getUserInteractiveActions,
} from '../engine/control/MatchControlPermissions';
import { decideBowlingChange } from '../engine/ai/BowlingAIController';
import { selectAINextBatter, selectAIOpeningBatters } from '../engine/ai/BattingAIController';
import {
  DEFAULT_TEST_RULES,
  canDeclareNow,
  determineTestResult,
  evaluateFollowOn,
  getFourthInningsTarget,
  getTestDaySession,
  isDayLimitReached,
  teamAggregate,
  type TestInningsSummary,
} from '../engine/formats/test/testMatchFlow';
import { matchConditionsForDay, summarizeConditionsForLive, describeWeather } from '../engine/conditions';
import type { MatchConditionsModel, MatchFormatKey } from '../engine/conditions';
import { cn } from '../lib/utils';

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

function resolveTeamLogo(team?: { shortName: string; logo?: string } | null): string {
  if (!team) return '';
  return getIntlTeamLogoUrl(team.shortName) || IPL_TEAM_LOGOS[team.shortName] || team.logo || '';
}

type Tab = 'Live' | 'Scorecard' | 'Commentary' | 'Tactics' | 'Field Setup' | 'Stats';

type TacticalMenuKey = 'BATTING' | 'BOWLING' | 'FIELD';

function ballChipClass(outcome: string): string {
  if (!outcome) return 'bg-slate-100 text-slate-300 border border-dashed border-slate-200';
  if (outcome === 'W') return 'bg-red-600 text-white border border-red-700';
  if (outcome === 'Wd' || outcome === 'Nb') return 'bg-amber-100 text-amber-700 border border-amber-300';
  if (outcome === '4' || outcome === '6') return 'bg-blue-600 text-white border border-blue-700';
  if (outcome === '0') return 'bg-slate-200 text-slate-500 border border-slate-300';
  return 'bg-emerald-100 text-emerald-700 border border-emerald-300';
}

const BATTING_INTENT_SHOT: Record<string, string> = {
  SURVIVAL: 'Solid Defence',
  DEFENSIVE: 'Forward Defence',
  SETTLING: 'Leave Outside Off',
  ROTATE_STRIKE: 'Nudge Into the Gap',
  NORMAL: 'Balanced Stroke',
  CONTROLLED_ATTACK: 'Cover Drive',
  ACCELERATE: 'Lofted Straight Drive',
};

const BOWLING_INTENT_ACTION: Record<string, string> = {
  WICKET_TAKING: 'Attack the Stumps',
  CONTAINING: 'Tight Line, No Freebies',
  DEFENSIVE: 'Wide Yorker Channel',
  ATTACKING: 'Hard Length at the Batter',
  SHORT_BALL_TRAP: 'Bouncer Into the Surface',
};

const DEFAULT_BOWLING_PLAN: DetailedBowlingPlan = {
  planType: 'DEFENSIVE_LINE',
  line: 'STUMPS',
  length: 'GOOD',
  variation: 'NORMAL',
  intent: 'WICKET_TAKING',
  tacticalPurpose: 'Build pressure with a disciplined line and length',
  targetScoringZones: ['COVER', 'MID_OFF'],
  riskProfile: 'MEDIUM',
  summary: 'Balanced stock delivery aimed at the stumps',
};

function playerInitials(name?: string): string {
  if (!name) return '--';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function TacticalMenu({
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  label: string;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">{label}</span>
        <span className="flex items-center gap-1.5">
          {hint && <span className="text-[9px] font-bold text-blue-600">{hint}</span>}
          <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <div className="p-2.5 space-y-2 border-t border-slate-100">{children}</div>}
    </div>
  );
}

interface BatterLine {
  balls: number;
  ballsSinceBoundary?: number;
  consecutiveDots?: number;
  dots?: number;
  fours: number;
  momentum?: number;
  out: boolean;
  runs: number;
  sixes: number;
  status: string;
  wicketBurst?: number;
}

interface WicketLog {
  ball: string;
  bowlerId: string;
  playerId: string;
  score: number;
  status: string;
  wicket: number;
  wicketType: string;
}

interface BowlerLine {
  balls: number;
  dots?: number;
  lastOverRuns?: number;
  momentum?: number;
  runs: number;
  wickets: number;
  bouncersThisOver?: number;
}

interface ExtrasLine {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
}

interface DeliveryLog {
  ball: string;
  batterId: string;
  bowlerId: string;
  isLegal: boolean;
  isWicket: boolean;
  outcome: string;
  over: number;
  runs: number;
}

interface InningsState {
  balls: number;
  batters: Record<string, BatterLine>;
  battingTeamId: string;
  bowlers: Record<string, BowlerLine>;
  bowlingTeamId: string;
  deliveries: DeliveryLog[];
  extras: ExtrasLine;
  commentary: CommentaryLine[];
  isComplete: boolean;
  declared?: boolean;
  isFollowOn?: boolean;
  partnershipBalls: number;
  partnershipRuns: number;
  recentBalls: string[];
  runRateHistory: number[];
  runs: number;
  wicketLog: WicketLog[];
  wickets: number;
  isFreeHitPending: boolean;
  drsReviewsRemaining: number;
  drsReviews: any[];
  strategicTimeouts: any[];
}

interface CommentaryLine {
  badge: string;
  ball: string;
  outcome: string;
  text: string;
  tone: 'dot' | 'four' | 'six' | 'wicket' | 'info';
}

const info = [
  ['Umpires', 'Nitin Menon, Chris Gaffaney'],
  ['Third umpire', 'Virender Sharma'],
  ['Referee', 'Javagal Srinath'],
];

function formatOvers(balls: number) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function strikeRate(runs: number, balls: number) {
  return balls ? ((runs / balls) * 100).toFixed(1) : '0.0';
}

function economy(runs: number, balls: number) {
  return balls ? (runs / (balls / 6)).toFixed(2) : '0.00';
}

/**
 * Maps a DeliveryResult target-zone label onto the captaincy wagon-zone arc so
 * the fielding AI can prioritise the batter's recently punished scoring areas.
 */
function zoneNameFromTargetZone(targetZone: string | undefined): ScoringZoneName | null {
  if (!targetZone) return null;
  const z = targetZone.toUpperCase();
  if (z.includes('THIRD_MAN')) return 'THIRD_MAN_GULLY';
  if (z.includes('GULLY') || z.includes('POINT') || z.includes('SQUARE_CUT')) return 'POINT_SQUARE';
  if (z.includes('COVER')) return 'COVER';
  if (z.includes('LONG_OFF') || z.includes('MID_OFF') || z.includes('STRAIGHT')) return 'LONG_OFF';
  if (z.includes('LONG_ON') || z.includes('MID_ON')) return 'LONG_ON';
  if (z.includes('COW') || z.includes('MID_WICKET')) return 'MID_WICKET_COW';
  if (z.includes('SQUARE_LEG')) return 'SQUARE_LEG';
  if (z.includes('FINE_LEG') || z.includes('GLANCE')) return 'FINE_LEG';
  return null;
}

function overRuns(score: InningsState | undefined) {
  if (!score) return [];
  const overs = Array.from({ length: Math.max(20, Math.ceil(score.balls / 6)) }, (_, over) => ({
    over,
    runs: 0,
    wickets: 0,
  }));
  score.deliveries.forEach((delivery) => {
    if (!overs[delivery.over]) overs[delivery.over] = { over: delivery.over, runs: 0, wickets: 0 };
    overs[delivery.over].runs += delivery.runs;
    if (delivery.isWicket) overs[delivery.over].wickets += 1;
  });
  return overs.slice(0, Math.max(1, Math.ceil(Math.max(score.balls, 1) / 6)));
}

function wormPoints(score: InningsState | undefined) {
  if (!score) return [];
  let total = 0;
  return score.deliveries
    .filter((delivery) => delivery.isLegal)
    .map((delivery, index) => {
      total += delivery.runs;
      return { ball: index + 1, runs: total, wicket: delivery.isWicket };
    });
}

function bowlerMaidens(score: InningsState | undefined, bowlerId: string) {
  if (!score) return 0;
  const byOver = new Map<number, { legal: number; runs: number }>();
  score.deliveries.forEach((delivery) => {
    if (delivery.bowlerId !== bowlerId) return;
    const row = byOver.get(delivery.over) || { legal: 0, runs: 0 };
    row.runs += delivery.runs;
    row.legal += delivery.isLegal ? 1 : 0;
    byOver.set(delivery.over, row);
  });
  return Array.from(byOver.values()).filter((row) => row.legal === 6 && row.runs === 0).length;
}

function inningsToStoreData(score: InningsState): InningsData {
  const batsmen: Record<string, PlayerMatchStats> = {};
  Object.entries(score.batters).forEach(([playerId, line]) => {
    batsmen[playerId] = {
      playerId,
      runs: line.runs,
      balls: line.balls,
      fours: line.fours,
      sixes: line.sixes,
      wickets: 0,
      overs: 0,
      runsConceded: 0,
      dots: line.dots || 0,
      oversBowled: 0,
      legalBallsThisOver: 0,
      bouncersThisOver: 0,
    };
  });

  const bowlers: Record<string, PlayerMatchStats> = {};
  Object.entries(score.bowlers).forEach(([playerId, line]) => {
    bowlers[playerId] = {
      playerId,
      runs: 0,
      balls: line.balls % 6,
      fours: 0,
      sixes: 0,
      wickets: line.wickets,
      overs: Math.floor(line.balls / 6),
      runsConceded: line.runs,
      dots: line.dots || 0,
      oversBowled: Math.floor(line.balls / 6),
      legalBallsThisOver: line.balls % 6,
      bouncersThisOver: 0,
    };
  });

  return {
    battingTeamId: score.battingTeamId,
    bowlingTeamId: score.bowlingTeamId,
    runs: score.runs,
    wickets: score.wickets,
    overs: Math.floor(score.balls / 6),
    balls: score.balls % 6,
    batsmen,
    bowlers,
    extras: score.extras,
    fallOfWickets: score.wicketLog.map((wicket) => ({
      score: wicket.score,
      wicket: wicket.wicket,
      over: Number(wicket.ball),
    })),
    isFreeHitPending: score.isFreeHitPending,
    drsReviews: score.drsReviews,
    drsReviewsRemaining: score.drsReviewsRemaining,
    strategicTimeouts: score.strategicTimeouts,
    currentPhase: MatchEngine.getPowerPlayPhase(Math.floor(score.balls / 6)),
  };
}

function emptyInnings(battingTeamId: string, bowlingTeamId: string): InningsState {
  return {
    balls: 0,
    batters: {},
    battingTeamId,
    bowlers: {},
    bowlingTeamId,
    deliveries: [],
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
    commentary: [],
    isComplete: false,
    partnershipBalls: 0,
    partnershipRuns: 0,
    recentBalls: [],
    runRateHistory: [],
    runs: 0,
    wicketLog: [],
    wickets: 0,
    isFreeHitPending: false,
    drsReviewsRemaining: 2,
    drsReviews: [],
    strategicTimeouts: [],
  };
}

export default function LiveMatchCenter() {
  const { 
    currentMatchId, 
    activeArenaId,
    fixtures, 
    franchises, 
    players, 
    selectedFranchiseId, 
    selectedSquadIds, 
    playingXIIds, 
    setSelectedSquadIds, 
    setPlayingXIIds, 
    currentMatchToss, 
    standings, 
    setGameState, 
    updateMatchResult, 
    liveMatchState, 
    saveLiveMatchState, 
    selectedFormat, 
    playerFatigue, 
    ensureMatchConditions,
    authUser,
    cloudSaveStatus,
    saveToCloud,
    activeMatchCheckpoint,
    saveMatchCheckpointAction,
    matchRecoveryStatus,
    setMatchRecoveryStatus,
  } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('Live');
  const [autoPlay, setAutoPlay] = useState(true);
  
  const checkpoint = (activeMatchCheckpoint?.matchId === currentMatchId ? activeMatchCheckpoint : null) 
    || (liveMatchState?.currentMatchId === currentMatchId ? (liveMatchState as any) : null);
  const isResuming = Boolean(checkpoint);
  
  const [inningNo, setInningNo] = useState<number>(isResuming ? checkpoint.inningNo : 1);
  const [innings, setInnings] = useState<InningsState[]>(isResuming ? checkpoint.innings : []);
  const [strikerId, setStrikerId] = useState<string | null>(isResuming ? checkpoint.strikerId : null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(isResuming ? checkpoint.nonStrikerId : null);
  const [bowlerId, setBowlerId] = useState<string | null>(isResuming ? checkpoint.bowlerId : null);
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string | null>(isResuming ? checkpoint.lastOverBowlerId : null);
  const [battingCursor, setBattingCursor] = useState(isResuming ? checkpoint.battingCursor : 2);
  const [pending, setPending] = useState<'openers' | 'batter' | 'bowler' | null>(isResuming ? checkpoint.pending : 'openers');
  const [pendingBatterEnd, setPendingBatterEnd] = useState<'striker' | 'non-striker'>(isResuming ? checkpoint.pendingBatterEnd : 'striker');
  const [pitch, setPitch] = useState<PitchType>(isResuming ? checkpoint.pitch : PitchType.BALANCED);
  const [weather, setWeather] = useState<WeatherCondition>(isResuming ? checkpoint.weather : WeatherCondition.SUNNY);
  
  const [manualBallRequests, setManualBallRequests] = useState(0);
  const [queueBowlerAfterBatter, setQueueBowlerAfterBatter] = useState(false);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const [declarePending, setDeclarePending] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactOutgoingId, setImpactOutgoingId] = useState<string | null>(null);
  const [impactIncomingId, setImpactIncomingId] = useState<string | null>(null);
  const [deliveryLifecycle, setDeliveryLifecycle] = useState<DeliveryLifecycle>('READY');
  const [currentDeliveryResult, setCurrentDeliveryResult] = useState<DeliveryResult | null>(null);
  const committedDeliveryIdRef = useRef<string | null>(checkpoint?.lastCommittedDeliveryId || checkpoint?.lastCompletedDeliveryId || null);
  const completedDeliveryIdRef = useRef<string | null>(checkpoint?.lastCompletedDeliveryId || null);
  const [recoveryStatus, setRecoveryStatus] = useState<MatchSaveStatus>(matchRecoveryStorage.getStatus());
  const [isBallAnimating, setIsBallAnimating] = useState(false);
  const [isFieldChanging, setIsFieldChanging] = useState(false);

  // Ball retrieval lifecycle (authoritative gate: next delivery blocked until ball returns to bowler)
  const ballLifecycleRef = useRef(new BallLifecycleController());
  const [ballLifecycleState, setBallLifecycleState] = useState<BallLifecycleState>('READY');
  const isRetrieving = ballLifecycleState !== 'READY';

  // AI Captain & Tactical Controls
  const [userTeamControlMode, setUserTeamControlMode] = useState<'MANUAL' | 'AI_RECOMMENDATIONS' | 'FULL_AUTO'>('AI_RECOMMENDATIONS');
  const [userBattingIntent, setUserBattingIntent] = useState<BattingIntent>('NORMAL');
  const [userBowlingPlan, setUserBowlingPlan] = useState<DetailedBowlingPlan | null>(null);
  const [aiCaptainRecommendation, setAiCaptainRecommendation] = useState<CaptainDecision | null>(null);
  const [opponentTacticalNotice, setOpponentTacticalNotice] = useState<string | null>(null);
  const [batterStates, setBatterStates] = useState<Record<string, BatterInningsState>>({});

  // Playback & Display Customization State
  const [playbackSpeed, setPlaybackSpeed] = useState<AnimationSpeed>(1);
  const [isPlaybackPaused, setIsPlaybackPaused] = useState<boolean>(false);
  const [replayTrigger, setReplayTrigger] = useState<number>(0);
  const [skipTrigger, setSkipTrigger] = useState<number>(0);
  const [displayMode, setDisplayMode] = useState<'STANDARD' | 'LABELS'>('LABELS');
  const [manualDrawerOpen, setManualDrawerOpen] = useState<'OPENERS' | 'BATTER' | 'BOWLER' | null>(null);
  const [replayDelivery, setReplayDelivery] = useState<DeliveryResult | null>(null);
  const [commentaryFilter, setCommentaryFilter] = useState<'ALL' | 'HIGHLIGHTS' | 'OVERS' | 'WICKETS' | 'BOUNDARIES'>('ALL');
  const [tacticalSubTab, setTacticalSubTab] = useState<'BATTING' | 'BOWLING' | 'FIELD'>('BATTING');
  const [openTacticalMenu, setOpenTacticalMenu] = useState<TacticalMenuKey | null>('BATTING');
  // Field formation state is persisted inside liveMatchState so a refresh or
  // match resumption restores the exact same formation instead of regenerating
  // a fresh (possibly illegal) one. See restoreFieldState (§9).
  const restoredFieldState = restoreFieldState(checkpoint || liveMatchState, currentMatchId);
  const [fieldPresetKey, setFieldPresetKey] = useState<string | null>(restoredFieldState?.fieldPresetKey ?? null);
  const [userLockedFieldPreset, setUserLockedFieldPreset] = useState<boolean>(Boolean(restoredFieldState?.fieldPresetKey));
  // Live, authoritative field configuration reported by the visualizer, plus the
  // batter's recently punished arcs — both feed the fielding AI's movement budget.
  const [liveFieldConfiguration, setLiveFieldConfiguration] = useState<FieldConfiguration | null>(restoredFieldState?.liveFieldConfiguration ?? null);
  const [recentBoundaryZones, setRecentBoundaryZones] = useState<ScoringZoneName[]>([]);
  const [historyDeliveryResults, setHistoryDeliveryResults] = useState<DeliveryResult[]>([]);

  // Premium Broadcast View State
  const [showSettings, setShowSettings] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [cameraMode, setCameraMode] = useState<'BROADCAST' | 'PITCH' | 'TACTICAL' | 'SKY'>('BROADCAST');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCommentaryDrawer, setShowCommentaryDrawer] = useState(false);
  const [showTacticsDrawer, setShowTacticsDrawer] = useState(false);
  const [scorecardTab, setScorecardTab] = useState<'BATTING' | 'BOWLING'>('BATTING');
  const [selectedScorecardInning, setSelectedScorecardInning] = useState<number>(0);
  const liveVideoPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedScorecardInning(Math.max(0, inningNo - 1));
  }, [inningNo]);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!liveVideoPanelRef.current) return;
    if (!document.fullscreenElement) {
      liveVideoPanelRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const cameraTransformClass = useMemo(() => {
    switch (cameraMode) {
      case 'PITCH':
        return 'scale-[1.28] translate-y-[3%]';
      case 'SKY':
        return 'scale-[0.88]';
      case 'TACTICAL':
        return 'scale-[1.0]';
      case 'BROADCAST':
      default:
        return 'scale-[1.03]';
    }
  }, [cameraMode]);

  useEffect(() => {
    if (currentDeliveryResult) {
      setHistoryDeliveryResults(prev => {
        if (prev.some(d => d.id === currentDeliveryResult.id)) return prev;
        return [currentDeliveryResult, ...prev].slice(0, 50);
      });
    }
  }, [currentDeliveryResult]);

  const handleImpactSubstitution = () => {
    if (!impactIncomingId || !impactOutgoingId) return;
    
    // Update playing XI for impact player
    const newXiIds = playingXIIds.filter(id => id !== impactOutgoingId).concat(impactIncomingId);
    setPlayingXIIds(newXiIds);

    // Record in current innings
    setInnings(prev => {
      const next = [...prev];
      if (next[inningNo - 1]) {
        next[inningNo - 1] = {
          ...next[inningNo - 1],
          impactPlayer: {
            incomingPlayerId: impactIncomingId,
            outgoingPlayerId: impactOutgoingId,
            teamId: myTeamId,
            overNumber: Math.floor((next[inningNo - 1].balls || 0) / 6),
            reason: 'Manual',
          }
        } as any;
      }
      return next;
    });

    if (strikerId === impactOutgoingId) setStrikerId(impactIncomingId);
    if (nonStrikerId === impactOutgoingId) setNonStrikerId(impactIncomingId);
    if (bowlerId === impactOutgoingId) setBowlerId(impactIncomingId);
    if (lastOverBowlerId === impactOutgoingId) setLastOverBowlerId(impactIncomingId);

    setShowImpactModal(false);
    setImpactIncomingId(null);
    setImpactOutgoingId(null);
  };

  const currentMatch = fixtures.find((fixture) => fixture.id === currentMatchId);
  const fallbackTeam1 = franchises[0];
  const fallbackTeam2 = franchises[1] || fallbackTeam1;
  const team1 = franchises.find((team) => team.id === currentMatch?.team1Id) || fallbackTeam1;
  const team2 = franchises.find((team) => team.id === currentMatch?.team2Id) || fallbackTeam2;
  const tossWinner = franchises.find((team) => team.id === currentMatchToss?.winnerId);
  const otherTeamId = currentMatchToss?.winnerId === team1.id ? team2.id : team1.id;
  const firstBattingTeamId = currentMatchToss ? (currentMatchToss.decision === 'Bat' ? currentMatchToss.winnerId : otherTeamId) : team1.id;
  const secondBattingTeamId = firstBattingTeamId === team1.id ? team2.id : team1.id;
  const myTeamId = selectedFranchiseId || '';
  const maxBalls = selectedFormat === 'ODI' ? 300 : selectedFormat === 'TEST' ? 9999 : 120; // balls per innings
  const isTest = selectedFormat === 'TEST';
  const testRules = DEFAULT_TEST_RULES;

  // Use locked Playing XI (11 players). Falls back to franchise.squad for AI/IPL teams.
  const selectedXiPlayers = useMemo(
    () => {
      const xiIds = playingXIIds.length > 0 ? playingXIIds : selectedSquadIds;
      return xiIds.map((id) => players.find((player) => player.id === id)).filter(Boolean) as Player[];
    },
    [players, playingXIIds, selectedSquadIds],
  );

  const getTeamSquad = (teamId: string) => {
    if (currentMatch) {
      const fixtureXI = useGameStore.getState().getFixturePlayingXI(currentMatch.id, teamId);
      if (fixtureXI && fixtureXI.length === 11) {
        const roster = fixtureXI.map((id) => players.find((p) => p.id === id)).filter(Boolean) as Player[];
        if (roster.length === 11) {
          return MatchEngine.orderSquad(fixtureXI, players).slice(0, 11);
        }
      }
    }
    const franchise = franchises.find((team) => team.id === teamId);
    if (!franchise) return [] as Player[];
    const base = teamId === myTeamId && selectedXiPlayers.length > 0 ? selectedXiPlayers : franchise.squad.map((id) => players.find((player) => player.id === id)).filter(Boolean);
    return MatchEngine.orderSquad((base as Player[]).map((player) => player.id), players).slice(0, 11);
  };

  const inning = innings[inningNo - 1];
  const battingTeam = franchises.find((team) => team.id === inning?.battingTeamId) || team1;
  const bowlingTeam = franchises.find((team) => team.id === inning?.bowlingTeamId) || team2;
  const battingSquad = getTeamSquad(battingTeam.id);
  const bowlingSquad = getTeamSquad(bowlingTeam.id);
  const striker = strikerId ? battingSquad.find((p) => p.id === strikerId) : undefined;
  const nonStriker = nonStrikerId ? battingSquad.find((p) => p.id === nonStrikerId) : undefined;
  const currentBowler = bowlerId ? bowlingSquad.find((p) => p.id === bowlerId) : undefined;

  const isMyTeamBatting = battingTeam.id === myTeamId;
  const isMyTeamBowling = bowlingTeam.id === myTeamId;

  // ─── Test-match meta-state (pure engine) ─────────────────────────────────
  // Everything the live loop needs above a single innings: the batting order
  // across four innings, the follow-on, the 4th-innings target, the day clock
  // and the final result. Kept in sync with the tested `testMatchFlow` engine.
  const testSummaries: TestInningsSummary[] = useMemo(
    () =>
      innings.map((inn) => ({
        battingTeamId: inn.battingTeamId,
        bowlingTeamId: inn.bowlingTeamId,
        runs: inn.runs,
        wickets: inn.wickets,
        balls: inn.balls,
        declared: inn.declared,
        isFollowOn: inn.isFollowOn,
        isComplete: inn.isComplete,
      })),
    [innings],
  );

  const matchTarget = useMemo(() => {
    if (isTest) {
      if (inningNo !== 4) return 0;
      const summaries = testSummaries.slice(0, 4);
      const aggregateToBeat = getFourthInningsTarget(summaries);
      if (aggregateToBeat == null) return 0;
      const battingTeamId = innings[3]?.battingTeamId || '';
      const ownPrior = teamAggregate(summaries.slice(0, 3), battingTeamId);
      return Math.max(1, aggregateToBeat + 1 - ownPrior);
    }
    return inningNo === 2 ? (innings[0]?.runs || 0) + 1 : 0;
  }, [isTest, inningNo, innings, testSummaries]);

  const handleUserFieldPresetChange = useCallback((key: string | null) => {
    setFieldPresetKey(key);
    setUserLockedFieldPreset(Boolean(key));
    if (key) {
      const newConfig = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: (selectedFormat as ArenaFormat) || 'T20',
        bowler: currentBowler,
        striker,
        nonStriker: nonStriker || null,
        overs: Math.floor((inning?.balls || 0) / 6),
        balls: inning?.balls || 0,
        wickets: inning?.wickets || 0,
        runs: inning?.runs || 0,
        target: matchTarget > 0 ? matchTarget : undefined,
        pitch,
        weather,
        manualPresetKey: key,
        maxFielderMoves: 11,
        fieldingSquad: bowlingSquad,
        previousConfig: null,
      });
      setLiveFieldConfiguration(newConfig);
      setOpponentTacticalNotice(`Field set: ${BowlerFieldStrategyEngine.PRESET_OVERLAYS[key]?.name || key}`);
    }
  }, [selectedFormat, currentBowler, striker, nonStriker, inning, matchTarget, pitch, weather, bowlingSquad]);

  const totalTestBalls = useMemo(() => innings.reduce((sum, inn) => sum + inn.balls, 0), [innings]);
  const testDaySession = useMemo(() => getTestDaySession(totalTestBalls, testRules), [totalTestBalls, testRules]);

  // Persisted per-fixture conditions. Reused for the whole match so a refresh
  // or resume never changes the pitch/weather. Test deterioration advances
  // with the day but never re-rolls the underlying surface.
  const currentFixture = useMemo(
    () => fixtures.find(f => f.id === currentMatchId) || null,
    [fixtures, currentMatchId],
  );
  const conditionsReport = currentFixture?.conditionReport ?? null;
  const conditionsModel: MatchConditionsModel | null = useMemo(() => {
    if (!conditionsReport) return null;
    if (isTest && testDaySession.day > 1) return matchConditionsForDay(conditionsReport, testDaySession.day);
    return conditionsReport.model;
  }, [conditionsReport, isTest, testDaySession.day]);
  const weatherTextShort = useMemo(() => {
    if (!conditionsReport) return null;
    return describeWeather(conditionsReport.weather, (selectedFormat || 'T20') as MatchFormatKey).headline;
  }, [conditionsReport, selectedFormat]);
  const testDayLimitReached = isTest && isDayLimitReached(totalTestBalls, testRules);
  const testResultDecision = useMemo(
    () => (isTest ? determineTestResult(testSummaries, team1.id, team2.id) : null),
    [isTest, testSummaries, team1.id, team2.id],
  );
  const isMatchOver = isTest
    ? Boolean(testResultDecision && testResultDecision.result !== 'IN_PROGRESS') || testDayLimitReached
    : Boolean(inning?.isComplete && inningNo === 2);

  const canDeclare = isTest
    && !isMatchOver
    && isMyTeamBatting
    && Boolean(inning)
    && canDeclareNow(testSummaries[inningNo - 1], testSummaries, testRules);

  const testLead = useMemo(
    () => (isTest
      ? teamAggregate(testSummaries, battingTeam.id) - teamAggregate(testSummaries, bowlingTeam.id)
      : 0),
    [isTest, testSummaries, battingTeam.id, bowlingTeam.id],
  );

  const handleDeclare = useCallback(() => {
    if (!canDeclare) return;
    setInnings((prev) => {
      const next = [...prev];
      const current = next[inningNo - 1];
      if (!current || current.isComplete) return prev;
      next[inningNo - 1] = { ...current, isComplete: true, declared: true };
      return next;
    });
    setPendingBatterEnd('striker');
    setDeclarePending(true);
  }, [canDeclare, inningNo]);

  const controlPermissions = useMemo(
    () =>
      computeControlPermissions({
        userTeamId: myTeamId || null,
        battingTeamId: inning?.battingTeamId || battingTeam.id,
        bowlingTeamId: inning?.bowlingTeamId || bowlingTeam.id,
        phase:
          innings.length === 0
            ? 'PRE_INNINGS'
            : inning?.isComplete
              ? isMatchOver
                ? 'MATCH_COMPLETE'
                : 'INNINGS_BREAK'
              : 'IN_INNINGS',
      }),
    [myTeamId, inning?.battingTeamId, inning?.bowlingTeamId, inning?.isComplete, innings.length, isMatchOver, battingTeam.id, bowlingTeam.id],
  );
  const userCanSelectOpeners = canPerformAction(controlPermissions, 'SELECT_OPENING_BATTERS');
  const userCanSelectIncomingBatter = canPerformAction(controlPermissions, 'SELECT_INCOMING_BATTER');
  const userCanSetBattingIntent = canPerformAction(controlPermissions, 'SET_BATTING_INTENT');
  const controlSummary = describeControlOwnership(controlPermissions);

  const handleConfirmOpeners = (sId: string, nsId: string) => {
    if (!userCanSelectOpeners) return; // enforce: only the user's own batting lineup
    setStrikerId(sId);
    setNonStrikerId(nsId);
    setBattingCursor(2);
    setPending('bowler');
    setManualDrawerOpen(null);
  };

  const handleConfirmBatter = (bId: string) => {
    if (!userCanSelectIncomingBatter) return; // enforce: never pick the opponent's batter
    if (pendingBatterEnd === 'non-striker') {
      setNonStrikerId(bId);
    } else {
      setStrikerId(bId);
    }
    setPending(queueBowlerAfterBatter ? 'bowler' : null);
    setQueueBowlerAfterBatter(false);
    setManualDrawerOpen(null);
  };

  // Manual bowler selection is permanently AI-owned → this handler is inert.
  const handleConfirmBowler = (bwId: string) => {
    if (!canPerformAction(controlPermissions, 'SELECT_BOWLER')) return;
    setBowlerId(bwId);
    setPending(null);
    setManualDrawerOpen(null);
  };

  const getAvailableBatters = useCallback((score: InningsState | undefined, squad: Player[], striker?: string | null, nonStriker?: string | null) => {
    return squad.filter((player) => !score?.batters[player.id]?.out && player.id !== striker && player.id !== nonStriker);
  }, []);

  const getAvailableBowlers = useCallback((score: InningsState | undefined, squad: Player[], previousOverBowlerId?: string | null) => {
    const maxBalls = MatchEngine.getMaxOversPerBowler(selectedFormat || 'T20') * 6;
    const bowlerOrder = MatchEngine.getBowlerOrder(squad.map((player) => player.id), players);
    
    // Strict rule: Exclude pure batters and wicketkeepers from bowling
    const eligibleBowlers = bowlerOrder.filter(p => p.role !== 'Batsman' && p.role !== 'Wicketkeeper');
    
    // Strict rule: Only the top 6 bowlers in the playing XI can bowl.
    const top6 = (eligibleBowlers.length >= 5 ? eligibleBowlers : bowlerOrder).slice(0, 6);
    
    const available = top6.filter((player) => (score?.bowlers[player.id]?.balls || 0) < maxBalls && player.id !== previousOverBowlerId);
    
    // Fallback if somehow all top 6 are exhausted (should not happen normally)
    if (available.length === 0) {
      return (eligibleBowlers.length > 0 ? eligibleBowlers : bowlerOrder).filter(
        (player) => (score?.bowlers[player.id]?.balls || 0) < maxBalls && player.id !== previousOverBowlerId
      );
    }
    return available;
  }, [players, selectedFormat]);

  const chooseAiBowler = useCallback((score: InningsState | undefined, squad: Player[], previousOverBowlerId?: string | null) => {
    const over = Math.floor((score?.balls || 0) / 6);
    const candidates = getAvailableBowlers(score, squad, previousOverBowlerId);
    if (candidates.length === 0) return squad.find((player) => player.id !== previousOverBowlerId) || squad[0];

    const oversBowled = (p: Player) => Math.floor((score?.bowlers[p.id]?.balls || 0) / 6);
    const isSpinner = (p: Player) => {
      const style = p.bowlingStyle?.toLowerCase() || '';
      return style.includes('spin') || style.includes('leg') || style.includes('off') || ['rashid', 'chahal', 'kuldeep', 'bishnoi', 'varun', 'narine', 'jadeja'].some((token) => p.name.toLowerCase().includes(token));
    };

    const scoreCandidate = (p: Player) => {
      let candidateScore = p.stats?.bowling || 0;
      const bowled = oversBowled(p);
      const spinner = isSpinner(p);
      const rank = candidates.findIndex(c => c.id === p.id);
      
      if (rank > 5) candidateScore -= 20;

      const phase = MatchEngine.getPowerPlayPhase(over * 6, selectedFormat || 'T20');
      if (phase === 'Mandatory') { 
        // Powerplay: Prefer pacers, penalize spinners
        if (spinner) candidateScore -= 15; 
        candidateScore -= (bowled * 5); 
      } else if (phase === 'Middle') { 
        // Middle overs: Prefer spinners
        if (spinner) candidateScore += 15; 
        candidateScore -= (bowled * 5);
      } else { 
        // Death overs: Best pacers, don't penalize for overs bowled
        if (spinner) candidateScore -= 20; 
      }
      
      return candidateScore + (Math.random() * 10 - 5);
    };

    return candidates.sort((a, b) => scoreCandidate(b) - scoreCandidate(a))[0];
  }, [getAvailableBowlers]);

  useEffect(() => {
    const first = emptyInnings(firstBattingTeamId, secondBattingTeamId);
    const second = emptyInnings(secondBattingTeamId, firstBattingTeamId);
    first.commentary = [
      { ball: 'TOSS', outcome: 'T', text: currentMatchToss ? `${tossWinner?.name || battingTeam.name} won the toss and elected to ${currentMatchToss.decision.toLowerCase()} first.` : `${battingTeam.name} will bat first.`, badge: `${(franchises.find((f) => f.id === firstBattingTeamId) || team1).shortName} BAT`, tone: 'info' },
    ];
    // Tests are pre-seeded with four innings (the 3rd/4th are filled in later,
    // possibly reordered by a follow-on); limited-overs matches keep two.
    setInnings(
      isTest
        ? [
            first,
            second,
            emptyInnings(firstBattingTeamId, secondBattingTeamId),
            emptyInnings(secondBattingTeamId, firstBattingTeamId),
          ]
        : [first, second],
    );
    setInningNo(1);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setLastOverBowlerId(null);
    setBattingCursor(2);
    setPending('openers');
    setPendingBatterEnd('striker');
    // Reuse the fixture's persisted, seeded conditions (never regenerate), so
    // pitch and weather stay identical across refresh / watch / resume.
    const report = currentMatchId ? ensureMatchConditions(currentMatchId) : null;
    setPitch(report?.legacyPitchType ?? MatchEngine.generatePitch());
    setWeather(report?.legacyWeatherCondition ?? MatchEngine.generateWeather());
    setManualBallRequests(0);
    setQueueBowlerAfterBatter(false);
    setResultSubmitted(false);
  }, [currentMatchId, currentMatchToss, firstBattingTeamId, secondBattingTeamId, tossWinner?.name]);

  useEffect(() => {
    if (!inning || !pending) return;

    if (pending === 'openers') {
      if (isMyTeamBatting) {
        // The user owns their own batting lineup — wait for the opening-batter dialog.
        setManualDrawerOpen('OPENERS');
        return;
      }
      // Opponent batting: the AI picks the openers automatically.
      const openers = selectAIOpeningBatters({
        format: (selectedFormat as ArenaFormat) || 'T20',
        squad: battingSquad,
        batters: inning.batters,
        strikerId,
        nonStrikerId,
        wickets: inning.wickets,
        runs: inning.runs,
        balls: inning.balls,
      });
      setStrikerId(openers.striker?.id || battingSquad[0]?.id || null);
      setNonStrikerId(openers.nonStriker?.id || battingSquad[1]?.id || null);
      setBattingCursor(2);
      setPending('bowler');
      return;
    }

    if (pending === 'batter') {
      if (isMyTeamBatting) {
        // The user chooses the incoming batter — open the "Wicket! Select Next Batter" dialog.
        setManualDrawerOpen('BATTER');
        return;
      }
      // Opponent batting: AI selects the incoming batter automatically.
      const selection = selectAINextBatter({
        format: (selectedFormat as ArenaFormat) || 'T20',
        squad: battingSquad,
        batters: inning.batters,
        strikerId,
        nonStrikerId,
        battingCursor,
        wickets: inning.wickets,
        runs: inning.runs,
        balls: inning.balls,
        target: matchTarget > 0 ? matchTarget : undefined,
        recentBalls: inning.recentBalls,
      });
      if (selection.player) {
        if (pendingBatterEnd === 'non-striker') setNonStrikerId(selection.player.id);
        else setStrikerId(selection.player.id);
        setBattingCursor((value) => value + 1);
      }
      setPending(queueBowlerAfterBatter ? 'bowler' : null);
      setQueueBowlerAfterBatter(false);
      return;
    }

    if (pending === 'bowler') {
      // Bowling is ALWAYS autonomous — the AI captain of the fielding team,
      // whether that is the user's team or the opponent, chooses the bowler,
      // the plan and a legal field formation. The user never selects a bowler.
      const decision = decideBowlingChange({
        format: (selectedFormat as ArenaFormat) || 'T20',
        over: Math.floor(inning.balls / 6) + 1,
        balls: inning.balls,
        wickets: inning.wickets,
        runs: inning.runs,
        target: matchTarget > 0 ? matchTarget : undefined,
        recentBalls: inning.recentBalls,
        fieldingSquad: bowlingSquad,
        bowlerStats: inning.bowlers,
        previousOverBowlerId: lastOverBowlerId,
        currentBowler: null,
        striker: striker || null,
        nonStriker: nonStriker || null,
        strikerBalls: striker ? (inning.batters[striker.id]?.balls ?? 0) : 0,
        pitch,
        weather,
        fatigue: playerFatigue,
        eligibleBowlerIds: getAvailableBowlers(inning, bowlingSquad, lastOverBowlerId).map((p) => p.id),
        previousFieldPresetKey: fieldPresetKey,
        previousFieldConfiguration: liveFieldConfiguration,
        hotZones: recentBoundaryZones,
        totalOvers: Math.round(maxBalls / 6),
        trigger: inning.balls === 0 ? 'INITIAL' : 'OVER_END',
      });
      if (decision.bowlerId) setBowlerId(decision.bowlerId);
      if (decision.bowlingPlan) setUserBowlingPlan(decision.bowlingPlan);
      if (!userLockedFieldPreset && !isMyTeamBowling) {
        if (decision.fieldPresetKey) setFieldPresetKey(decision.fieldPresetKey);
        if (decision.fieldConfiguration) setLiveFieldConfiguration(decision.fieldConfiguration);
      }
      if (decision.notification) setOpponentTacticalNotice(decision.notification);
      setAiCaptainRecommendation(null);
      setPending(null);
    }
  }, [pending, inning, innings, inningNo, battingSquad, bowlingSquad, battingCursor, isMyTeamBatting, strikerId, nonStrikerId, queueBowlerAfterBatter, lastOverBowlerId, pendingBatterEnd, selectedFormat, pitch, weather, playerFatigue, fieldPresetKey, striker, nonStriker, getAvailableBowlers, liveFieldConfiguration, recentBoundaryZones, maxBalls]);

  // Auto-dismiss the unobtrusive AI field-change notice after a few seconds.
  useEffect(() => {
    if (!opponentTacticalNotice) return;
    const timer = setTimeout(() => setOpponentTacticalNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [opponentTacticalNotice]);

  // Ball retrieval lifecycle handler (driven by the visualizer). Advances the
  // authoritative controller through legal transitions and mirrors its state so
  // the next delivery stays blocked until the ball is back with the bowler.
  const handleBallLifecycleChange = useCallback((state: BallLifecycleState) => {
    const controller = ballLifecycleRef.current;
    const ORDER: BallLifecycleState[] = ['BALL_IN_PLAY', 'FIELDER_INTERCEPTING', 'BALL_COLLECTED', 'RETURNING_BALL', 'BOWLER_RETRIEVING', 'BALL_READY'];
    const tgt = ORDER.indexOf(state);
    if (tgt < 0) return;
    // Step forward one legal transition at a time so any reported state (even one
    // that skips an intermediate stage, e.g. a boundary) resolves legally.
    let guard = 0;
    while (ORDER.indexOf(controller.getState()) < tgt && guard < 10) {
      const next = ORDER[ORDER.indexOf(controller.getState()) + 1];
      if (!next || !controller.transition(next)) break;
      guard += 1;
    }
    setBallLifecycleState(controller.getState());
  }, []);

  const handleContactReached = useCallback(() => {
    if (!currentDeliveryResult) return;
    if (committedDeliveryIdRef.current === currentDeliveryResult.id) return;
    if (matchRecoveryStorage.isDeliveryCommitted(checkpoint, currentDeliveryResult.id)) {
      committedDeliveryIdRef.current = currentDeliveryResult.id;
      return;
    }
    committedDeliveryIdRef.current = currentDeliveryResult.id;

    setDeliveryLifecycle('DELIVERY_OUTCOME');
    setDeliveryLifecycle('SCORE_UPDATE');

    const ball = currentDeliveryResult;
    const isLegalDelivery = ball.legalBall;
    const ballRuns = ball.totalRuns;
    const batterRuns = ball.batterRuns;
    const wicket = ball.wicket;

    setInnings((previous) => {
      const next = [...previous];
      const current = next[inningNo - 1];
      if (!current) return next;

      const nextBall = current.balls + (isLegalDelivery ? 1 : 0);
      const ballLabel = `${Math.floor(current.balls / 6)}.${(current.balls % 6) + 1}`;
      const overIndex = Math.floor(current.balls / 6);
      const outcomeText = wicket ? 'W' : ball.extraType ? (ball.extraType === 'No Ball' ? 'Nb' : 'Wd') : String(ballRuns);
      const nextRuns = current.runs + ballRuns;
      const wicketNumber = current.wickets + (wicket ? 1 : 0);
      const wicketStatus = `${ball.wicketType || 'Out'} b ${ball.bowlerName}`;
      const tone: CommentaryLine['tone'] = wicket ? 'wicket' : ballRuns === 6 ? 'six' : ballRuns === 4 ? 'four' : ballRuns === 0 ? 'dot' : 'info';

      const upd = {
        ...current,
        batters: { ...current.batters },
        bowlers: { ...current.bowlers },
        deliveries: [...current.deliveries],
        extras: { ...current.extras },
        commentary: [...current.commentary],
        recentBalls: [...current.recentBalls],
        runRateHistory: [...current.runRateHistory],
        wicketLog: [...current.wicketLog],
      };

      const sLine = upd.batters[ball.strikerId] || { balls: 0, dots: 0, fours: 0, out: false, runs: 0, sixes: 0, status: 'not out' };
      const bLine = upd.bowlers[ball.bowlerId] || { balls: 0, dots: 0, runs: 0, wickets: 0 };

      upd.batters[ball.strikerId] = {
        ...sLine,
        balls: sLine.balls + (isLegalDelivery ? 1 : 0),
        ballsSinceBoundary: ballRuns === 4 || ballRuns === 6 ? 0 : (sLine.ballsSinceBoundary || 0) + (isLegalDelivery ? 1 : 0),
        consecutiveDots: ballRuns === 0 && !ball.extraType && !wicket ? (sLine.consecutiveDots || 0) + 1 : 0,
        dots: (sLine.dots || 0) + (ballRuns === 0 && !ball.extraType && !wicket ? 1 : 0),
        fours: sLine.fours + (ballRuns === 4 && !ball.extraType ? 1 : 0),
        momentum: Math.max(-18, Math.min(24, (sLine.momentum || 0) + (ballRuns === 6 ? 8 : ballRuns === 4 ? 5 : ballRuns === 0 ? -2 : 1) - (wicket ? 8 : 0))),
        runs: sLine.runs + batterRuns,
        sixes: sLine.sixes + (ballRuns === 6 && !ball.extraType ? 1 : 0),
        out: wicket,
        status: wicket ? wicketStatus : sLine.status,
        wicketBurst: Math.max(0, (sLine.wicketBurst || 0) + (wicket ? 1 : -0.2)),
      };

      // Credit wicket to bowler ONLY if not Run Out or Timed Out
      const bowlerGetsCredit = wicket && ball.wicketType !== 'Run Out' && ball.wicketType !== 'Timed Out';

      const overEnded = isLegalDelivery && nextBall % 6 === 0;

      upd.bowlers[ball.bowlerId] = {
        balls: bLine.balls + (isLegalDelivery ? 1 : 0),
        dots: (bLine.dots || 0) + (ballRuns === 0 && !ball.extraType ? 1 : 0),
        lastOverRuns: ((bLine.lastOverRuns || 0) + ballRuns) * (nextBall > 0 && nextBall % 6 === 0 ? 0 : 1),
        momentum: Math.max(-16, Math.min(24, (bLine.momentum || 0) + (wicket ? 10 : ballRuns === 0 ? 2 : ballRuns >= 4 ? -3 : 0))),
        runs: bLine.runs + ballRuns,
        wickets: bLine.wickets + (bowlerGetsCredit ? 1 : 0),
        bouncersThisOver: overEnded ? 0 : (bLine.bouncersThisOver || 0) + (!wicket && isLegalDelivery && ballRuns === 0 && Math.random() < 0.15 ? 1 : 0),
      };

      upd.isFreeHitPending = ball.triggeredFreeHit ? true : (isLegalDelivery || (ball.extraType && ball.extraType !== 'No Ball' && ball.extraType !== 'Wide') ? false : current.isFreeHitPending);

      upd.runs = nextRuns;
      upd.balls = nextBall;
      upd.wickets = wicketNumber;
      if (ball.extraType === 'Wide') upd.extras.wides += (ball.extraRuns || 1);
      if (ball.extraType === 'No Ball') upd.extras.noBalls += (ball.extraRuns || 1);
      if (ball.extraType === 'Bye') upd.extras.byes += (ball.extraRuns || ballRuns);
      if (ball.extraType === 'Leg Bye') upd.extras.legByes += (ball.extraRuns || ballRuns);

      upd.deliveries = [
        ...upd.deliveries,
        {
          ball: ballLabel,
          batterId: ball.strikerId,
          bowlerId: ball.bowlerId,
          isLegal: isLegalDelivery,
          isWicket: wicket,
          outcome: outcomeText,
          over: overIndex,
          runs: ballRuns,
        },
      ];

      upd.recentBalls = [...upd.recentBalls, outcomeText].slice(-18);
      upd.runRateHistory = [...upd.runRateHistory, nextBall ? nextRuns / (nextBall / 6) : 0].slice(-12);
      upd.commentary = [
        {
          ball: ballLabel,
          outcome: outcomeText,
          text: ball.commentary,
          badge: `${battingTeam.shortName} ${nextRuns}/${upd.wickets}`,
          tone,
        },
        ...upd.commentary,
      ].slice(0, 18);

      if (wicket) {
        upd.wicketLog = [
          ...upd.wicketLog,
          {
            ball: ballLabel,
            bowlerId: ball.bowlerId,
            playerId: ball.strikerId,
            score: nextRuns,
            status: wicketStatus,
            wicket: wicketNumber,
            wicketType: ball.wicketType || 'Out',
          },
        ];
        upd.partnershipBalls = 0;
        upd.partnershipRuns = 0;
      } else if (!ball.extraType) {
        upd.partnershipBalls = (upd.partnershipBalls || 0) + 1;
        upd.partnershipRuns = (upd.partnershipRuns || 0) + batterRuns;
      } else {
        upd.partnershipRuns = (upd.partnershipRuns || 0) + ballRuns;
      }

      if (overEnded && !isTest) {
        const timeout = MatchEngine.shouldTriggerStrategicTimeout(overIndex + 1, inningNo as 1 | 2, upd.strategicTimeouts);
        if (timeout) {
          upd.strategicTimeouts = [...upd.strategicTimeouts, timeout];
          upd.commentary = [{
            ball: 'TIMEOUT',
            outcome: 'T',
            text: MatchEngine.getTimeoutCommentary(timeout),
            badge: `${battingTeam.shortName} ${nextRuns}/${upd.wickets}`,
            tone: 'info' as const,
          }, ...upd.commentary].slice(0, 18);
          Object.keys(upd.batters).forEach(k => upd.batters[k].momentum = 0);
          Object.keys(upd.bowlers).forEach(k => upd.bowlers[k].momentum = 0);
        }
      }

      const inningsComplete = nextBall >= maxBalls || wicketNumber >= 10 || (matchTarget > 0 && nextRuns >= matchTarget);
      if (inningsComplete) {
        upd.isComplete = true;
      }

      next[inningNo - 1] = upd;
      return next;
    });

    // Update intelligent batter state
    if (ball.strikerId && striker) {
      setBatterStates((prev) => {
        const existing = prev[ball.strikerId] || BatterDecisionEngine.createInitialBatterState(
          ball.strikerId,
          `${currentMatchId}_in${inningNo}`,
          striker
        );
        const updated = BatterDecisionEngine.updateBatterStateAfterDelivery(existing, {
          runs: batterRuns,
          isWicket: wicket,
          isBoundary: batterRuns >= 4,
          extraType: ball.extraType,
        });
        return { ...prev, [ball.strikerId]: updated };
      });
    }

    // Record the arc the batter just punished so the fielding AI can prioritise
    // covering it within the two-fielder movement budget on the next update.
    if (!wicket && ballRuns >= 4) {
      const zone = zoneNameFromTargetZone(ball.targetZone);
      if (zone) {
        setRecentBoundaryZones(prev => [...prev.filter(z => z !== zone), zone].slice(-3));
      }
    }

    // AI captain reacts to a wicket or a boundary cluster by re-planning the
    // field. The resulting formation is always validated against the fielding
    // restrictions inside the controller, then applied to the live field.
    const recentForField = [...(inning?.recentBalls || []), wicket ? 'W' : String(ballRuns)];
    const boundaryCluster =
      !wicket && recentForField.slice(-6).filter((b) => b === '4' || b === '6').length >= 2;
    if ((wicket || boundaryCluster) && currentBowler) {
      const fieldDecision = decideBowlingChange({
        format: (selectedFormat as ArenaFormat) || 'T20',
        over: Math.floor((inning?.balls || 0) / 6) + 1,
        balls: (inning?.balls || 0) + (isLegalDelivery ? 1 : 0),
        wickets: (inning?.wickets || 0) + (wicket ? 1 : 0),
        runs: (inning?.runs || 0) + ballRuns,
        recentBalls: recentForField,
        fieldingSquad: bowlingSquad,
        bowlerStats: inning?.bowlers || {},
        previousOverBowlerId: lastOverBowlerId,
        currentBowler,
        striker: striker || null,
        nonStriker: nonStriker || null,
        strikerBalls: striker ? (inning?.batters?.[striker.id]?.balls ?? 0) : 0,
        pitch,
        weather,
        previousFieldPresetKey: fieldPresetKey,
        previousFieldConfiguration: liveFieldConfiguration,
        hotZones: recentBoundaryZones,
        totalOvers: Math.round(maxBalls / 6),
        trigger: wicket ? 'WICKET_FALL' : 'BOUNDARY_CLUSTER',
      });
      if (!userLockedFieldPreset && !isMyTeamBowling) {
        if (fieldDecision.fieldChanged) {
          setFieldPresetKey(fieldDecision.fieldPresetKey);
        }
        if (fieldDecision.fieldConfiguration) setLiveFieldConfiguration(fieldDecision.fieldConfiguration);
      }
      setOpponentTacticalNotice(
        fieldDecision.notification ||
          `${bowlingTeam.name} AI: ${
            wicket ? 'Wicket! Applying pressure with a fresh field.' : 'Boundary surge — protecting the rope.'
          }`,
      );
    }
  }, [currentDeliveryResult, inningNo, battingTeam.shortName, maxBalls, striker, currentMatchId, bowlingTeam.name, inning, bowlingSquad, lastOverBowlerId, currentBowler, pitch, weather, selectedFormat, fieldPresetKey, nonStriker, liveFieldConfiguration, recentBoundaryZones]);

  // Advances a Test match past a completed innings: 1 → 2 → 3 → 4, applying
  // the follow-on when the trailing side was bowled out far enough behind, and
  // stopping once the match is decided (innings defeat) or all four are done.
  const advanceTestInnings = useCallback((completedInningsNo: number) => {
    setQueueBowlerAfterBatter(false);
    if (completedInningsNo >= 4) {
      setPending(null);
      return;
    }
    const decision = determineTestResult(testSummaries, team1.id, team2.id);
    if (decision.result !== 'IN_PROGRESS') {
      setPending(null);
      return;
    }
    if (completedInningsNo === 2) {
      const followOn = evaluateFollowOn(testSummaries, testRules);
      if (followOn?.available) {
        setInnings((prev) => {
          const next = [...prev];
          next[2] = { ...next[2], battingTeamId: prev[1].battingTeamId, bowlingTeamId: prev[0].battingTeamId, isFollowOn: true };
          next[3] = { ...next[3], battingTeamId: prev[0].battingTeamId, bowlingTeamId: prev[1].battingTeamId };
          return next;
        });
      }
    }
    setInningNo(completedInningsNo + 1);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setLastOverBowlerId(null);
    setBattingCursor(2);
    setPendingBatterEnd('striker');
    setPending('openers');
  }, [testSummaries, team1.id, team2.id, testRules]);

  const handlePlaybackComplete = useCallback(() => {
    if (!currentDeliveryResult) return;
    if (completedDeliveryIdRef.current === currentDeliveryResult.id) {
      setIsBallAnimating(false);
      setDeliveryLifecycle('READY');
      return;
    }
    completedDeliveryIdRef.current = currentDeliveryResult.id;

    setDeliveryLifecycle('FIELD_CHANGE_IF_REQUIRED');

    const ball = currentDeliveryResult;
    const isLegalDelivery = ball.legalBall;
    const wicket = ball.wicket;
    const current = inning;
    if (!current) return;

    const nextBall = current.balls;
    const nextRuns = current.runs;
    const wicketNumber = current.wickets;

    const overEnded = !wicket && isLegalDelivery && nextBall % 6 === 0;
    const wicketAtOverEnd = wicket && isLegalDelivery && nextBall % 6 === 0;
    const inningsComplete = nextBall >= maxBalls || wicketNumber >= 10 || (matchTarget > 0 && nextRuns >= matchTarget);

    if (inningsComplete) {
      if (isTest) {
        // Advance (or end) the Test match now that the animation has finished,
        // keeping the transition aligned with the ball's playback.
        advanceTestInnings(inningNo);
      } else if (inningNo === 1) {
        setInningNo(2);
        setStrikerId(null);
        setNonStrikerId(null);
        setBowlerId(null);
        setLastOverBowlerId(null);
        setBattingCursor(2);
        setPendingBatterEnd('striker');
        setQueueBowlerAfterBatter(false);
        setPending('openers');
      } else {
        setQueueBowlerAfterBatter(false);
        setPending(null);
      }
    } else if (wicket) {
      setPendingBatterEnd(wicketAtOverEnd ? 'non-striker' : 'striker');
      if (wicketAtOverEnd) {
        setQueueBowlerAfterBatter(true);
        setLastOverBowlerId(currentBowler?.id || null);
        setBowlerId(null);
        setStrikerId(nonStriker?.id || null);
      }
      setPending('batter');
    } else if (overEnded) {
      setLastOverBowlerId(currentBowler?.id || null);
      setBowlerId(null);
      if (striker && nonStriker) {
        setStrikerId(nonStriker.id);
        setNonStrikerId(striker.id);
      }
      setPending('bowler');
    } else {
      if (ball.strikeRotated && striker && nonStriker) {
        setStrikerId(nonStriker.id);
        setNonStrikerId(striker.id);
      }
    }

    if (!autoPlay) {
      setManualBallRequests((value) => Math.max(0, value - 1));
    }

    // Retrieval finished (ball is back with the bowler) — open the gate for the next delivery.
    ballLifecycleRef.current.completeDelivery();
    setBallLifecycleState('READY');

    setIsBallAnimating(false);
    setDeliveryLifecycle('FIELD_READY');
    setTimeout(() => {
      setDeliveryLifecycle('NEXT_DELIVERY');
      setTimeout(() => {
        setDeliveryLifecycle('READY');
      }, 40);
    }, 60);
  }, [currentDeliveryResult, inning, innings, inningNo, maxBalls, matchTarget, isTest, advanceTestInnings, currentBowler, striker, nonStriker, autoPlay]);

  // A declaration closes the innings without a delivery; advance once the gate
  // is clear so the follow-on/next-innings logic sees the declared state.
  useEffect(() => {
    if (!declarePending) return;
    if (pending) return;
    advanceTestInnings(inningNo);
    setDeclarePending(false);
  }, [declarePending, pending, inningNo, advanceTestInnings]);

  useEffect(() => {
    if (!inning || inning.isComplete || pending || !striker || !nonStriker || !currentBowler) return;
    if (isBallAnimating || isFieldChanging || isRetrieving) return;
    if (deliveryLifecycle !== 'READY' && deliveryLifecycle !== 'NEXT_DELIVERY') return;
    if (!autoPlay && manualBallRequests <= 0) return;

    const playDelivery = () => {
      const current = inning;
      if (current.isComplete || isBallAnimating || isFieldChanging) return;

      const target = matchTarget;
      const ballsRemaining = Math.max(1, maxBalls - current.balls);
      const requiredRate = target ? ((target - current.runs) / (ballsRemaining / 6)) : 0;
      const strikerLine = current.batters[striker.id] || { balls: 0, dots: 0, fours: 0, out: false, runs: 0, sixes: 0, status: 'not out' };
      const currentBowlerLine = current.bowlers[currentBowler.id] || { balls: 0, dots: 0, runs: 0, wickets: 0 };

      setDeliveryLifecycle('DELIVERY_SIMULATION');

      // Resolve Batter State
      const currentStrikerState = batterStates[striker.id] || BatterDecisionEngine.createInitialBatterState(striker.id, `${currentMatchId}_in${inningNo}`, striker);

      // Resolve Batting Intent
      // • User's own innings → the user's chosen intent (they own their batting).
      // • Opponent innings → the opponent AI decides autonomously.
      let effectiveBattingIntent: BattingIntent = 'NORMAL';
      if (isMyTeamBatting && userCanSetBattingIntent) {
        effectiveBattingIntent = userBattingIntent;
      } else {
        effectiveBattingIntent = BatterDecisionEngine.selectBattingIntent(currentStrikerState, {
          format: (selectedFormat as ArenaFormat) || 'T20',
          batter: striker,
          bowler: currentBowler,
          inningsState: {
            score: current.runs,
            wickets: current.wickets,
            balls: current.balls,
            target,
            partnershipRuns: current.partnershipRuns,
            partnershipBalls: current.partnershipBalls,
          },
          pitchType: pitch,
        });
      }

      // Resolve Bowling Plan — always AI-generated (the bowling captain owns it),
      // for both the user's team and the opponent.
      const effectiveBowlingPlan: DetailedBowlingPlan | undefined = BowlingPlanEngine.selectBowlingPlan(currentBowler, striker, {
        format: (selectedFormat as ArenaFormat) || 'T20',
        overs: Math.floor(current.balls / 6),
        balls: current.balls,
        wickets: current.wickets,
        target,
        pitch,
        strikerBalls: strikerLine.balls,
        strikerRuns: strikerLine.runs,
        bouncersThisOver: currentBowlerLine.bouncersThisOver || 0,
      });

      // Resolve the authoritative field layout for this delivery so the
      // adaptive model can measure how well the batter's scoring arcs are
      // protected (boundary prevention) and supply a single coordinated model.
      const activeFieldConfiguration = BowlerFieldStrategyEngine.generateFieldConfiguration({
        format: (selectedFormat as ArenaFormat) || 'T20',
        bowler: currentBowler,
        striker,
        nonStriker: nonStriker || null,
        overs: Math.floor(current.balls / 6),
        balls: current.balls,
        wickets: current.wickets,
        runs: current.runs,
        target,
        pitch,
        weather,
        manualPresetKey: fieldPresetKey || undefined,
        fieldingSquad: bowlingSquad,
        previousConfig: liveFieldConfiguration,
        totalOvers: Math.round(maxBalls / 6),
        hotZones: recentBoundaryZones,
      });

      const deliveryRes = DeliveryResultFactory.createDeliveryResult({
        striker,
        nonStriker,
        bowler: currentBowler,
        currentBalls: current.balls,
        currentWickets: current.wickets,
        requiredRate,
        pitchType: pitch,
        weather,
        format: (selectedFormat as ArenaFormat) || 'T20',
        isFreeHit: current.isFreeHitPending,
        bouncersThisOver: currentBowlerLine.bouncersThisOver || 0,
        battingIntent: effectiveBattingIntent,
        bowlingPlan: effectiveBowlingPlan,
        batterInningsState: currentStrikerState,
        strikerStats: {
          playerId: striker.id,
          runs: strikerLine.runs,
          balls: strikerLine.balls,
          fours: strikerLine.fours,
          sixes: strikerLine.sixes,
          wickets: 0,
          overs: 0,
          runsConceded: 0,
          dots: strikerLine.dots || 0,
          momentum: strikerLine.momentum,
          consecutiveDots: strikerLine.consecutiveDots,
          ballsSinceBoundary: strikerLine.ballsSinceBoundary,
          wicketBurst: strikerLine.wicketBurst,
          oversBowled: 0,
          legalBallsThisOver: 0,
          bouncersThisOver: 0,
        },
        bowlerStats: {
          playerId: currentBowler.id,
          runs: 0,
          balls: currentBowlerLine.balls % 6,
          fours: 0,
          sixes: 0,
          wickets: currentBowlerLine.wickets,
          overs: Math.floor(currentBowlerLine.balls / 6),
          runsConceded: currentBowlerLine.runs,
          dots: currentBowlerLine.dots || 0,
          momentum: currentBowlerLine.momentum,
          lastOverRuns: currentBowlerLine.lastOverRuns || 0,
          oversBowled: Math.floor(currentBowlerLine.balls / 6),
          legalBallsThisOver: currentBowlerLine.balls % 6,
          bouncersThisOver: currentBowlerLine.bouncersThisOver || 0,
        },
        recentOutcomes: current.recentBalls,
        battingTeamId: battingTeam.id,
        bowlingTeamId: bowlingTeam.id,
        drsReviewsRemaining: current.drsReviewsRemaining,
        fieldConfiguration: activeFieldConfiguration,
        totalOvers: Math.round(maxBalls / 6),
        conditions: conditionsModel || undefined,
      });

      setCurrentDeliveryResult(deliveryRes);
      setDeliveryLifecycle('RESULT_LOCKED');
      setIsBallAnimating(true);
      setDeliveryLifecycle('BALL_PATH_PLAYBACK');
      // Start a fresh ball lifecycle; the gate stays closed until retrieval returns the ball.
      ballLifecycleRef.current.reset();
      ballLifecycleRef.current.beginDelivery();
      ballLifecycleRef.current.ballEnteredPlay();
      setBallLifecycleState('BALL_IN_PLAY');
    };

    const timer = window.setTimeout(playDelivery, autoPlay ? 600 : 0);
    return () => window.clearTimeout(timer);
  }, [
    inning,
    innings,
    inningNo,
    pending,
    striker,
    nonStriker,
    currentBowler,
    battingCursor,
    autoPlay,
    manualBallRequests,
    pitch,
    weather,
    conditionsModel,
    battingTeam,
    bowlingTeam,
    isBallAnimating,
    isFieldChanging,
    isRetrieving,
    deliveryLifecycle,
    selectedFormat,
    maxBalls,
    userTeamControlMode,
    userBattingIntent,
    userBowlingPlan,
    batterStates,
    isMyTeamBatting,
    isMyTeamBowling,
    currentMatchId,
  ]);

  useEffect(() => {
    if (!currentMatchId || resultSubmitted) return;

    // Test: the match ends on a result (win/tie) or on the day limit (draw).
    if (isTest) {
      if (!isMatchOver) return;
      const decided = Boolean(testResultDecision && testResultDecision.result !== 'IN_PROGRESS');
      const resultType: MatchResultType = decided ? testResultDecision!.result as MatchResultType : 'DRAW';
      const played = innings.filter((inn) => inn.isComplete || inn.balls > 0);
      updateMatchResult(currentMatchId, {
        team1Id: team1.id,
        team2Id: team2.id,
        innings: played.map((inn, idx) => ({
          ...inningsToStoreData(inn),
          inningsNumber: idx + 1,
          declared: inn.declared,
          isFollowOn: inn.isFollowOn,
        })),
        winnerId: decided
          ? (testResultDecision!.result === 'TIE' ? 'TIE' : testResultDecision!.winnerId)
          : 'DRAW',
        margin: decided ? testResultDecision!.margin : 'Match drawn',
        result: resultType,
      });
      setResultSubmitted(true);
      return;
    }

    const first = innings[0];
    const second = innings[1];
    if (!first?.isComplete || !second?.isComplete) return;

    const winnerId = second.runs > first.runs ? second.battingTeamId : first.battingTeamId;
    const margin = second.runs > first.runs
      ? `${10 - second.wickets} wickets`
      : second.runs === first.runs
        ? 'Match tied'
        : `${first.runs - second.runs} runs`;

    updateMatchResult(currentMatchId, {
      team1Id: first.battingTeamId,
      team2Id: second.battingTeamId,
      innings: [inningsToStoreData(first), inningsToStoreData(second)],
      winnerId,
      margin,
    });
    setResultSubmitted(true);
  }, [innings, currentMatchId, resultSubmitted, updateMatchResult, isTest, isMatchOver, testResultDecision, team1.id, team2.id]);

  const currentRunRate = inning && inning.balls ? (inning.runs / (inning.balls / 6)).toFixed(2) : '0.00';
  const currentOverIdx = inning?.balls ? (inning.balls % 6 === 0 ? Math.floor(inning.balls / 6) - 1 : Math.floor(inning.balls / 6)) : 0;
  const currentOverBalls = (inning?.deliveries || []).filter((d) => d.over === currentOverIdx).map((d) => d.outcome);

  // Format/phase fielding-restriction status (authoritative circle limits from getRules)
  const fieldStatus = useMemo(() => {
    const over = overFromBalls(inning?.balls || 0);
    const phase = getFieldingPhase(selectedFormat, over, undefined, Math.round(maxBalls / 6));
    const preset = fieldPresetKey ? BowlerFieldStrategyEngine.PRESET_OVERLAYS[fieldPresetKey] : null;
    const keys = preset?.keys ?? [];
    const hasPreset = keys.length > 0;
    const fielderPositions = keys.map((k, idx) => {
      const p = CANONICAL_POSITIONS[k];
      return { id: `${k}_${idx}`, name: p?.name, x: p?.x ?? 300, y: p?.y ?? 300, isOutsideCircle: p?.isOutsideCircle, role: 'Batsman' };
    });
    const validation = validateField({
      format: selectedFormat,
      over,
      fielders: fielderPositions,
      options: { enforcePlayerCount: false },
      totalOvers: Math.round(maxBalls / 6),
    });
    const legal = !hasPreset || validation.valid;
    return { over, phase, outside: validation.outsideCircleCount, hasPreset, legal, validation };
  }, [inning?.balls, selectedFormat, fieldPresetKey, maxBalls]);
  const fieldStatusLabel = !fieldStatus.phase.restricted
    ? `${fieldStatus.phase.shortLabel} · No circle restriction`
    : fieldStatus.hasPreset
      ? getRestrictionSummary(fieldStatus.phase, fieldStatus.outside)
      : `${fieldStatus.phase.shortLabel} · Max ${fieldStatus.phase.maxOutsideCircle} outside`;
  const retrievalStatus = isRetrieving ? ballLifecycleRef.current.getMessage() : 'Ready for next delivery';
  const sortedStandings = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  const currentOverRuns = overRuns(inning);
  const firstWorm = wormPoints(innings[0]);
  const secondWorm = wormPoints(innings[1]);
  const maxWormRuns = Math.max(200, ...firstWorm.map((point) => point.runs), ...secondWorm.map((point) => point.runs));
  const projectedScore = inning?.balls ? Math.round((inning.runs / inning.balls) * (maxBalls || 120)) : 0;
  const matchStatus = isMatchOver
    ? 'Result official'
    : isTest
      ? `${ordinal(inningNo)} innings live`
      : inningNo === 1
        ? 'First innings live'
        : 'Chase live';
  const matchInfo = [
    ['Toss result', currentMatchToss ? `${tossWinner?.shortName} won, ${currentMatchToss.decision.toLowerCase()} first` : `${team1.shortName} batting first`],
    ['Pitch', pitch],
    ['Weather', weather],
    ...info,
  ];

  const selectableBatters = getAvailableBatters(inning, battingSquad, strikerId, nonStrikerId);
  const selectableBowlers = getAvailableBowlers(inning, bowlingSquad, lastOverBowlerId);
  const canPlayManualBall = !autoPlay && !pending && !inning?.isComplete && Boolean(striker && nonStriker && currentBowler);

  const lastWicket = inning?.wicketLog.length ? inning.wicketLog[inning.wicketLog.length - 1] : null;
  const lastWicketBatter = lastWicket ? players.find((p) => p.id === lastWicket.playerId) : null;
  const dismissedBatterLabel = lastWicket
    ? `${lastWicketBatter?.name || 'Batter'} ${lastWicket.status} — ${lastWicket.wicketType}`
    : null;
  const scoreLabel = inning ? `${battingTeam.shortName} ${inning.runs}/${inning.wickets} (${formatOvers(inning.balls)})` : null;

  const last6 = (inning?.recentBalls || []).slice(-6);
  const recentCommentaryLines = (inning?.commentary || []).slice(0, 2);
  const nextActionLabel = isMyTeamBatting
    ? BATTING_INTENT_SHOT[userBattingIntent] || 'Balanced Stroke'
    : BOWLING_INTENT_ACTION[userBowlingPlan?.intent || 'WICKET_TAKING'] || 'Attack the Stumps';

  const strikerLine = inning?.batters[striker?.id || ''] || { balls: 0, fours: 0, out: false, runs: 0, sixes: 0, status: 'not out' };
  const nonStrikerLine = inning?.batters[nonStriker?.id || ''] || { balls: 0, fours: 0, out: false, runs: 0, sixes: 0, status: 'not out' };
  const bowlerLine = inning?.bowlers[currentBowler?.id || ''] || { balls: 0, dots: 0, runs: 0, wickets: 0 };

  const buildAndPersistCheckpoint = useCallback(async (isExit: boolean = false) => {
    if (!currentMatchId || innings.length === 0 || resultSubmitted) return;
    
    const currentInning = innings[inningNo - 1];
    if (!currentInning) return;

    const currentBalls = currentInning.balls;
    const oversFormatted = `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`;

    const sLine = striker ? currentInning.batters[striker.id] : null;
    const nsLine = nonStriker ? currentInning.batters[nonStriker.id] : null;
    const bLine = currentBowler ? currentInning.bowlers[currentBowler.id] : null;

    const allCommittedIds = currentInning.deliveries
      .map(d => (d as any).deliveryId || `${d.over}.${d.ball}`)
      .filter(Boolean);

    const snapshot: MatchCheckpoint = {
      version: 1,
      matchId: currentMatchId,
      fixtureId: currentMatchId,
      arenaId: activeArenaId || 'ipl_2026',
      seasonId: currentMatch?.season || 2026,
      format: (selectedFormat as string) || 'T20',
      timestamp: new Date().toISOString(),
      savedAt: Date.now(),

      team1Id: team1.id,
      team2Id: team2.id,
      team1Name: team1.name,
      team2Name: team2.name,
      team1ShortName: team1.shortName,
      team2ShortName: team2.shortName,
      playingXIIds: playingXIIds || [],
      selectedSquadIds: selectedSquadIds || [],

      toss: currentMatchToss,
      pitch,
      weather,
      conditions: conditionsModel || undefined,

      inningNo,
      innings,
      isMatchOver,
      resultSubmitted,
      matchTarget,

      strikerId,
      nonStrikerId,
      bowlerId,
      lastOverBowlerId,
      battingCursor,
      pending,
      pendingBatterEnd,
      queueBowlerAfterBatter,

      currentRuns: currentInning.runs,
      currentWickets: currentInning.wickets,
      currentBalls: currentInning.balls,
      oversFormatted,
      strikerName: striker?.name,
      strikerRuns: sLine?.runs ?? 0,
      strikerBalls: sLine?.balls ?? 0,
      nonStrikerName: nonStriker?.name,
      nonStrikerRuns: nsLine?.runs ?? 0,
      nonStrikerBalls: nsLine?.balls ?? 0,
      bowlerName: currentBowler?.name,
      bowlerOvers: bLine ? `${Math.floor(bLine.balls / 6)}.${bLine.balls % 6}` : '0.0',
      bowlerRuns: bLine?.runs ?? 0,
      bowlerWickets: bLine?.wickets ?? 0,

      fieldPresetKey,
      liveFieldConfiguration,

      lastCompletedDeliveryId: completedDeliveryIdRef.current,
      lastCommittedDeliveryId: committedDeliveryIdRef.current,
      committedDeliveryIds: allCommittedIds,
      ballLifecycleState,
      recentBalls: currentInning.recentBalls,
      ...serializeFieldState({ fieldPresetKey, liveFieldConfiguration }),
    };

    saveLiveMatchState(snapshot);
    await saveMatchCheckpointAction(snapshot);

    if (isExit) {
      setGameState(GameState.HOME);
    }
  }, [
    currentMatchId, innings, inningNo, resultSubmitted, striker, nonStriker, currentBowler,
    activeArenaId, currentMatch, selectedFormat, team1, team2, playingXIIds, selectedSquadIds,
    currentMatchToss, pitch, weather, conditionsModel, isMatchOver, matchTarget, strikerId,
    nonStrikerId, bowlerId, lastOverBowlerId, battingCursor, pending, pendingBatterEnd,
    queueBowlerAfterBatter, fieldPresetKey, liveFieldConfiguration, ballLifecycleState,
    saveLiveMatchState, saveMatchCheckpointAction, setGameState
  ]);

  useEffect(() => {
    if (inningNo && innings.length > 0 && currentMatchId && !resultSubmitted) {
      buildAndPersistCheckpoint(false);
    } else if (resultSubmitted) {
      saveLiveMatchState(null);
    }
  }, [
    currentMatchId, inningNo, innings, strikerId, nonStrikerId, bowlerId,
    lastOverBowlerId, battingCursor, pending, pendingBatterEnd, pitch, weather,
    fieldPresetKey, liveFieldConfiguration, resultSubmitted, buildAndPersistCheckpoint,
    saveLiveMatchState
  ]);

  // Synchronous flush on tab close / browser reload / crash protection
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!currentMatchId || innings.length === 0 || resultSubmitted) return;
      const currentInning = innings[inningNo - 1];
      if (!currentInning) return;
      const currentBalls = currentInning.balls;
      const oversFormatted = `${Math.floor(currentBalls / 6)}.${currentBalls % 6}`;
      const snapshot: MatchCheckpoint = {
        version: 1,
        matchId: currentMatchId,
        fixtureId: currentMatchId,
        arenaId: activeArenaId || 'ipl_2026',
        seasonId: currentMatch?.season || 2026,
        format: (selectedFormat as string) || 'T20',
        timestamp: new Date().toISOString(),
        savedAt: Date.now(),
        team1Id: team1.id,
        team2Id: team2.id,
        team1Name: team1.name,
        team2Name: team2.name,
        team1ShortName: team1.shortName,
        team2ShortName: team2.shortName,
        playingXIIds: playingXIIds || [],
        selectedSquadIds: selectedSquadIds || [],
        toss: currentMatchToss,
        pitch,
        weather,
        inningNo,
        innings,
        isMatchOver,
        resultSubmitted,
        matchTarget,
        strikerId,
        nonStrikerId,
        bowlerId,
        lastOverBowlerId,
        battingCursor,
        pending,
        pendingBatterEnd,
        currentRuns: currentInning.runs,
        currentWickets: currentInning.wickets,
        currentBalls: currentInning.balls,
        oversFormatted,
        strikerName: striker?.name,
        nonStrikerName: nonStriker?.name,
        bowlerName: currentBowler?.name,
        fieldPresetKey,
        liveFieldConfiguration,
        lastCompletedDeliveryId: completedDeliveryIdRef.current,
        lastCommittedDeliveryId: committedDeliveryIdRef.current,
        committedDeliveryIds: currentInning.deliveries.map(d => `${d.over}.${d.ball}`),
      };
      matchRecoveryStorage.saveCheckpointSync(snapshot);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    currentMatchId, innings, inningNo, resultSubmitted, striker, nonStriker,
    currentBowler, fieldPresetKey, liveFieldConfiguration, activeArenaId, currentMatch,
    selectedFormat, team1, team2, playingXIIds, selectedSquadIds, currentMatchToss,
    pitch, weather, isMatchOver, matchTarget, strikerId, nonStrikerId, bowlerId,
    lastOverBowlerId, battingCursor, pending, pendingBatterEnd
  ]);

  const currentOverTotalRuns = useMemo(() => {
    return (inning?.deliveries || [])
      .filter((d) => d.over === currentOverIdx)
      .reduce((sum, d) => sum + d.runs, 0);
  }, [inning?.deliveries, currentOverIdx]);

  const currentOverWickets = useMemo(() => {
    return (inning?.deliveries || [])
      .filter((d) => d.over === currentOverIdx && d.isWicket).length;
  }, [inning?.deliveries, currentOverIdx]);

  const targetScore = matchTarget;
  const runsNeeded = targetScore ? Math.max(0, targetScore - (inning?.runs || 0)) : 0;
  const ballsRemaining = Math.max(0, maxBalls - (inning?.balls || 0));
  const requiredRunRate = ballsRemaining > 0 && runsNeeded > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : '0.00';

  const winProbability = useMemo(() => {
    if (inningNo === 1 || (isTest && inningNo < 4)) {
      // Pre-result innings: a lead-weighted, format-par balance. For Tests this
      // stands in for the state of a multi-innings match before the chase.
      const par = selectedFormat === 'ODI' ? 275 : selectedFormat === 'TEST' ? 320 : 168;
      const proj = inning?.balls ? Math.round((inning.runs / inning.balls) * (maxBalls || 120)) : par;
      const diff = proj - par + (isTest ? testLead * 0.35 : 0);
      const batProb = Math.max(15, Math.min(85, Math.round(50 + diff * 0.4 - (inning?.wickets || 0) * 3.5)));
      return { batting: batProb, bowling: 100 - batProb };
    } else {
      if (runsNeeded === 0) return { batting: 100, bowling: 0 };
      if ((inning?.wickets || 0) >= 10) return { batting: 0, bowling: 100 };
      if (isTest) {
        // 4th-innings chase has no over limit: weigh runs needed vs wickets left.
        const wicketsLeft = 10 - (inning?.wickets || 0);
        const batProb = Math.max(5, Math.min(95, Math.round(50 + wicketsLeft * 4 - runsNeeded * 0.15)));
        return { batting: batProb, bowling: 100 - batProb };
      }
      if (ballsRemaining <= 0) return { batting: 0, bowling: 100 };
      const rrr = Number(requiredRunRate);
      const base = 50 + (8.5 - rrr) * 6 - (inning?.wickets || 0) * 4.5;
      const clamped = Math.max(5, Math.min(95, Math.round(base)));
      return { batting: clamped, bowling: 100 - clamped };
    }
  }, [inningNo, runsNeeded, ballsRemaining, requiredRunRate, inning?.balls, inning?.runs, inning?.wickets, maxBalls, selectedFormat, isTest, testLead]);

  const filteredCommentary = useMemo(() => {
    const list = inning?.commentary || [];
    if (commentaryFilter === 'ALL') return list;
    if (commentaryFilter === 'HIGHLIGHTS') {
      return list.filter(item => item.tone === 'wicket' || item.tone === 'six' || item.tone === 'four');
    }
    if (commentaryFilter === 'WICKETS') {
      return list.filter(item => item.tone === 'wicket' || item.outcome === 'W');
    }
    if (commentaryFilter === 'BOUNDARIES') {
      return list.filter(item => item.tone === 'four' || item.tone === 'six' || item.outcome === '4' || item.outcome === '6');
    }
    if (commentaryFilter === 'OVERS') {
      return list.filter(item => item.ball.endsWith('.6') || item.ball === 'TIMEOUT');
    }
    return list;
  }, [inning?.commentary, commentaryFilter]);

  const handleReplayBall = (ballItem?: CommentaryLine) => {
    if (!ballItem) return;
    const match = historyDeliveryResults.find(d => `${d.overIndex}.${d.ballInOver}` === ballItem.ball) || currentDeliveryResult;
    if (match) {
      setReplayDelivery({ ...match, id: `replay_${Date.now()}_${Math.random()}` });
    }
  };

  const handleReturnToHub = () => {
    if (isMatchOver) {
      saveLiveMatchState(null);
      setGameState(GameState.ARENA_HUB);
    } else {
      buildAndPersistCheckpoint(true);
    }
  };

  const handleSaveAndExit = async () => {
    await buildAndPersistCheckpoint(true);
  };

  const currentOverDeliveries = useMemo(() => {
    return (inning?.deliveries || []).filter((d) => d.over === currentOverIdx);
  }, [inning?.deliveries, currentOverIdx]);

  const activeScorecardInning = innings[selectedScorecardInning] || inning;
  const scBatTeam = franchises.find(f => f.id === activeScorecardInning?.battingTeamId) || (selectedScorecardInning === 0 ? battingTeam : bowlingTeam);
  const scBowlTeam = franchises.find(f => f.id === activeScorecardInning?.bowlingTeamId) || (selectedScorecardInning === 0 ? bowlingTeam : battingTeam);
  const scBatSquad = getTeamSquad(activeScorecardInning?.battingTeamId || battingTeam.id);
  const scBowlSquad = getTeamSquad(activeScorecardInning?.bowlingTeamId || bowlingTeam.id);
  const activeExtras = activeScorecardInning?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  const totalExtras = (activeExtras.wides || 0) + (activeExtras.noBalls || 0) + (activeExtras.byes || 0) + (activeExtras.legByes || 0);

  const didNotBatPlayers = scBatSquad.filter(player => {
    const line = activeScorecardInning?.batters[player.id];
    const isCurrentlyBatting = (player.id === strikerId || player.id === nonStrikerId) && selectedScorecardInning === inningNo - 1;
    return !line && !activeScorecardInning?.wicketLog?.some(w => w.playerId === player.id) && !isCurrentlyBatting;
  });

  return (
    <div className="relative min-h-screen bg-[#071109] text-white flex flex-col md:flex-row selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden font-sans">
      {/* Ambient Olive Glow Background Elements */}
      <div className="pointer-events-none fixed -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[130px] z-0" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 w-96 h-96 bg-emerald-800/15 rounded-full blur-[140px] z-0" />

      {/* ═══════════════════════════════════════════════════════════════════════
          1. ELEGANT LEFT-SIDE VERTICAL NAVIGATION (COMPACT FLOATING BAR)
      ═══════════════════════════════════════════════════════════════════════ */}
      <aside className="w-full md:w-16 lg:w-20 shrink-0 bg-[#09150d]/90 backdrop-blur-xl border-b md:border-b-0 md:border-r border-emerald-500/20 flex md:flex-col items-center justify-between py-3 md:py-5 px-3 md:px-0 z-40 shadow-[4px_0_30px_rgba(0,0,0,0.6)]">
        <div className="flex md:flex-col items-center gap-4 md:gap-6 w-full">
          {/* Logo / Brand Icon */}
          <button
            onClick={handleReturnToHub}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/40 hover:scale-105 transition-transform"
            title="Pavilion (Back to Hub)"
          >
            <Radio className="w-5 h-5 animate-pulse text-emerald-100" />
          </button>

          {/* Navigation Destinations */}
          <nav className="flex md:flex-col items-center gap-2 md:gap-3 w-full md:px-2 overflow-x-auto no-scrollbar">
            {[
              {
                id: 'HOME',
                label: 'Home',
                icon: Home,
                action: () => setGameState(GameState.LANDING),
                active: false,
              },
              {
                id: 'LIVE',
                label: 'Live Match',
                icon: Radio,
                action: () => {},
                active: true,
              },
              {
                id: 'FIXTURES',
                label: 'Fixtures',
                icon: Calendar,
                action: () => {
                  handleReturnToHub();
                  useGameStore.getState().setActiveTab('MATCHES');
                },
                active: false,
              },
              {
                id: 'SQUAD',
                label: 'Teams/Squad',
                icon: Users,
                action: () => {
                  handleReturnToHub();
                  useGameStore.getState().setActiveTab('SQUAD');
                },
                active: false,
              },
              {
                id: 'STATS',
                label: 'Statistics',
                icon: BarChart3,
                action: () => {
                  handleReturnToHub();
                  useGameStore.getState().setActiveTab('PLAYER_STATS');
                },
                active: false,
              },
              {
                id: 'SETTINGS',
                label: 'Settings',
                icon: Settings,
                action: () => setShowSettings(true),
                active: false,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={cn(
                    "w-10 h-10 md:w-11 md:h-11 rounded-xl flex flex-col items-center justify-center transition-all relative group",
                    item.active
                      ? "bg-emerald-500 text-slate-950 font-black shadow-[0_0_16px_rgba(16,185,129,0.5)] border border-emerald-400"
                      : "text-emerald-400/70 hover:text-white hover:bg-emerald-950/60 border border-transparent hover:border-emerald-500/20"
                  )}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="text-[7.5px] font-black uppercase tracking-tighter mt-0.5 truncate max-w-[38px] leading-none">
                    {item.label.split('/')[0]}
                  </span>
                  {item.active && (
                    <span className="hidden md:block absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-400 rounded-r-full shadow-[0_0_8px_#34d399]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Franchise Crest */}
        <div className="hidden md:flex flex-col items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center text-xs font-black text-emerald-300 shadow-md"
            title={`Managed Team: ${myTeamId ? franchises.find(f => f.id === myTeamId)?.name : 'Spectator'}`}
          >
            {myTeamId ? franchises.find(f => f.id === myTeamId)?.shortName.slice(0, 3) || 'MGR' : 'ARENA'}
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN APPLICATION WORKSPACE (DARK OLIVE-GREEN GLASSMORPHISM)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 p-3 sm:p-4 lg:p-5 gap-3.5 sm:gap-4 overflow-y-auto max-w-[1720px] mx-auto w-full z-10">
        
        {/* TOP BAR / BROADCAST STATUS HEADER */}
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#102216]/75 backdrop-blur-xl border border-emerald-500/20 shadow-md">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            <button
              onClick={handleReturnToHub}
              className="p-1.5 rounded-xl bg-[#14281b] hover:bg-[#1a3524] border border-emerald-500/20 text-emerald-300 transition-colors flex items-center gap-1.5"
              title="Return to Pavilion Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline font-bold text-[11px] uppercase">Pavilion</span>
            </button>

            <span className="font-black text-white tracking-wide text-xs sm:text-sm">
              {currentMatch?.playoffType
                ? `${currentMatch.playoffType} · ${team1.shortName} vs ${team2.shortName}`
                : currentMatch
                  ? `Match ${currentMatch.matchNumber} · ${team1.shortName} vs ${team2.shortName}`
                  : `${team1.shortName} vs ${team2.shortName}`}
            </span>

            <span className="text-emerald-500/60 hidden sm:inline">|</span>

            <span className="px-2 py-0.5 rounded-lg bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] uppercase">
              {selectedFormat || 'T20'}
            </span>

            <span className="text-slate-400 text-[11px] hidden md:inline truncate max-w-[200px] xl:max-w-none">
              {currentMatch?.venue || 'Wankhede Stadium, Mumbai'}
            </span>

            {isTest && (
              <span className="px-2 py-0.5 rounded-lg bg-rose-950/70 border border-rose-500/30 text-rose-300 font-bold text-[10px] uppercase">
                Day {testDaySession.day} · {testDaySession.session}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden lg:inline text-[11px] text-emerald-400/80 font-medium">
              Pitch: <strong className="text-white capitalize">{pitch}</strong> · Weather: <strong className="text-white capitalize">{weather}</strong>
            </span>

            {/* Impact Player substitution button (IPL only) */}
            {selectedFormat === 'IPL' && (
              <button
                onClick={() => setShowImpactModal(true)}
                className="px-2.5 py-1 rounded-xl bg-purple-900/60 hover:bg-purple-800/70 text-purple-200 border border-purple-500/40 text-[10px] font-black uppercase tracking-wider transition-all"
                title="Tactical Impact Player Substitution"
              >
                ⚡ Impact Player
              </button>
            )}

            {/* Field Tactics Drawer button */}
            <button
              onClick={() => setShowTacticsDrawer(true)}
              className="px-2.5 py-1 rounded-xl bg-[#14281b] hover:bg-[#1a3524] text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
              title="Field Formations & Tactics"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Field Tactics</span>
            </button>

            {/* Google Cloud Save Button / Indicator */}
            {authUser ? (
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                title={`Saved to Google Account: ${authUser.email}`}
              >
                <div className="relative">
                  {authUser.picture ? (
                    <img src={authUser.picture} alt="" className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-[8px] text-white flex items-center justify-center font-bold">
                      {authUser.name[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="hidden xl:inline max-w-[80px] truncate">{authUser.name}</span>
                <span className="text-[9px] text-emerald-400 font-mono hidden md:inline">Synced</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowGoogleModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white border border-slate-700/80 text-[10px] font-bold transition-all shadow-xs cursor-pointer"
                title="Sign in with Google to save match progress"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span className="hidden sm:inline">Save with Google</span>
              </button>
            )}

            {/* Continuous Delivery Autosave & Recovery Status Indicator */}
            <div 
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/40 border border-white/10 text-[10px] font-black uppercase tracking-wider"
              title="Continuous Delivery Autosave & Crash Recovery System"
            >
              {recoveryStatus === 'SAVING...' ? (
                <>
                  <RotateCw className="w-3 h-3 text-[#F5B82E] animate-spin" />
                  <span className="text-[#F5B82E]">SAVING...</span>
                </>
              ) : recoveryStatus === 'OFFLINE — LOCAL BACKUP ACTIVE' ? (
                <>
                  <WifiOff className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-300">OFFLINE — LOCAL BACKUP ACTIVE</span>
                </>
              ) : recoveryStatus === 'SAVE FAILED — RETRYING' ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-400 animate-bounce" />
                  <span className="text-rose-400">SAVE FAILED — RETRYING</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">ALL PROGRESS SAVED</span>
                </>
              )}
            </div>

            {/* SAVE & EXIT BUTTON */}
            <button
              type="button"
              onClick={handleSaveAndExit}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(245,184,46,0.15)] hover:scale-105 active:scale-95 cursor-pointer"
              title="Save match progress checkpoint and safely return to dashboard"
            >
              <Save className="w-3.5 h-3.5" />
              <span>SAVE & EXIT</span>
            </button>

            {/* Live Indicator Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-400 text-[10px] font-black tracking-wider uppercase shadow-[0_0_12px_rgba(16,185,129,0.3)]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{isMatchOver ? 'OFFICIAL RESULT' : 'LIVE'}</span>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════════════
            UPPER SECTION: SPLIT SCREEN (VIDEO PANEL ~58% | SCORECARD ~42%)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
          
          {/* ── 3. MAIN LIVE MATCH VIDEO PANEL — LEFT (~58-60% WIDTH) ── */}
          <div className="lg:col-span-7 xl:col-span-7 flex flex-col">
            <div
              ref={liveVideoPanelRef}
              className="w-full h-full min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] rounded-2xl bg-[#0b1710]/90 backdrop-blur-xl border border-emerald-500/25 shadow-2xl relative overflow-hidden flex flex-col justify-between group"
            >
              {/* Top Video Overlay Bar */}
              <div className="absolute top-2.5 left-2.5 right-2.5 z-30 flex items-center justify-between gap-2 pointer-events-none">
                <div className="flex items-center gap-2 pointer-events-auto">
                  <span className="px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-black uppercase tracking-wider">
                    {selectedFormat || 'T20'} ARENA BROADCAST
                  </span>
                  {inning?.isFreeHitPending && (
                    <span className="px-2.5 py-1 rounded-xl bg-amber-500/30 backdrop-blur-md border border-amber-400 text-amber-300 text-[10px] font-black uppercase tracking-wider animate-bounce">
                      FREE HIT
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pointer-events-auto">
                  {/* Fielder Display Mode Pill */}
                  <div className="flex items-center bg-black/60 backdrop-blur-md p-0.5 rounded-xl border border-white/10 text-[9px] font-bold">
                    <button
                      type="button"
                      onClick={() => setDisplayMode('STANDARD')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg transition-all",
                        displayMode === 'STANDARD' ? "bg-emerald-500 text-slate-950 font-black shadow-sm" : "text-slate-300 hover:text-white"
                      )}
                    >
                      Clean
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayMode('LABELS')}
                      className={cn(
                        "px-2 py-0.5 rounded-lg transition-all",
                        displayMode === 'LABELS' ? "bg-emerald-500 text-slate-950 font-black shadow-sm" : "text-slate-300 hover:text-white"
                      )}
                    >
                      Labels
                    </button>
                  </div>
                </div>
              </div>

              {/* Central 3D / Real-time Match Visualizer */}
              <div className="w-full h-full flex-1 relative flex items-center justify-center overflow-hidden bg-[#060e08]">
                <div className={cn("w-full h-full transition-transform duration-500 ease-out flex items-center justify-center", cameraTransformClass)}>
                  <CricketActionVisualizer
                    striker={striker || null}
                    nonStriker={nonStriker || null}
                    bowler={currentBowler || null}
                    deliveryResult={currentDeliveryResult}
                    lifecycle={deliveryLifecycle}
                    onPlaybackComplete={handlePlaybackComplete}
                    onContactReached={handleContactReached}
                    format={(selectedFormat as ArenaFormat) || 'T20'}
                    battingTeamName={battingTeam.name}
                    bowlingTeamName={bowlingTeam.name}
                    isFreeHit={Boolean(inning?.isFreeHitPending)}
                    score={{
                      runs: inning?.runs || 0,
                      wickets: inning?.wickets || 0,
                      overs: inning?.balls ? Math.floor(inning.balls / 6) : 0,
                      balls: inning?.balls ? inning.balls % 6 : 0,
                    }}
                    target={matchTarget > 0 ? matchTarget : undefined}
                    testDaySession={isTest ? testDaySession : undefined}
                    pitch={pitch}
                    weather={weather}
                    fieldingSquad={bowlingSquad}
                    partnershipRuns={inning?.partnershipRuns}
                    partnershipBalls={inning?.partnershipBalls}
                    onFieldChangingChange={setIsFieldChanging}
                    onBallLifecycleChange={handleBallLifecycleChange}
                    userTeamControlMode="FULL_AUTO"
                    aiCaptainRecommendation={null}
                    manualControlsEnabled={true}
                    userBattingIntent={userBattingIntent}
                    onUserBattingIntentChange={setUserBattingIntent}
                    isUserTeamBatting={isMyTeamBatting}
                    isUserTeamBowling={isMyTeamBowling}
                    opponentTacticalNotice={opponentTacticalNotice}
                    batterState={striker ? batterStates[striker.id] || null : null}
                    playbackSpeed={playbackSpeed}
                    onPlaybackSpeedChange={setPlaybackSpeed}
                    isPlaybackPaused={isPlaybackPaused}
                    onTogglePause={() => {
                      setIsPlaybackPaused(p => !p);
                      setAutoPlay(p => !p);
                    }}
                    replayTrigger={replayTrigger}
                    skipTrigger={skipTrigger}
                    hideTopHeader={true}
                    hideSideAndBottomPanels={true}
                    displayMode={displayMode}
                    onDisplayModeChange={setDisplayMode}
                    replayDeliveryResult={replayDelivery}
                    fieldPresetKey={fieldPresetKey}
                    initialFieldConfiguration={liveFieldConfiguration}
                    onFieldPresetChange={handleUserFieldPresetChange}
                    onFieldConfigurationChange={setLiveFieldConfiguration}
                    totalOvers={Math.round(maxBalls / 6)}
                    hotZones={recentBoundaryZones}
                  />
                </div>
              </div>

              {/* Bottom Video Controls Overlay */}
              <div className="z-30 bg-[#0a170f]/90 backdrop-blur-xl border-t border-emerald-500/20 p-2.5 sm:px-4 flex flex-wrap items-center justify-between gap-2">
                {/* Play/Pause & Live Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setAutoPlay(v => !v);
                      setIsPlaybackPaused(v => !v);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md",
                      autoPlay && !isPlaybackPaused
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-amber-500 hover:bg-amber-400 text-white animate-pulse"
                    )}
                    title={autoPlay && !isPlaybackPaused ? "Pause Match" : "Resume Match"}
                  >
                    {autoPlay && !isPlaybackPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                    <span className="text-[10px] uppercase">{autoPlay && !isPlaybackPaused ? 'Pause' : 'Play'}</span>
                  </button>

                  <button
                    onClick={() => setReplayTrigger(n => n + 1)}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#14281b] hover:bg-[#1a3524] border border-emerald-500/20 text-emerald-300 transition-colors"
                    title="Replay Previous Delivery"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Over Progress Scrubber & Next Ball Buttons */}
                <div className="flex items-center gap-2">
                  {/* Delivery progress in current over */}
                  <div className="hidden sm:flex items-center gap-1 bg-[#07120a] px-2.5 py-1 rounded-xl border border-emerald-900/40">
                    <span className="text-[9px] font-black text-emerald-400/80 uppercase mr-1">Over:</span>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const ballNum = i + 1;
                      const currentBallInOver = (inning?.balls || 0) % 6;
                      const isCompleted = ballNum <= currentBallInOver;
                      const isCurrent = ballNum === currentBallInOver + 1;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full transition-all",
                            isCompleted
                              ? "bg-emerald-400"
                              : isCurrent
                              ? "bg-amber-400 animate-pulse scale-125"
                              : "bg-emerald-950/80 border border-emerald-900/60"
                          )}
                          title={`Ball ${ballNum}`}
                        />
                      );
                    })}
                  </div>

                  {/* Playback Speed (1x, 1.5x, 2x) */}
                  <div className="flex items-center bg-[#14281b] p-0.5 rounded-xl border border-emerald-500/20">
                    {([1, 1.5, 2] as AnimationSpeed[]).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setPlaybackSpeed(spd)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black transition-all",
                          playbackSpeed === spd
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                            : "text-emerald-300/70 hover:text-white"
                        )}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>

                  {/* Next Ball / Skip button */}
                  <button
                    onClick={() => {
                      if (isBallAnimating) {
                        setSkipTrigger(n => n + 1);
                      } else if (!autoPlay && canPlayManualBall) {
                        setManualBallRequests(n => n + 1);
                      }
                    }}
                    disabled={!isBallAnimating && (!canPlayManualBall || autoPlay)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-[10px] font-black uppercase transition-all border shadow-sm",
                      isBallAnimating
                        ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500"
                        : canPlayManualBall && !autoPlay
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400"
                        : "opacity-40 bg-[#122319] border-emerald-900/40 text-emerald-800 cursor-not-allowed"
                    )}
                  >
                    {isBallAnimating ? 'Skip' : 'Next Ball'}
                  </button>

                  {/* Play Over button */}
                  <button
                    onClick={() => {
                      if (!autoPlay && canPlayManualBall) {
                        const ballsInCurrentOver = (inning?.balls || 0) % 6;
                        const remInOver = ballsInCurrentOver === 0 ? 6 : 6 - ballsInCurrentOver;
                        setManualBallRequests(n => n + remInOver);
                      }
                    }}
                    disabled={autoPlay || !canPlayManualBall}
                    className={cn(
                      "hidden md:inline-block px-2.5 py-1 rounded-xl text-[10px] font-black uppercase transition-all border",
                      !autoPlay && canPlayManualBall
                        ? "bg-[#183523] hover:bg-[#20452d] text-emerald-200 border-emerald-500/40"
                        : "opacity-40 bg-[#122319] border-emerald-900/40 text-emerald-800 cursor-not-allowed"
                    )}
                  >
                    Play Over
                  </button>
                </div>

                {/* Camera & Overlay Toggles */}
                <div className="flex items-center gap-1.5">
                  {/* Camera Select */}
                  <select
                    value={cameraMode}
                    onChange={(e) => setCameraMode(e.target.value as any)}
                    className="bg-[#14281b] text-emerald-300 text-[10px] font-black px-2 py-1 rounded-xl border border-emerald-500/30 focus:outline-none cursor-pointer"
                    title="Camera Perspective"
                  >
                    <option value="BROADCAST">📹 Broadcast</option>
                    <option value="PITCH">🎯 Pitch Cam</option>
                    <option value="TACTICAL">🏏 Tactical 2D</option>
                    <option value="SKY">🌐 Sky Cam</option>
                  </select>

                  {/* Commentary quick toggle */}
                  <button
                    onClick={() => setShowCommentaryDrawer(v => !v)}
                    className={cn(
                      "p-1.5 sm:p-2 rounded-xl border text-[10px] font-black transition-colors flex items-center gap-1",
                      showCommentaryDrawer
                        ? "bg-emerald-500 text-slate-950 border-emerald-400"
                        : "bg-[#14281b] hover:bg-[#1a3524] border-emerald-500/20 text-emerald-300"
                    )}
                    title="Commentary Log"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  {/* Fullscreen toggle */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 rounded-xl bg-[#14281b] hover:bg-[#1a3524] border border-emerald-500/20 text-emerald-300 transition-colors"
                    title="Toggle Fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. RIGHT-SIDE LIVE SCORECARD (~40-42% WIDTH) ── */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col">
            <div className="w-full h-full min-h-[380px] sm:min-h-[460px] lg:min-h-[520px] rounded-2xl bg-[#0e1d13]/85 backdrop-blur-xl border border-emerald-500/25 p-4 shadow-2xl flex flex-col justify-between">
              
              {/* Scorecard Header */}
              <div className="space-y-3 pb-3 border-b border-emerald-500/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                    <h2 className="text-sm font-black text-white tracking-wider uppercase">SCORECARD</h2>
                  </div>

                  {/* Batting vs Bowling View Switcher */}
                  <div className="flex items-center bg-[#07130a] p-0.5 rounded-xl border border-emerald-500/20 text-[10px] font-black">
                    <button
                      onClick={() => setScorecardTab('BATTING')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg transition-all",
                        scorecardTab === 'BATTING'
                          ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                          : "text-emerald-300/70 hover:text-white"
                      )}
                    >
                      Batting
                    </button>
                    <button
                      onClick={() => setScorecardTab('BOWLING')}
                      className={cn(
                        "px-2.5 py-1 rounded-lg transition-all",
                        scorecardTab === 'BOWLING'
                          ? "bg-emerald-500 text-slate-950 font-black shadow-sm"
                          : "text-emerald-300/70 hover:text-white"
                      )}
                    >
                      Bowling
                    </button>
                  </div>
                </div>

                {/* Innings Selector Pills */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <img
                      src={resolveTeamLogo(scBatTeam)}
                      alt={scBatTeam.shortName}
                      className="h-6 w-6 object-contain drop-shadow"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white truncate max-w-[140px] sm:max-w-none">{scBatTeam.name}</span>
                      <span className="text-[10px] text-emerald-400 font-bold">vs {scBowlTeam.shortName}</span>
                    </div>
                  </div>

                  {/* Innings Switcher Tabs */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.max(1, innings.length || 1) }).map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedScorecardInning(idx)}
                        className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all border",
                          selectedScorecardInning === idx
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-sm"
                            : "bg-[#14281b] text-emerald-300/80 border-emerald-500/20 hover:text-white"
                        )}
                      >
                        {isTest ? `${ordinal(idx + 1)} Inn` : idx === 0 ? '1st Inn' : '2nd Inn'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Batting Scorecard Table */}
              {scorecardTab === 'BATTING' ? (
                <div className="flex-1 overflow-y-auto max-h-[340px] lg:max-h-[380px] my-2 pr-1 custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-wider text-emerald-400/80 border-b border-emerald-500/20 pb-1.5">
                        <th className="py-1.5 pl-1 font-bold">Batter</th>
                        <th className="py-1.5 font-bold text-slate-400">Dismissal</th>
                        <th className="py-1.5 text-center font-bold">R</th>
                        <th className="py-1.5 text-center font-bold">B</th>
                        <th className="py-1.5 text-center font-bold text-sky-400">4s</th>
                        <th className="py-1.5 text-center font-bold text-amber-400">6s</th>
                        <th className="py-1.5 text-right pr-1 font-bold">SR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950/40">
                      {scBatSquad.map((player) => {
                        const line = activeScorecardInning?.batters[player.id];
                        const isCurrentlyBatting = (player.id === strikerId || player.id === nonStrikerId) && selectedScorecardInning === inningNo - 1;
                        const isStriker = player.id === strikerId && selectedScorecardInning === inningNo - 1;
                        const didBat = Boolean(line || activeScorecardInning?.wicketLog?.some(w => w.playerId === player.id) || isCurrentlyBatting);
                        if (!didBat) return null;

                        const runs = line?.runs || 0;
                        const balls = line?.balls || 0;
                        const fours = line?.fours || 0;
                        const sixes = line?.sixes || 0;
                        const sr = strikeRate(runs, balls);
                        const dismissalText = line?.out
                          ? (line?.status || 'out')
                          : isCurrentlyBatting
                          ? 'batting'
                          : (line?.status || 'not out');

                        return (
                          <tr
                            key={player.id}
                            className={cn(
                              "transition-colors",
                              isStriker
                                ? "bg-emerald-950/70 border-l-2 border-emerald-400"
                                : isCurrentlyBatting
                                ? "bg-emerald-950/30 border-l-2 border-emerald-600/40"
                                : "hover:bg-emerald-950/20"
                            )}
                          >
                            <td className="py-2 pl-1">
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={getPlayerImage(player.name)}
                                  alt={player.name}
                                  onError={handlePlayerImageError}
                                  className="w-5 h-5 rounded-full object-cover border border-emerald-500/30 bg-slate-900 shrink-0"
                                />
                                <span className="font-bold text-white truncate max-w-[105px]">{player.name}</span>
                                {isStriker && <span className="text-amber-400 font-black text-xs" title="Striker">★</span>}
                              </div>
                            </td>
                            <td className="py-2 text-[10.5px] text-emerald-400/80 truncate max-w-[120px]" title={dismissalText}>
                              {dismissalText}
                            </td>
                            <td className="py-2 text-center font-black text-white tabular-nums">{runs}</td>
                            <td className="py-2 text-center text-slate-300 tabular-nums">{balls}</td>
                            <td className="py-2 text-center text-sky-300 font-bold tabular-nums">{fours}</td>
                            <td className="py-2 text-center text-amber-300 font-black tabular-nums">{sixes}</td>
                            <td className="py-2 text-right pr-1 font-bold text-emerald-300 tabular-nums">{sr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Extras Line */}
                  <div className="mt-3 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-slate-300 font-medium">
                    <span>
                      Extras: <strong className="text-white">({activeExtras.wides || 0}w, {activeExtras.noBalls || 0}nb, {activeExtras.byes || 0}b, {activeExtras.legByes || 0}lb)</strong>
                    </span>
                    <span className="font-black text-white tabular-nums">{totalExtras}</span>
                  </div>

                  {/* Total Line */}
                  <div className="mt-1 py-1.5 px-2 rounded-xl bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-between text-xs font-black">
                    <span className="text-emerald-400 uppercase tracking-wide">Total</span>
                    <span className="text-white tabular-nums">
                      {activeScorecardInning?.runs || 0}/{activeScorecardInning?.wickets || 0}
                      <span className="text-[10px] text-emerald-300 font-normal ml-1">
                        ({formatOvers(activeScorecardInning?.balls || 0)} ov, RR: {economy(activeScorecardInning?.runs || 0, activeScorecardInning?.balls || 0)})
                      </span>
                    </span>
                  </div>

                  {/* Did not bat */}
                  {didNotBatPlayers.length > 0 && (
                    <div className="mt-2 text-[10px] text-slate-400">
                      <span className="font-bold text-emerald-400 uppercase tracking-wider mr-1">Did not bat:</span>
                      {didNotBatPlayers.map((p, idx) => (
                        <span key={p.id}>
                          {p.name}{idx < didNotBatPlayers.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Bowling Scorecard Table */
                <div className="flex-1 overflow-y-auto max-h-[340px] lg:max-h-[380px] my-2 pr-1 custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[9px] font-black uppercase tracking-wider text-emerald-400/80 border-b border-emerald-500/20 pb-1.5">
                        <th className="py-1.5 pl-1 font-bold">Bowler</th>
                        <th className="py-1.5 text-center font-bold">O</th>
                        <th className="py-1.5 text-center font-bold">M</th>
                        <th className="py-1.5 text-center font-bold">R</th>
                        <th className="py-1.5 text-center font-bold text-emerald-400">W</th>
                        <th className="py-1.5 text-right pr-1 font-bold">Econ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-950/40">
                      {scBowlSquad.map((player) => {
                        const line = activeScorecardInning?.bowlers[player.id];
                        if (!line || line.balls === 0) return null;
                        const isCurrentBowler = player.id === bowlerId && selectedScorecardInning === inningNo - 1;
                        const maidens = bowlerMaidens(activeScorecardInning, player.id);

                        return (
                          <tr
                            key={player.id}
                            className={cn(
                              "transition-colors",
                              isCurrentBowler ? "bg-emerald-950/70 border-l-2 border-emerald-400" : "hover:bg-emerald-950/20"
                            )}
                          >
                            <td className="py-2 pl-1">
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={getPlayerImage(player.name)}
                                  alt={player.name}
                                  onError={handlePlayerImageError}
                                  className="w-5 h-5 rounded-full object-cover border border-emerald-500/30 bg-slate-900 shrink-0"
                                />
                                <span className="font-bold text-white truncate max-w-[120px]">{player.name}</span>
                                {isCurrentBowler && <span className="text-emerald-400 text-[10px] font-black">●</span>}
                              </div>
                            </td>
                            <td className="py-2 text-center text-slate-300 tabular-nums">{formatOvers(line.balls)}</td>
                            <td className="py-2 text-center text-slate-400 tabular-nums">{maidens}</td>
                            <td className="py-2 text-center font-black text-white tabular-nums">{line.runs}</td>
                            <td className="py-2 text-center font-black text-emerald-400 tabular-nums">{line.wickets}</td>
                            <td className="py-2 text-right pr-1 font-bold text-emerald-300 tabular-nums">{economy(line.runs, line.balls)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Quick Commentary Trigger */}
              <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 truncate max-w-[220px]">
                  {inning?.commentary?.[0]?.text || "Authoritative live broadcast scorecard."}
                </span>
                <button
                  onClick={() => setShowCommentaryDrawer(true)}
                  className="text-emerald-400 hover:text-emerald-300 font-bold text-[11px] flex items-center gap-1 shrink-0"
                >
                  Commentary <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            LOWER SECTION: 3 INFORMATION CARDS ACROSS THE BOTTOM
            [BOTTOM LEFT: BATTERS] [BOTTOM CENTER: MATCH SCORE] [BOTTOM RIGHT: BOWLER & OVER]
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 items-stretch">
          
          {/* ── 5. BOTTOM LEFT — CURRENT PLAYER CARDS (ACTIVE BATTERS) ── */}
          <div className="rounded-2xl bg-[#0e1d13]/85 backdrop-blur-xl border border-emerald-500/25 p-3.5 shadow-2xl flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                🏏 Active Batters
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase">
                Partnership: <strong className="text-white">{inning?.partnershipRuns || 0} ({inning?.partnershipBalls || 0}b)</strong>
              </span>
            </div>

            {/* Pending Selection Prompt (when wicket occurs and user owns batting) */}
            {pending && (userCanSelectOpeners || userCanSelectIncomingBatter) && (
              <button
                onClick={() => {
                  if (pending === 'openers') setManualDrawerOpen('OPENERS');
                  else if (pending === 'batter') setManualDrawerOpen('BATTER');
                }}
                className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase shadow-lg flex items-center justify-center gap-2 animate-bounce"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>{pending === 'openers' ? 'Select Opening Batters' : 'Wicket! Select Next Batter'}</span>
              </button>
            )}

            {/* 2 Player Information Cards */}
            <div className="grid grid-cols-2 gap-2">
              {/* Striker Card */}
              <div className="rounded-xl bg-[#08150d] border border-emerald-500/30 p-2.5 flex flex-col justify-between relative overflow-hidden shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-11 h-13 rounded-lg overflow-hidden shrink-0 border border-emerald-500/40 bg-slate-950">
                    <JerseyPlayerImage
                      player={striker}
                      franchiseId={battingTeam.id}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-white truncate">{striker?.name || 'Striker'}</span>
                    </div>
                    <div className="inline-block px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[8px] font-black uppercase tracking-wider">
                      ★ STRIKER
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-emerald-950/60 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-black text-white tabular-nums">{strikerLine.runs}</span>
                    <span className="text-[10px] text-slate-400 ml-1 font-bold">({strikerLine.balls}b)</span>
                  </div>
                  <div className="text-right text-[9px] text-emerald-300 font-bold">
                    <span>SR: {strikeRate(strikerLine.runs, strikerLine.balls)}</span>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[8.5px] text-slate-400">
                  <span>4s: <strong className="text-sky-300 font-black">{strikerLine.fours}</strong></span>
                  <span>6s: <strong className="text-amber-300 font-black">{strikerLine.sixes}</strong></span>
                  <span className="text-emerald-400 font-bold">not out</span>
                </div>
              </div>

              {/* Non-Striker Card */}
              <div className="rounded-xl bg-[#08150d] border border-emerald-500/20 p-2.5 flex flex-col justify-between relative overflow-hidden shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-11 h-13 rounded-lg overflow-hidden shrink-0 border border-emerald-500/20 bg-slate-950">
                    <JerseyPlayerImage
                      player={nonStriker}
                      franchiseId={battingTeam.id}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-white truncate">{nonStriker?.name || 'Non-Striker'}</span>
                    </div>
                    <div className="inline-block px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[8px] font-bold uppercase tracking-wider">
                      NON-STR
                    </div>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-emerald-950/60 flex items-baseline justify-between">
                  <div>
                    <span className="text-xl font-black text-white tabular-nums">{nonStrikerLine.runs}</span>
                    <span className="text-[10px] text-slate-400 ml-1 font-bold">({nonStrikerLine.balls}b)</span>
                  </div>
                  <div className="text-right text-[9px] text-emerald-300 font-bold">
                    <span>SR: {strikeRate(nonStrikerLine.runs, nonStrikerLine.balls)}</span>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-[8.5px] text-slate-400">
                  <span>4s: <strong className="text-sky-300 font-black">{nonStrikerLine.fours}</strong></span>
                  <span>6s: <strong className="text-amber-300 font-black">{nonStrikerLine.sixes}</strong></span>
                  <span className="text-emerald-400 font-bold">not out</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 6. BOTTOM CENTER — MAIN MATCH SCORE PANEL ── */}
          <div className="rounded-2xl bg-[#0e1d13]/85 backdrop-blur-xl border border-emerald-500/25 p-3.5 shadow-2xl flex flex-col justify-between text-center gap-2">
            <div className="flex items-center justify-center gap-2">
              <img
                src={resolveTeamLogo(battingTeam)}
                alt={battingTeam.shortName}
                className="h-7 w-7 object-contain drop-shadow"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-xs font-black uppercase text-white tracking-wider">
                {battingTeam.name}
              </span>
              <span className="text-[10px] text-emerald-400 font-black px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                {isTest ? `${ordinal(inningNo)} Innings` : inningNo === 1 ? '1st Innings' : 'Chasing'}
              </span>
            </div>

            {/* Authoritative Main Score Display */}
            <div>
              <div className="text-3xl sm:text-4xl font-black text-white tabular-nums tracking-tight drop-shadow-md">
                {inning?.runs || 0}<span className="text-emerald-400">/</span>{inning?.wickets || 0}
                <span className="text-xs sm:text-sm font-bold text-slate-400 ml-2">
                  ({formatOvers(inning?.balls || 0)}{isTest ? '' : ` / ${Math.round(maxBalls / 6)}`} ov)
                </span>
              </div>

              {/* CRR & Chase Required Status */}
              <div className="flex items-center justify-center gap-2 mt-1 text-[11px] font-bold">
                <span className="text-slate-300">
                  CRR: <strong className="text-white">{currentRunRate}</strong>
                </span>

                {matchTarget > 0 && (
                  <>
                    <span className="text-emerald-500/60">·</span>
                    <span className="text-amber-300 font-black">
                      {isTest ? `Need ${runsNeeded} runs` : `Need ${runsNeeded} off ${ballsRemaining}b (RRR: ${requiredRunRate})`}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Match Venue, Toss & Description */}
            <div className="pt-1.5 border-t border-emerald-500/20 text-[10px] text-slate-400 flex flex-col gap-0.5">
              <span className="truncate">
                {tossWinner?.shortName || team1.shortName} won toss & elected to {currentMatchToss?.decision || 'Bat'}
              </span>
              <span className="text-emerald-400/90 font-semibold truncate">
                {currentMatch?.venue || 'Wankhede Stadium, Mumbai'} · {selectedFormat || 'T20'}
              </span>
            </div>
          </div>

          {/* ── 7. BOTTOM RIGHT — CURRENT BOWLER AND OVER SUMMARY ── */}
          <div className="rounded-2xl bg-[#0e1d13]/85 backdrop-blur-xl border border-emerald-500/25 p-3.5 shadow-2xl flex flex-col justify-between gap-2.5">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                ⚡ Bowling Spell
              </span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300">
                {currentBowler?.bowlingStyle || 'Bowler'}
              </span>
            </div>

            {/* Bowler Details Card */}
            <div className="flex items-center gap-3 bg-[#08150d] rounded-xl border border-emerald-500/20 p-2">
              <div className="w-11 h-13 rounded-lg overflow-hidden shrink-0 border border-emerald-500/30 bg-slate-950">
                <JerseyPlayerImage
                  player={currentBowler}
                  franchiseId={bowlingTeam.id}
                  className="w-full h-full"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-white truncate">{currentBowler?.name || 'Bowler'}</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-base font-black text-white tabular-nums">
                    {bowlerLine.wickets}-{bowlerLine.runs}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    ({formatOvers(bowlerLine.balls)} ov)
                  </span>
                </div>
                <div className="text-[9px] text-emerald-400 font-bold mt-0.5">
                  Econ: {economy(bowlerLine.runs, bowlerLine.balls)} · Maidens: {bowlerMaidens(inning, currentBowler?.id || '')}
                </div>
              </div>
            </div>

            {/* Ball-by-ball Over Summary Indicators */}
            <div className="pt-1.5 border-t border-emerald-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                  Current Over ({formatOvers(inning?.balls || 0)} ov)
                </span>
                <span className="text-[9px] font-bold text-emerald-400">
                  {currentOverTotalRuns} runs · {currentOverWickets} wkts
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {currentOverDeliveries.map((del, i) => {
                  let badgeStyle = "bg-[#14281b] text-white border-emerald-500/30";
                  if (del.outcome === 'W') {
                    badgeStyle = "bg-rose-950 text-rose-300 border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]";
                  } else if (del.outcome === '6') {
                    badgeStyle = "bg-amber-950 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]";
                  } else if (del.outcome === '4') {
                    badgeStyle = "bg-sky-950 text-sky-300 border-sky-400";
                  } else if (del.outcome === '0') {
                    badgeStyle = "bg-[#09150d] text-emerald-500/60 border-emerald-900/40";
                  } else if (del.outcome === 'Wd' || del.outcome === 'Nb') {
                    badgeStyle = "bg-yellow-950 text-yellow-300 border-yellow-400";
                  }

                  return (
                    <span
                      key={`del_${del.over}_${i}`}
                      className={cn(
                        "w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-black border transition-transform hover:scale-110",
                        badgeStyle
                      )}
                      title={`Delivery ${del.over}.${i + 1}: ${del.outcome}`}
                    >
                      {del.outcome === '0' ? '•' : del.outcome}
                    </span>
                  );
                })}

                {/* Empty slots for remainder of current over */}
                {Array.from({ length: Math.max(0, 6 - currentOverDeliveries.length) }).map((_, i) => (
                  <span
                    key={`slot_${i}`}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full border border-dashed border-emerald-900/40 text-emerald-800/40 flex items-center justify-center text-[10px]"
                  >
                    ○
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SLIDE-OVER DRAWER: COMPREHENSIVE COMMENTARY
      ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCommentaryDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, x: 340 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 340 }}
              className="w-full max-w-md h-full bg-[#0a170f]/95 backdrop-blur-2xl border-l border-emerald-500/25 p-5 shadow-2xl flex flex-col justify-between"
            >
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Ball-by-Ball Commentary</h3>
                  </div>
                  <button
                    onClick={() => setShowCommentaryDrawer(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-950/60 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {(['ALL', 'HIGHLIGHTS', 'WICKETS', 'BOUNDARIES', 'OVERS'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setCommentaryFilter(filter)}
                      className={cn(
                        "px-2.5 py-1 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap border",
                        commentaryFilter === filter
                          ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                          : "bg-[#14281b] text-emerald-300 border-emerald-500/20 hover:text-white"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {/* Commentary Stream */}
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                  {filteredCommentary.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-8">No commentary entries found.</p>
                  ) : (
                    filteredCommentary.map((line, idx) => (
                      <div
                        key={`${line.ball}-${idx}`}
                        onClick={() => handleReplayBall(line)}
                        className="p-2.5 rounded-xl bg-[#0e1d13] border border-emerald-500/20 hover:border-emerald-400/40 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-black text-emerald-400 tabular-nums">
                            Over {line.ball}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[9px] font-black",
                            line.tone === 'wicket' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' :
                            line.tone === 'six' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                            line.tone === 'four' ? 'bg-sky-950 text-sky-300 border border-sky-500/40' :
                            'bg-emerald-950 text-emerald-400 border border-emerald-900/40'
                          )}>
                            {line.outcome}
                          </span>
                        </div>
                        <p className="text-xs text-slate-200 leading-snug group-hover:text-white transition-colors">
                          {line.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-emerald-500/20">
                <button
                  onClick={() => setShowCommentaryDrawer(false)}
                  className="w-full py-2.5 rounded-xl bg-[#14281b] hover:bg-[#1a3524] text-emerald-300 border border-emerald-500/25 text-xs font-black uppercase transition-all"
                >
                  Close Commentary
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════
          SLIDE-OVER DRAWER: TACTICAL CONTROLS & FIELD FORMATIONS
      ═══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showTacticsDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, x: 380 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 380 }}
              className="w-full max-w-lg h-full bg-[#0a170f]/95 backdrop-blur-2xl border-l border-emerald-500/25 p-5 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div className="space-y-4 flex-1">
                <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Tactics & Field Formations</h3>
                  </div>
                  <button
                    onClick={() => setShowTacticsDrawer(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-emerald-950/60 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Batting Intent Selector (if user owns batting) */}
                {userCanSetBattingIntent ? (
                  <div className="space-y-2 rounded-xl bg-[#0e1d13] border border-emerald-500/20 p-3">
                    <span className="text-xs font-black uppercase text-emerald-400 block">
                      🏏 Your Batting Intent: <strong className="text-white">{userBattingIntent}</strong>
                    </span>
                    <p className="text-[10px] text-slate-400">Choose how your batters approach the current match situation.</p>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {(['SURVIVAL', 'DEFENSIVE', 'SETTLING', 'ROTATE_STRIKE', 'NORMAL', 'CONTROLLED_ATTACK', 'ACCELERATE'] as const).map((intent) => (
                        <button
                          key={intent}
                          onClick={() => setUserBattingIntent(intent)}
                          className={cn(
                            "py-2 px-2.5 rounded-xl text-[10px] font-black uppercase transition-all border text-left truncate",
                            userBattingIntent === intent
                              ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm"
                              : "bg-[#14281b] text-emerald-300 border-emerald-500/20 hover:text-white hover:bg-[#1b3624]"
                          )}
                        >
                          {intent.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#0e1d13] border border-emerald-500/20 p-3 text-xs text-slate-300 space-y-1">
                    <span className="font-black text-emerald-400 block uppercase">Opponent Batting</span>
                    <p className="text-[10px] text-slate-400">The opponent batting is controlled autonomously by the Match Engine AI.</p>
                  </div>
                )}

                {/* Bowling Plan Info */}
                <div className="space-y-2 rounded-xl bg-[#0e1d13] border border-emerald-500/20 p-3">
                  <span className="text-xs font-black uppercase text-emerald-400 block">
                    ⚡ AI Bowling Strategy: <strong className="text-white">{(userBowlingPlan?.intent || 'WICKET_TAKING').replace(/_/g, ' ')}</strong>
                  </span>
                  <p className="text-[10px] text-slate-400">The bowling captain dynamically coordinates bowling spells, fielding restrictions, and 45+ presets.</p>
                </div>
              </div>

              <div className="pt-3 border-t border-emerald-500/20">
                <button
                  onClick={() => setShowTacticsDrawer(false)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-black uppercase transition-all shadow-md"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════
          SETTINGS & GOOGLE ACCOUNT MODALS
      ═══════════════════════════════════════════════════════════════════════ */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showGoogleModal && (
        <GoogleAccountModal onClose={() => setShowGoogleModal(false)} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          IMPACT PLAYER SUBSTITUTION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showImpactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0c1811] border border-emerald-500/30 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-white">Impact Player Tactical Substitution</h3>
            <p className="text-xs text-slate-400">Swap one active player for a substitute bench player.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-400 block mb-1.5">Outgoing Active Player</label>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {selectedXiPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setImpactOutgoingId(p.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs border transition-colors",
                        impactOutgoingId === p.id ? "bg-emerald-500/20 border-emerald-400 font-bold text-white" : "border-emerald-900/40 text-slate-300 hover:bg-emerald-950/40"
                      )}
                    >
                      <span>{p.name}</span>
                      <span className="text-[10px] text-slate-400">{p.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-400 block mb-1.5">Incoming Bench Player</label>
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {franchises.find(f => f.id === myTeamId)?.squad.filter(id => !selectedSquadIds.includes(id)).map(id => players.find(p => p.id === id)).filter(Boolean).map(p => (
                    <button
                      key={p!.id}
                      onClick={() => setImpactIncomingId(p!.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs border transition-colors",
                        impactIncomingId === p!.id ? "bg-emerald-500/20 border-emerald-400 font-bold text-white" : "border-emerald-900/40 text-slate-300 hover:bg-emerald-950/40"
                      )}
                    >
                      <span>{p!.name}</span>
                      <span className="text-[10px] text-slate-400">{p!.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowImpactModal(false)}
                className="flex-1 py-2 text-xs font-bold rounded-xl border border-emerald-500/20 text-slate-300 hover:bg-emerald-950/40"
              >
                Cancel
              </button>
              <button
                disabled={!impactIncomingId || !impactOutgoingId}
                onClick={handleImpactSubstitution}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-slate-950 hover:bg-emerald-500 disabled:opacity-40"
              >
                Confirm Sub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MATCH COMPLETE CELEBRATION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {resultSubmitted && currentMatchId && innings[0] && innings[1] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl bg-[#0c1811] border border-emerald-500/30 p-6 shadow-2xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">Match Completed</h2>
              {(() => {
                if (isTest) {
                  const decided = Boolean(testResultDecision && testResultDecision.result !== 'IN_PROGRESS');
                  if (!decided) {
                    return <p className="text-base font-bold text-slate-300 mt-1">Match drawn</p>;
                  }
                  if (testResultDecision!.result === 'TIE') {
                    return <p className="text-base font-bold text-slate-300 mt-1">Match Tied</p>;
                  }
                  const winner = franchises.find((f) => f.id === testResultDecision!.winnerId);
                  return (
                    <p className="text-base font-bold text-slate-300 mt-1">
                      <strong className="text-emerald-400">{winner?.name} won by {testResultDecision!.margin}</strong>
                    </p>
                  );
                }
                const i1 = innings[0];
                const i2 = innings[1];
                const winnerId = i2.runs > i1.runs ? i2.battingTeamId : i1.battingTeamId;
                const winner = franchises.find(f => f.id === winnerId);
                const margin = i2.runs > i1.runs 
                  ? `${10 - i2.wickets} wickets` 
                  : i2.runs === i1.runs ? 'Tie' : `${i1.runs - i2.runs} runs`;

                return (
                  <p className="text-base font-bold text-slate-300 mt-1">
                    {i2.runs === i1.runs ? "Match Tied" : <strong className="text-emerald-400">{winner?.name} won by {margin}</strong>}
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-[#08150d] border border-emerald-500/20">
                <span className="text-xs font-bold text-slate-400 block">{team1.shortName}</span>
                {isTest ? (
                  <>
                    <span className="text-xl font-black text-white">
                      {innings.filter((i) => i.battingTeamId === team1.id).reduce((s, i) => s + i.runs, 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {innings.filter((i) => i.battingTeamId === team1.id).length} innings
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-black text-white">{innings[0]?.runs}/{innings[0]?.wickets}</span>
                    <span className="text-[10px] text-slate-400 block">{formatOvers(innings[0]?.balls || 0)} ov</span>
                  </>
                )}
              </div>
              <div className="p-3 rounded-2xl bg-[#08150d] border border-emerald-500/20">
                <span className="text-xs font-bold text-slate-400 block">{team2.shortName}</span>
                {isTest ? (
                  <>
                    <span className="text-xl font-black text-white">
                      {innings.filter((i) => i.battingTeamId === team2.id).reduce((s, i) => s + i.runs, 0)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {innings.filter((i) => i.battingTeamId === team2.id).length} innings
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-xl font-black text-white">{innings[1]?.runs}/{innings[1]?.wickets}</span>
                    <span className="text-[10px] text-slate-400 block">{formatOvers(innings[1]?.balls || 0)} ov</span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => setGameState(GameState.ARENA_HUB)}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl font-black transition-all shadow-lg"
            >
              Return to Tournament Hub
            </button>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MANUAL PLAYER SELECTION DRAWER / MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      <PlayerSelectionDrawer
        isOpen={manualDrawerOpen === 'OPENERS' || manualDrawerOpen === 'BATTER'}
        onClose={() => setManualDrawerOpen(null)}
        mode={manualDrawerOpen === 'OPENERS' ? 'OPENERS' : 'BATTER'}
        teamName={battingTeam.name}
        squad={battingSquad}
        format={(selectedFormat as ArenaFormat) || 'T20'}
        currentScore={{
          batters: inning?.batters,
          bowlers: inning?.bowlers,
          balls: inning?.balls,
        }}
        currentStrikerId={strikerId}
        currentNonStrikerId={nonStrikerId}
        lastOverBowlerId={lastOverBowlerId}
        aiRecommendedPlayerId={null}
        aiReasoning={null}
        scoreLabel={scoreLabel}
        dismissedBatterLabel={pending === 'batter' ? dismissedBatterLabel : null}
        onConfirmOpeners={handleConfirmOpeners}
        onConfirmBatter={handleConfirmBatter}
        onConfirmBowler={handleConfirmBowler}
      />
    </div>
  );
}
