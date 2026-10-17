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
  BarChart3
} from 'lucide-react';
import { GameState, useGameStore } from '../stores/useGameStore';
import type { Player } from '../types/common';
import { MatchEngine } from '../lib/matchEngine';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import { MatchStatus, PitchType, WeatherCondition, type InningsData, type PlayerMatchStats, DRSResult } from '../types/match';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import CricketActionVisualizer, { AnimationSpeed } from './CricketActionVisualizer';
import PlayerSelectionDrawer from './PlayerSelectionDrawer';
import { ArenaFormat } from '../engine/models/ArenaState';
import { DeliveryLifecycle, DeliveryResult } from '../types/delivery';
import { DeliveryResultFactory } from '../engine/core/DeliveryResultFactory';
import { AICaptainEngine, CaptainDecision } from '../engine/ai/AICaptainEngine';
import { BatterDecisionEngine, BatterInningsState, BattingIntent } from '../engine/ai/BatterDecisionEngine';
import { BowlingPlanEngine, DetailedBowlingPlan } from '../engine/ai/BowlingPlanEngine';
import { BowlerFieldStrategyEngine, CANONICAL_POSITIONS } from '../engine/strategy/BowlerFieldStrategyEngine';
import { BallLifecycleController, BallLifecycleState } from '../engine/fielding/BallLifecycleController';
import { validateField, getFieldingPhase, getRestrictionSummary, overFromBalls } from '../engine/fielding/FieldingRestrictionEngine';
import {
  computeControlPermissions,
  canPerformAction,
  describeControlOwnership,
  getUserInteractiveActions,
} from '../engine/control/MatchControlPermissions';
import { decideBowlingChange } from '../engine/ai/BowlingAIController';
import { selectAINextBatter, selectAIOpeningBatters } from '../engine/ai/BattingAIController';
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

type Tab = 'Live' | 'Scorecard' | 'Commentary' | 'Tactics' | 'Stats';

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

function strikeRate(runs: number, balls: number) {
  return balls ? ((runs / balls) * 100).toFixed(1) : '0.0';
}

function economy(runs: number, balls: number) {
  return balls ? (runs / (balls / 6)).toFixed(2) : '0.00';
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
  const { currentMatchId, fixtures, franchises, players, selectedFranchiseId, selectedSquadIds, playingXIIds, setSelectedSquadIds, setPlayingXIIds, currentMatchToss, standings, setGameState, updateMatchResult, liveMatchState, saveLiveMatchState, selectedFormat, playerFatigue } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('Live');
  const [autoPlay, setAutoPlay] = useState(true);
  
  const isResuming = liveMatchState?.currentMatchId === currentMatchId;
  
  const [inningNo, setInningNo] = useState<1 | 2>(isResuming ? liveMatchState.inningNo : 1);
  const [innings, setInnings] = useState<InningsState[]>(isResuming ? liveMatchState.innings : []);
  const [strikerId, setStrikerId] = useState<string | null>(isResuming ? liveMatchState.strikerId : null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(isResuming ? liveMatchState.nonStrikerId : null);
  const [bowlerId, setBowlerId] = useState<string | null>(isResuming ? liveMatchState.bowlerId : null);
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string | null>(isResuming ? liveMatchState.lastOverBowlerId : null);
  const [battingCursor, setBattingCursor] = useState(isResuming ? liveMatchState.battingCursor : 2);
  const [pending, setPending] = useState<'openers' | 'batter' | 'bowler' | null>(isResuming ? liveMatchState.pending : 'openers');
  const [pendingBatterEnd, setPendingBatterEnd] = useState<'striker' | 'non-striker'>(isResuming ? liveMatchState.pendingBatterEnd : 'striker');
  const [pitch, setPitch] = useState<PitchType>(isResuming ? liveMatchState.pitch : PitchType.BALANCED);
  const [weather, setWeather] = useState<WeatherCondition>(isResuming ? liveMatchState.weather : WeatherCondition.SUNNY);
  
  const [manualBallRequests, setManualBallRequests] = useState(0);
  const [queueBowlerAfterBatter, setQueueBowlerAfterBatter] = useState(false);
  const [resultSubmitted, setResultSubmitted] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactOutgoingId, setImpactOutgoingId] = useState<string | null>(null);
  const [impactIncomingId, setImpactIncomingId] = useState<string | null>(null);
  const [deliveryLifecycle, setDeliveryLifecycle] = useState<DeliveryLifecycle>('READY');
  const [currentDeliveryResult, setCurrentDeliveryResult] = useState<DeliveryResult | null>(null);
  const committedDeliveryIdRef = useRef<string | null>(null);
  const completedDeliveryIdRef = useRef<string | null>(null);
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
  const [fieldPresetKey, setFieldPresetKey] = useState<string | null>(null);
  const [historyDeliveryResults, setHistoryDeliveryResults] = useState<DeliveryResult[]>([]);

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

  // ─── Central control authority ───────────────────────────────────────────
  // The user controls ONLY their own team's batting decisions. All bowling,
  // bowling-plan and fielding decisions, plus the opponent's batting, are
  // owned by the AI. Every user command is gated through this permission set
  // so the rule is enforced in the application logic, not just the UI.
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
              ? inningNo === 2
                ? 'MATCH_COMPLETE'
                : 'INNINGS_BREAK'
              : 'IN_INNINGS',
      }),
    [myTeamId, inning?.battingTeamId, inning?.bowlingTeamId, inning?.isComplete, innings.length, inningNo, battingTeam.id, bowlingTeam.id],
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
    setInnings([first, second]);
    setInningNo(1);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setLastOverBowlerId(null);
    setBattingCursor(2);
    setPending('openers');
    setPendingBatterEnd('striker');
    setPitch(MatchEngine.generatePitch());
    setWeather(MatchEngine.generateWeather());
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
        target: inningNo === 2 ? (innings[0]?.runs || 0) + 1 : undefined,
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
        target: inningNo === 2 ? (innings[0]?.runs || 0) + 1 : undefined,
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
        trigger: inning.balls === 0 ? 'INITIAL' : 'OVER_END',
      });
      if (decision.bowlerId) setBowlerId(decision.bowlerId);
      if (decision.bowlingPlan) setUserBowlingPlan(decision.bowlingPlan);
      if (decision.fieldPresetKey) setFieldPresetKey(decision.fieldPresetKey);
      if (decision.notification) setOpponentTacticalNotice(decision.notification);
      setAiCaptainRecommendation(null);
      setPending(null);
    }
  }, [pending, inning, innings, inningNo, battingSquad, bowlingSquad, battingCursor, isMyTeamBatting, strikerId, nonStrikerId, queueBowlerAfterBatter, lastOverBowlerId, pendingBatterEnd, selectedFormat, pitch, weather, playerFatigue, fieldPresetKey, striker, nonStriker, getAvailableBowlers]);

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

      if (overEnded) {
        const timeout = MatchEngine.shouldTriggerStrategicTimeout(overIndex + 1, inningNo, upd.strategicTimeouts);
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

      const targetScore = inningNo === 2 ? (next[0]?.runs || 0) + 1 : 0;
      const inningsComplete = nextBall >= maxBalls || wicketNumber >= 10 || (inningNo === 2 && targetScore > 0 && nextRuns >= targetScore);
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
        trigger: wicket ? 'WICKET_FALL' : 'BOUNDARY_CLUSTER',
      });
      if (fieldDecision.fieldChanged) {
        setFieldPresetKey(fieldDecision.fieldPresetKey);
      }
      setOpponentTacticalNotice(
        fieldDecision.notification ||
          `${bowlingTeam.name} AI: ${
            wicket ? 'Wicket! Applying pressure with a fresh field.' : 'Boundary surge — protecting the rope.'
          }`,
      );
    }
  }, [currentDeliveryResult, inningNo, battingTeam.shortName, maxBalls, striker, currentMatchId, bowlingTeam.name, inning, bowlingSquad, lastOverBowlerId, currentBowler, pitch, weather, selectedFormat, fieldPresetKey, nonStriker]);

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
    const targetScore = inningNo === 2 ? (innings[0]?.runs || 0) + 1 : 0;

    const overEnded = !wicket && isLegalDelivery && nextBall % 6 === 0;
    const wicketAtOverEnd = wicket && isLegalDelivery && nextBall % 6 === 0;
    const inningsComplete = nextBall >= maxBalls || wicketNumber >= 10 || (inningNo === 2 && targetScore > 0 && nextRuns >= targetScore);

    if (inningsComplete) {
      if (inningNo === 1) {
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
  }, [currentDeliveryResult, inning, innings, inningNo, maxBalls, currentBowler, striker, nonStriker, autoPlay]);

  useEffect(() => {
    if (!inning || inning.isComplete || pending || !striker || !nonStriker || !currentBowler) return;
    if (isBallAnimating || isFieldChanging || isRetrieving) return;
    if (deliveryLifecycle !== 'READY' && deliveryLifecycle !== 'NEXT_DELIVERY') return;
    if (!autoPlay && manualBallRequests <= 0) return;

    const playDelivery = () => {
      const current = inning;
      if (current.isComplete || isBallAnimating || isFieldChanging) return;

      const target = inningNo === 2 ? (innings[0]?.runs || 0) + 1 : 0;
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
    const first = innings[0];
    const second = innings[1];
    if (!currentMatchId || resultSubmitted || !first?.isComplete || !second?.isComplete) return;

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
  }, [innings, currentMatchId, resultSubmitted, updateMatchResult]);

  const currentRunRate = inning && inning.balls ? (inning.runs / (inning.balls / 6)).toFixed(2) : '0.00';
  const currentOverIdx = inning?.balls ? (inning.balls % 6 === 0 ? Math.floor(inning.balls / 6) - 1 : Math.floor(inning.balls / 6)) : 0;
  const currentOverBalls = (inning?.deliveries || []).filter((d) => d.over === currentOverIdx).map((d) => d.outcome);

  // Format/phase fielding-restriction status (authoritative circle limits from getRules)
  const fieldStatus = useMemo(() => {
    const over = overFromBalls(inning?.balls || 0);
    const phase = getFieldingPhase(selectedFormat, over);
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
    });
    const legal = !hasPreset || validation.valid;
    return { over, phase, outside: validation.outsideCircleCount, hasPreset, legal, validation };
  }, [inning?.balls, selectedFormat, fieldPresetKey]);
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
  const matchStatus = inning?.isComplete && inningNo === 2 ? 'Result official' : inningNo === 1 ? 'First innings live' : 'Chase live';
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

  useEffect(() => {
    if (inningNo && innings.length > 0 && currentMatchId && !resultSubmitted) {
      saveLiveMatchState({
        currentMatchId, inningNo, innings, strikerId, nonStrikerId,
        bowlerId, lastOverBowlerId, battingCursor, pending,
        pendingBatterEnd, pitch, weather
      });
    } else if (resultSubmitted) {
      saveLiveMatchState(null);
    }
  }, [currentMatchId, inningNo, innings, strikerId, nonStrikerId, bowlerId, lastOverBowlerId, battingCursor, pending, pendingBatterEnd, pitch, weather, resultSubmitted, saveLiveMatchState]);

  const currentOverTotalRuns = useMemo(() => {
    return (inning?.deliveries || [])
      .filter((d) => d.over === currentOverIdx)
      .reduce((sum, d) => sum + d.runs, 0);
  }, [inning?.deliveries, currentOverIdx]);

  const currentOverWickets = useMemo(() => {
    return (inning?.deliveries || [])
      .filter((d) => d.over === currentOverIdx && d.isWicket).length;
  }, [inning?.deliveries, currentOverIdx]);

  const targetScore = inningNo === 2 ? (innings[0]?.runs || 0) + 1 : 0;
  const runsNeeded = targetScore ? Math.max(0, targetScore - (inning?.runs || 0)) : 0;
  const ballsRemaining = Math.max(0, maxBalls - (inning?.balls || 0));
  const requiredRunRate = ballsRemaining > 0 && runsNeeded > 0 ? ((runsNeeded / ballsRemaining) * 6).toFixed(2) : '0.00';

  const winProbability = useMemo(() => {
    if (inningNo === 1) {
      const par = selectedFormat === 'ODI' ? 275 : selectedFormat === 'TEST' ? 320 : 168;
      const proj = inning?.balls ? Math.round((inning.runs / inning.balls) * (maxBalls || 120)) : par;
      const diff = proj - par;
      const batProb = Math.max(15, Math.min(85, Math.round(50 + diff * 0.4 - (inning?.wickets || 0) * 3.5)));
      return { batting: batProb, bowling: 100 - batProb };
    } else {
      if (runsNeeded === 0) return { batting: 100, bowling: 0 };
      if ((inning?.wickets || 0) >= 10 || ballsRemaining <= 0) return { batting: 0, bowling: 100 };
      const rrr = Number(requiredRunRate);
      const base = 50 + (8.5 - rrr) * 6 - (inning?.wickets || 0) * 4.5;
      const clamped = Math.max(5, Math.min(95, Math.round(base)));
      return { batting: clamped, bowling: 100 - clamped };
    }
  }, [inningNo, runsNeeded, ballsRemaining, requiredRunRate, inning?.balls, inning?.runs, inning?.wickets, maxBalls, selectedFormat]);

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
    if (inning?.isComplete && inningNo === 2) {
      saveLiveMatchState(null);
    } else {
      saveLiveMatchState({
        currentMatchId,
        inningNo,
        innings,
        strikerId,
        nonStrikerId,
        bowlerId,
        lastOverBowlerId,
        battingCursor,
        pending,
        pendingBatterEnd,
        pitch,
        weather,
      });
    }
    setGameState(GameState.ARENA_HUB);
  };

  return (
    <div className="relative min-h-screen bg-[#f4f6f9] text-slate-800 font-sans pb-16 selection:bg-blue-100 selection:text-blue-900">
      {/* ═══════════════════════════════════════════════════════════════════════
          1. TOP NAVIGATION: CLEAN CREX-INSPIRED HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
          {/* Left: Brand Logo & Main Nav Links */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={handleReturnToHub}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
              title="Return to Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black shadow-sm">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">CRICKET ARENA</span>
                <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded tracking-widest uppercase">CREX</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-600">
              <button onClick={handleReturnToHub} className="hover:text-blue-600 transition-colors">Home</button>
              <button onClick={handleReturnToHub} className="hover:text-blue-600 transition-colors">Series</button>
              <button onClick={handleReturnToHub} className="hover:text-blue-600 transition-colors">Teams</button>
              <button onClick={handleReturnToHub} className="hover:text-blue-600 transition-colors">Fixtures</button>
              <button onClick={() => setActiveTab('Stats')} className="hover:text-blue-600 transition-colors">Stats</button>
              <button onClick={() => setActiveTab('Stats')} className="hover:text-blue-600 transition-colors">Rankings</button>
            </nav>
          </div>

          {/* Right: Search, Notification & User Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden sm:flex items-center bg-slate-100 border border-slate-200/90 rounded-full px-3 py-1.5 w-44 md:w-56 text-xs text-slate-700">
              <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search teams, players..."
                className="bg-transparent border-none outline-none w-full placeholder-slate-400 text-xs"
              />
            </div>

            <button className="p-1.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors">
              <Bell className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold text-slate-800">
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                {myTeamId ? franchises.find(f => f.id === myTeamId)?.shortName.substring(0, 1) || 'U' : 'U'}
              </div>
              <span className="hidden md:inline font-bold text-slate-700">
                {myTeamId ? franchises.find(f => f.id === myTeamId)?.shortName || 'Manager' : 'User'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. CONCISE MATCH SUMMARY HEADER (ZERO SCORE DUPLICATION)
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-200/90 shadow-sm px-3 sm:px-6 py-3">
        <div className="mx-auto max-w-7xl">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">
                {currentMatch?.playoffType
                  ? `${currentMatch.playoffType} · ${team1.shortName} vs ${team2.shortName}`
                  : currentMatch
                    ? `Match ${currentMatch.matchNumber} · ${team1.shortName} vs ${team2.shortName}`
                    : `${team1.shortName} vs ${team2.shortName}`}
              </span>
              <span>·</span>
              <span className="font-semibold text-blue-600">{selectedFormat || 'T20'} Match</span>
              <span>·</span>
              <span className="text-slate-500">{currentMatch?.venue || 'Wankhede Stadium, Mumbai'}</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                Pitch: <strong className="text-slate-700 capitalize">{pitch}</strong> · Weather: <strong className="text-slate-700 capitalize">{weather}</strong>
              </span>

              {/* Status pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-black tracking-wide uppercase">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600" />
                </span>
                <span>{inning?.isComplete && inningNo === 2 ? 'Official Result' : 'LIVE'}</span>
              </div>
            </div>
          </div>

          {/* Main Authoritative Score & Control Row */}
          <div className="pt-3 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
            {/* Team 1 vs Team 2 + Scoreboard */}
            <div className="flex items-center gap-4 sm:gap-6 flex-wrap sm:flex-nowrap">
              {/* Batting Team */}
              <div className="flex items-center gap-2.5">
                <img
                  src={resolveTeamLogo(battingTeam)}
                  alt={battingTeam.shortName}
                  className="h-9 w-9 object-contain drop-shadow-sm"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base sm:text-lg font-black text-slate-900">{battingTeam.name}</span>
                    {battingTeam.id === myTeamId && (
                      <span className="bg-blue-100 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded">YOU</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                    <span>CRR: <span className="font-bold text-slate-800">{currentRunRate}</span></span>
                    <span className="text-slate-300">|</span>
                    <span className="font-bold text-slate-700">{inningNo === 1 ? '1st' : '2nd'} Innings</span>
                  </div>
                </div>
              </div>

              {/* Authoritative Live Score */}
              <div className="px-4 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-center min-w-[140px]">
                <div className="text-2xl sm:text-3xl font-black text-slate-950 tabular-nums tracking-tight">
                  {inning?.runs || 0}<span className="text-slate-400">/</span>{inning?.wickets || 0}
                  <span className="text-xs sm:text-sm font-bold text-slate-500 ml-1.5">
                    ({formatOvers(inning?.balls || 0)} ov)
                  </span>
                </div>
                {inningNo === 2 && innings[0] && (
                  <div className="text-[10px] font-bold text-amber-700 tracking-tight">
                    Need {runsNeeded} from {ballsRemaining}b · RRR: {requiredRunRate}
                  </div>
                )}
              </div>

              {/* Bowling Team */}
              <div className="flex items-center gap-2.5">
                <img
                  src={resolveTeamLogo(bowlingTeam)}
                  alt={bowlingTeam.shortName}
                  className="h-9 w-9 object-contain opacity-90 drop-shadow-sm"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm sm:text-base font-bold text-slate-700">{bowlingTeam.name}</span>
                    {bowlingTeam.id === myTeamId && (
                      <span className="bg-purple-100 text-purple-700 border border-purple-200 text-[9px] font-black px-1.5 py-0.5 rounded">YOU</span>
                    )}
                  </div>
                  {inningNo === 2 && innings[0] && (
                    <div className="text-xs text-slate-500 font-semibold">
                      1st Inn: {innings[0].runs}/{innings[0].wickets}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Playback Controls (bowling & fielding are AI-controlled, so no manual tactical mode) */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[9px] font-black uppercase text-slate-500">
                {controlSummary}
              </span>

              {/* Play / Pause Toggle */}
              <button
                onClick={() => {
                  setAutoPlay(v => !v);
                  setIsPlaybackPaused(v => !v);
                }}
                className={cn(
                  "p-1.5 rounded-lg border text-xs transition-colors",
                  autoPlay && !isPlaybackPaused
                    ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                    : "bg-amber-500 text-white border-amber-600"
                )}
                title={autoPlay ? "Pause Auto-play" : "Resume Auto-play"}
              >
                {autoPlay && !isPlaybackPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              {/* Speed Selectors (1x, 1.5x, 2x) */}
              <div className="hidden sm:flex items-center bg-white p-0.5 rounded-lg border border-slate-200">
                {([1, 1.5, 2] as AnimationSpeed[]).map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setPlaybackSpeed(spd)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-black transition-all",
                      playbackSpeed === spd
                        ? "bg-slate-900 text-white"
                        : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Replay */}
              <button
                onClick={() => setReplayTrigger(n => n + 1)}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                title="Replay Delivery"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Bowl / Next Ball Button */}
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
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                  isBallAnimating
                    ? "bg-slate-800 text-white border-slate-900 hover:bg-slate-700"
                    : canPlayManualBall && !autoPlay
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm hover:bg-blue-700"
                      : "opacity-40 bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                )}
                title="Simulate next delivery"
              >
                {isBallAnimating ? 'Skip' : 'Next Ball'}
              </button>

              {/* Play Over Button */}
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
                  "px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                  !autoPlay && canPlayManualBall
                    ? "bg-indigo-600 text-white border-indigo-700 shadow-sm hover:bg-indigo-700"
                    : "opacity-40 bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                )}
                title="Simulate remainder of current over"
              >
                Play Over
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          3. HORIZONTAL MATCH TABS BAR
      ═══════════════════════════════════════════════════════════════════════ */}
      <nav className="bg-white border-b border-slate-200 shadow-xs px-3 sm:px-6 sticky top-[57px] z-30">
        <div className="mx-auto max-w-7xl flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
          {(['Live', 'Scorecard', 'Commentary', 'Tactics', 'Stats'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-3 px-4 text-xs sm:text-sm font-bold tracking-wide uppercase transition-all border-b-2 whitespace-nowrap",
                activeTab === tab
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              )}
            >
              {tab === 'Live' ? '🔴 Live Match' : tab}
            </button>
          ))}
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════
          4. MAIN CONTENT AREA
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-4">
        {/* ─────────────────────────────────────────────────────────────────
            TAB 1: LIVE — 2D FIELD (~2/3) + ACTION SIDEBAR (~1/3) + BOTTOM STRIP
        ───────────────────────────────────────────────────────────────── */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-12 gap-4 items-start', activeTab !== 'Live' && 'hidden')}>
          {/* ── LEFT COLUMN: 2D FIELD VISUALIZATION (~2/3) ── */}
          <div className="lg:col-span-8 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Live 2D Field</span>
                  <span className="text-[10px] text-slate-400 font-semibold">(Interactive)</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">Toggle “Edit Field” on the map to drag fielders</span>
              </div>

              <div className="p-1 bg-[#060913] rounded-b-2xl overflow-hidden">
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
                  target={inningNo === 2 ? (innings[0]?.runs || 0) + 1 : undefined}
                  pitch={pitch}
                  weather={weather}
                  fieldingSquad={bowlingSquad}
                  partnershipRuns={inning?.partnershipRuns}
                  partnershipBalls={inning?.partnershipBalls}
                  onFieldChangingChange={setIsFieldChanging}
                  onBallLifecycleChange={handleBallLifecycleChange}
                  userTeamControlMode="FULL_AUTO"
                  aiCaptainRecommendation={null}
                  manualControlsEnabled={false}
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
                  onFieldPresetChange={setFieldPresetKey}
                />
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: BATTERS, BOWLER & NEXT ACTION (~1/3) ── */}
          <div className="lg:col-span-4 space-y-3">
            {/* Pending Selection Prompt (user-owned batting decisions only) */}
            {pending && (userCanSelectOpeners || userCanSelectIncomingBatter) && (
              <button
                onClick={() => {
                  if (pending === 'openers') setManualDrawerOpen('OPENERS');
                  else if (pending === 'batter') setManualDrawerOpen('BATTER');
                }}
                className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase shadow-sm flex items-center justify-center gap-2 animate-pulse"
              >
                <Sparkles className="w-4 h-4" />
                <span>{pending === 'openers' ? 'Select Opening Batters' : 'Wicket! Select Next Batter'}</span>
              </button>
            )}

            {/* Current Batters Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">Current Batters</span>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="pb-1 text-left font-bold">Batter</th>
                      <th className="pb-1 text-center font-bold">R</th>
                      <th className="pb-1 text-center font-bold">B</th>
                      <th className="pb-1 text-center font-bold">4s</th>
                      <th className="pb-1 text-center font-bold">6s</th>
                      <th className="pb-1 text-right font-bold">SR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { player: striker, line: strikerLine, isStriker: true },
                      { player: nonStriker, line: nonStrikerLine, isStriker: false }
                    ].map(({ player, line, isStriker }) => (
                      <tr key={player?.id || (isStriker ? 's' : 'ns')} className={isStriker ? "bg-blue-50/40" : ""}>
                        <td className="py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate max-w-[90px]">{player?.name || '--'}</span>
                            {isStriker && <span className="text-blue-600 font-black text-xs">*</span>}
                          </div>
                        </td>
                        <td className="py-2 text-center font-black text-slate-900 tabular-nums">{line.runs}</td>
                        <td className="py-2 text-center text-slate-500 tabular-nums">{line.balls}</td>
                        <td className="py-2 text-center text-slate-600 tabular-nums">{line.fours}</td>
                        <td className="py-2 text-center text-purple-600 font-bold tabular-nums">{line.sixes}</td>
                        <td className="py-2 text-right font-bold text-slate-700 tabular-nums">{strikeRate(line.runs, line.balls)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Current Bowler Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Current Bowler</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">AI Selected</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xs font-black">
                  {playerInitials(currentBowler?.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-900 truncate">{currentBowler?.name || 'Bowler'}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {currentBowler?.bowlingStyle || currentBowler?.role || 'Fast'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-center">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">O</span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">{formatOvers(bowlerLine.balls)}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">R</span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">{bowlerLine.runs}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">W</span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">{bowlerLine.wickets}</span>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Eco</span>
                  <span className="text-xs font-black text-slate-900 tabular-nums">{economy(bowlerLine.runs, bowlerLine.balls)}</span>
                </div>
              </div>
            </div>

            {/* Next Action Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-blue-600" /> Next Action
                </span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                  {autoPlay && !isPlaybackPaused ? 'Auto Play' : userCanSetBattingIntent ? 'Your Batting' : 'AI Controlled'}
                </span>
              </div>

              <div className="rounded-xl bg-blue-50/70 border border-blue-100 px-3 py-2">
                <span className="text-[9px] font-black uppercase text-blue-500 block">
                  {isMyTeamBatting ? 'Your Batting Shot' : 'AI Bowl Plan'}
                </span>
                <span className="text-xs font-black text-slate-900">{nextActionLabel}</span>
              </div>

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
                  "w-full py-2.5 rounded-xl text-xs font-black uppercase transition-all border",
                  isBallAnimating
                    ? "bg-slate-800 text-white border-slate-900 hover:bg-slate-700"
                    : canPlayManualBall && !autoPlay
                      ? "bg-blue-600 text-white border-blue-700 shadow-sm hover:bg-blue-700"
                      : "opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                )}
              >
                {isBallAnimating ? 'Skip Delivery' : 'Bowl Next Ball →'}
              </button>

              {/* Compact tactical menus */}
              <div className="space-y-1.5">
                {userCanSetBattingIntent ? (
                  <TacticalMenu
                    label="Your Batting Intent"
                    hint={userBattingIntent.replace(/_/g, ' ')}
                    open={openTacticalMenu === 'BATTING'}
                    onToggle={() => setOpenTacticalMenu(openTacticalMenu === 'BATTING' ? null : 'BATTING')}
                  >
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['SURVIVAL', 'DEFENSIVE', 'SETTLING', 'ROTATE_STRIKE', 'NORMAL', 'CONTROLLED_ATTACK', 'ACCELERATE'] as const).map((intent) => (
                        <button
                          key={intent}
                          onClick={() => setUserBattingIntent(intent)}
                          className={cn(
                            "py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase transition-all border text-left truncate",
                            userBattingIntent === intent
                              ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {intent === 'ROTATE_STRIKE' ? 'Rotate' : intent === 'CONTROLLED_ATTACK' ? 'Attack' : intent}
                        </button>
                      ))}
                    </div>
                  </TacticalMenu>
                ) : (
                  <div className="rounded-xl bg-purple-50/70 border border-purple-100 px-3 py-2 space-y-0.5">
                    <span className="text-[9px] font-black uppercase text-purple-500 block">AI Bowling Plan</span>
                    <span className="text-xs font-black text-slate-900">
                      {(userBowlingPlan?.intent || 'WICKET_TAKING').replace(/_/g, ' ')}
                    </span>
                    <span className="text-[9px] text-slate-500 block">
                      The bowling captain picks the bowler, plan and field automatically.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── BOTTOM STRIP: LAST 6 BALLS + RECENT COMMENTARY ── */}
          <div className="lg:col-span-12 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Last 6 Balls</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const filledFrom = 6 - last6.length;
                  const outcome = i >= filledFrom ? last6[i - filledFrom] : '';
                  return (
                    <button
                      key={i}
                      disabled={!outcome}
                      onClick={() => {
                        const md = historyDeliveryResults[5 - i];
                        if (md) {
                          setReplayDelivery(md);
                          setReplayTrigger(n => n + 1);
                        }
                      }}
                      title={outcome ? `Ball: ${outcome} — click to replay` : ''}
                      className={cn(
                        'h-7 w-7 rounded-full grid place-items-center text-[10px] font-black shrink-0 transition-transform',
                        outcome ? 'hover:scale-110 cursor-pointer' : 'cursor-default',
                        ballChipClass(outcome)
                      )}
                    >
                      {outcome || ''}
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] font-bold text-slate-400 tabular-nums">{formatOvers(inning?.balls || 0)} ov</span>
              <div className="hidden sm:block w-px self-stretch bg-slate-100" />
              <div
                className="flex items-center gap-2"
                title={
                  fieldStatus.phase.restricted
                    ? fieldStatus.legal
                      ? `${fieldStatus.phase.label}. Maximum ${fieldStatus.phase.maxOutsideCircle} fielders outside the circle.`
                      : `Illegal field: ${fieldStatus.outside} outside, maximum ${fieldStatus.phase.maxOutsideCircle}. Move ${fieldStatus.outside - fieldStatus.phase.maxOutsideCircle} fielder(s) inside.`
                    : `${fieldStatus.phase.label}. No powerplay fielding restriction.`
                }
              >
                <span
                  className={cn(
                    'text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap',
                    fieldStatus.legal
                      ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  )}
                >
                  {fieldStatusLabel}
                </span>
                <span
                  className={cn(
                    'text-[9px] font-bold px-2 py-1 rounded-full border flex items-center gap-1 whitespace-nowrap',
                    isRetrieving ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', isRetrieving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')} />
                  {retrievalStatus}
                </span>
              </div>
            </div>

            <div className="hidden lg:block w-px self-stretch bg-slate-100" />

            <div className="flex-1 min-w-0 space-y-1">
              {recentCommentaryLines.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic">Commentary will appear here...</span>
              ) : (
                recentCommentaryLines.map((line, i) => (
                  <button
                    key={`${line.ball}-${i}`}
                    onClick={() => handleReplayBall(line)}
                    className="w-full text-left flex items-start gap-2 group"
                    title="Click to replay on the field map"
                  >
                    <span className={cn('mt-0.5 h-5 w-5 shrink-0 grid place-items-center rounded-full text-[9px] font-black', ballChipClass(line.outcome))}>
                      {line.outcome}
                    </span>
                    <span className="text-[11px] text-slate-700 leading-snug truncate group-hover:text-blue-700 transition-colors">
                      {line.text}
                    </span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setActiveTab('Commentary')}
              className="shrink-0 text-xs font-black text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View Full Commentary <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            TAB 2: FULL SCORECARD (BOTH INNINGS)
        ───────────────────────────────────────────────────────────────── */}
          <div className={cn('space-y-6', activeTab !== 'Scorecard' && 'hidden')}>
            {[0, 1].map((idx) => {
              const score = innings[idx];
              const batTeam = franchises.find((f) => f.id === score?.battingTeamId) || (idx === 0 ? battingTeam : bowlingTeam);
              const bowlTeam = franchises.find((f) => f.id === score?.bowlingTeamId) || (idx === 0 ? bowlingTeam : battingTeam);
              const batSquad = score ? getTeamSquad(score.battingTeamId) : [];
              const usedBowlers = score ? getTeamSquad(score.bowlingTeamId).filter((player) => (score.bowlers[player.id]?.balls || 0) > 0) : [];

              return (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                  {/* Innings Header */}
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <img src={resolveTeamLogo(batTeam)} alt={batTeam.shortName} className="h-6 w-6 object-contain" />
                      <span className="text-sm font-black text-slate-900">{batTeam.name} Innings</span>
                    </div>
                    <div className="text-sm font-black text-slate-900 tabular-nums">
                      {score?.balls ? `${score.runs}/${score.wickets} (${formatOvers(score.balls)} ov)` : 'Yet to Bat'}
                    </div>
                  </div>

                  {score && score.balls > 0 ? (
                    <div className="p-4 space-y-5">
                      {/* Batting Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                              <th className="py-2 pl-3 text-left">Batter</th>
                              <th className="py-2 text-left">Dismissal</th>
                              <th className="py-2 w-10 text-center font-bold">R</th>
                              <th className="py-2 w-10 text-center font-bold">B</th>
                              <th className="py-2 w-10 text-center font-bold">4s</th>
                              <th className="py-2 w-10 text-center font-bold">6s</th>
                              <th className="py-2 pr-3 w-14 text-right font-bold">SR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {batSquad.map((player) => {
                              const line = score.batters[player.id];
                              if (!line && !score.wicketLog.some(w => w.playerId === player.id)) return null;
                              return (
                                <tr key={player.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 pl-3 font-bold text-slate-900">{player.name}</td>
                                  <td className="py-2.5 text-slate-500 text-[11px]">{line?.status || 'not out'}</td>
                                  <td className="py-2.5 text-center font-black text-slate-950 tabular-nums">{line?.runs || 0}</td>
                                  <td className="py-2.5 text-center text-slate-500 tabular-nums">{line?.balls || 0}</td>
                                  <td className="py-2.5 text-center text-slate-700 tabular-nums">{line?.fours || 0}</td>
                                  <td className="py-2.5 text-center text-purple-700 font-bold tabular-nums">{line?.sixes || 0}</td>
                                  <td className="py-2.5 pr-3 text-right font-bold text-slate-700 tabular-nums">{strikeRate(line?.runs || 0, line?.balls || 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Extras & Total */}
                      <div className="flex flex-wrap items-center justify-between text-xs py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-600">
                          Extras: <strong>{(score.extras.wides || 0) + (score.extras.noBalls || 0) + (score.extras.byes || 0) + (score.extras.legByes || 0)}</strong>
                          <span className="text-slate-400 ml-1.5">(wd {score.extras.wides}, nb {score.extras.noBalls}, b {score.extras.byes}, lb {score.extras.legByes})</span>
                        </span>
                        <span className="font-bold text-slate-800">
                          Total: <strong className="text-slate-950 font-black">{score.runs}/{score.wickets}</strong> ({formatOvers(score.balls)} ov, RR: {formatOvers(score.balls) !== '0.0' ? (score.runs / (score.balls / 6)).toFixed(2) : '0.00'})
                        </span>
                      </div>

                      {/* Bowling Table */}
                      <div className="overflow-x-auto pt-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                              <th className="py-2 pl-3 text-left">Bowler</th>
                              <th className="py-2 w-12 text-center font-bold">O</th>
                              <th className="py-2 w-12 text-center font-bold">M</th>
                              <th className="py-2 w-12 text-center font-bold">R</th>
                              <th className="py-2 w-12 text-center font-bold">W</th>
                              <th className="py-2 pr-3 w-16 text-right font-bold">ECO</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {usedBowlers.map((player) => {
                              const line = score.bowlers[player.id];
                              if (!line) return null;
                              return (
                                <tr key={player.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 pl-3 font-bold text-slate-900">{player.name}</td>
                                  <td className="py-2.5 text-center text-slate-600 tabular-nums">{formatOvers(line.balls)}</td>
                                  <td className="py-2.5 text-center text-slate-500 tabular-nums">{bowlerMaidens(score, player.id)}</td>
                                  <td className="py-2.5 text-center font-bold text-slate-800 tabular-nums">{line.runs}</td>
                                  <td className="py-2.5 text-center font-black text-red-600 tabular-nums">{line.wickets}</td>
                                  <td className="py-2.5 pr-3 text-right font-bold text-slate-700 tabular-nums">{economy(line.runs, line.balls)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Innings not started yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        {/* ─────────────────────────────────────────────────────────────────
            TAB 3: COMPREHENSIVE COMMENTARY (FULL BALL-BY-BALL)
        ───────────────────────────────────────────────────────────────── */}
          <div className={cn('bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4', activeTab !== 'Commentary' && 'hidden')}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">Ball-by-Ball Match Feed</h3>
                <p className="text-xs text-slate-500">Live timeline from ball 1</p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1.5">
                {(['ALL', 'HIGHLIGHTS', 'WICKETS', 'BOUNDARIES', 'OVERS'] as const).map((flt) => (
                  <button
                    key={flt}
                    onClick={() => setCommentaryFilter(flt)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all",
                      commentaryFilter === flt
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {flt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredCommentary.map((item, idx) => (
                <div
                  key={`${item.ball}-${idx}`}
                  onClick={() => handleReplayBall(item)}
                  className="p-3 rounded-xl border border-slate-200/80 hover:bg-slate-50 transition-colors flex items-start gap-3 cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-xs font-bold text-slate-400 tabular-nums">{item.ball}</span>
                    <span className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-black",
                      item.outcome === 'W'
                        ? "bg-red-600 text-white"
                        : item.outcome === '6'
                        ? "bg-purple-600 text-white"
                        : item.outcome === '4'
                        ? "bg-blue-600 text-white"
                        : item.outcome === '0'
                        ? "bg-slate-100 text-slate-500 border border-slate-200"
                        : "bg-emerald-100 text-emerald-800"
                    )}>
                      {item.outcome}
                    </span>
                  </div>

                  <div className="flex-1">
                    <p className="text-xs text-slate-800 leading-relaxed font-medium">{item.text}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">{item.badge}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* ─────────────────────────────────────────────────────────────────
            TAB 4: TACTICS — BATTING INTENT / BOWLING PLAN / FIELD SETUP
        ───────────────────────────────────────────────────────────────── */}
        <div className={cn('space-y-4', activeTab !== 'Tactics' && 'hidden')}>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase flex items-center gap-1.5">
                <Target className="w-4 h-4 text-blue-600" /> Tactical Command Centre
              </h3>
              <p className="text-xs text-slate-500">Set your team’s approach for the next phase of the match.</p>
            </div>
            <span className="shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
              {isMyTeamBatting ? 'Batting Side' : isMyTeamBowling ? 'Bowling Side' : 'Opponent'}
            </span>
          </div>

          {pending && (userCanSelectOpeners || userCanSelectIncomingBatter) && (
            <button
              onClick={() => {
                if (pending === 'openers') setManualDrawerOpen('OPENERS');
                else if (pending === 'batter') setManualDrawerOpen('BATTER');
              }}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase shadow-sm flex items-center justify-center gap-2 animate-pulse"
            >
              <Sparkles className="w-4 h-4" />
              <span>{pending === 'openers' ? 'Select Opening Batters' : 'Wicket! Select Next Batter'}</span>
            </button>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Batting Intent — owned by the user only while their team is batting */}
            {userCanSetBattingIntent ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Your Batting Intent</span>
                  <span className="text-[10px] font-black text-blue-600">{userBattingIntent.replace(/_/g, ' ')}</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['SURVIVAL', 'DEFENSIVE', 'SETTLING', 'ROTATE_STRIKE', 'NORMAL', 'CONTROLLED_ATTACK', 'ACCELERATE'] as const).map((intent) => (
                    <button
                      key={intent}
                      onClick={() => setUserBattingIntent(intent)}
                      className={cn(
                        "py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase transition-all border text-left truncate",
                        userBattingIntent === intent
                          ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {intent === 'ROTATE_STRIKE' ? 'Rotate' : intent === 'CONTROLLED_ATTACK' ? 'Attack' : intent}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                  <span className="font-black uppercase text-slate-400 block text-[9px]">Next Action</span>
                  {BATTING_INTENT_SHOT[userBattingIntent] || 'Balanced Stroke'}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Batting Intent</span>
                <p className="text-[11px] text-slate-500 leading-snug">
                  AI-controlled. {isMyTeamBatting ? 'Waiting for your innings.' : 'The opponent is setting its own approach.'}
                </p>
              </div>
            )}

            {/* Bowling Plan — always chosen by the bowling captain AI */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">AI Bowling Plan</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">AI</span>
              </div>
              <div className="rounded-xl bg-purple-50/70 border border-purple-100 px-3 py-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-purple-500 block">Current Plan</span>
                <span className="text-sm font-black text-slate-900">{(userBowlingPlan?.intent || 'WICKET_TAKING').replace(/_/g, ' ')}</span>
              </div>
              <div className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-2">
                <span className="font-black uppercase text-slate-400 block text-[9px]">Next Ball</span>
                {BOWLING_INTENT_ACTION[userBowlingPlan?.intent || 'WICKET_TAKING'] || 'Attack the Stumps'}
              </div>
            </div>

            {/* Field Setup — always AI-selected and restriction-validated */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">AI Field Setup</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 border border-cyan-200">AI</span>
              </div>
              <div className="rounded-xl bg-cyan-50/70 border border-cyan-100 px-3 py-2 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-cyan-500 block">Active Formation</span>
                <span className="text-sm font-black text-slate-900">
                  {fieldPresetKey ? (BowlerFieldStrategyEngine.PRESET_OVERLAYS[fieldPresetKey]?.name.split('(')[0].trim() || 'Preset') : 'Balanced Ring'}
                </span>
              </div>
              <p className="text-[9px] text-slate-400 leading-snug">
                The bowling captain sets the field automatically and every formation is validated against the format's fielding restrictions.
              </p>
            </div>
          </div>
        </div>
        {/* ─────────────────────────────────────────────────────────────────
            TAB 5: STATS — MATCH ANALYTICS + LEAGUE STANDINGS
        ───────────────────────────────────────────────────────────────── */}
        <div className={cn('space-y-4', activeTab !== 'Stats' && 'hidden')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Win Probability */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-2.5">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                Win Probability
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-blue-700">{battingTeam.shortName} {winProbability.batting}%</span>
                  <span className="text-purple-700">{bowlingTeam.shortName} {winProbability.bowling}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${winProbability.batting}%` }} />
                  <div className="bg-purple-600 h-full transition-all duration-500" style={{ width: `${winProbability.bowling}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 block text-center font-medium">Live win probability metric</span>
              </div>
            </div>

            {/* Projected Total */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-2.5">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Projected Total
              </span>
              <div className="text-2xl font-black text-slate-950 tabular-nums">~{projectedScore}</div>
              <span className="text-[10px] text-slate-400 font-medium">
                Projected at current rate ({currentRunRate} rpo) for {formatOvers(maxBalls || 120)} overs
              </span>
            </div>

            {/* Match Situation */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-2.5">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Match Situation
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">CRR</span>
                  <span className="font-black text-slate-900 tabular-nums">{currentRunRate}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{inningNo === 2 ? 'RRR' : 'Projected'}</span>
                  <span className="font-black text-slate-900 tabular-nums">{inningNo === 2 ? requiredRunRate : `~${projectedScore}`}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Balls Left</span>
                  <span className="font-black text-slate-900 tabular-nums">{ballsRemaining}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">{inningNo === 2 ? 'Runs Needed' : 'Partnership'}</span>
                  <span className="font-black text-slate-900 tabular-nums">{inningNo === 2 ? runsNeeded : `${inning?.partnershipRuns || 0} (${inning?.partnershipBalls || 0}b)`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* League Standings */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase">League Standings</h3>
                <p className="text-xs text-slate-500">Official tournament leaderboard</p>
              </div>
              <span className="text-xs font-bold text-blue-600">Season 2026</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 pl-4 text-left w-12">Pos</th>
                    <th className="py-2.5 text-left">Team</th>
                    <th className="py-2.5 w-12 text-center font-bold">P</th>
                    <th className="py-2.5 w-12 text-center font-bold">W</th>
                    <th className="py-2.5 w-12 text-center font-bold">L</th>
                    <th className="py-2.5 w-12 text-center font-bold">T</th>
                    <th className="py-2.5 w-16 text-center font-bold">NRR</th>
                    <th className="py-2.5 pr-4 w-16 text-right font-bold">PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedStandings.map((standing, index) => {
                    const team = franchises.find((f) => f.id === standing.teamId);
                    const isMy = team?.id === myTeamId;
                    return (
                      <tr
                        key={standing.teamId}
                        className={cn(
                          "transition-colors",
                          isMy ? "bg-blue-50/70 font-bold border-l-4 border-l-blue-600" : "hover:bg-slate-50/50"
                        )}
                      >
                        <td className="py-3 pl-4 text-slate-400 font-bold">{index + 1}</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <img src={resolveTeamLogo(team)} alt={team?.shortName} className="h-6 w-6 object-contain" />
                            <span className="font-bold text-slate-900">{team?.name}</span>
                            {isMy && (
                              <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded">YOU</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 text-center text-slate-600 tabular-nums">{standing.played}</td>
                        <td className="py-3 text-center text-emerald-600 font-bold tabular-nums">{standing.won}</td>
                        <td className="py-3 text-center text-red-600 font-bold tabular-nums">{standing.lost}</td>
                        <td className="py-3 text-center text-slate-500 tabular-nums">{standing.tied}</td>
                        <td className="py-3 text-center text-slate-700 font-medium tabular-nums">{standing.nrr.toFixed(3)}</td>
                        <td className="py-3 pr-4 text-right font-black text-slate-950 text-sm tabular-nums">{standing.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </main>

      {/* ═══════════════════════════════════════════════════════════════════════
          5. IMPACT PLAYER SUBSTITUTION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showImpactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-900">Impact Player Tactical Substitution</h3>
            <p className="text-xs text-slate-500">Swap one active player for a substitute bench player.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Outgoing Active Player</label>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {selectedXiPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setImpactOutgoingId(p.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs border transition-colors",
                        impactOutgoingId === p.id ? "bg-blue-50 border-blue-500 font-bold" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-slate-900">{p.name}</span>
                      <span className="text-[10px] text-slate-400">{p.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Incoming Bench Player</label>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {franchises.find(f => f.id === myTeamId)?.squad.filter(id => !selectedSquadIds.includes(id)).map(id => players.find(p => p.id === id)).filter(Boolean).map(p => (
                    <button
                      key={p!.id}
                      onClick={() => setImpactIncomingId(p!.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-left text-xs border transition-colors",
                        impactIncomingId === p!.id ? "bg-blue-50 border-blue-500 font-bold" : "border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-slate-900">{p!.name}</span>
                      <span className="text-[10px] text-slate-400">{p!.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowImpactModal(false)}
                className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={!impactIncomingId || !impactOutgoingId}
                onClick={handleImpactSubstitution}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Confirm Sub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          6. MATCH COMPLETE CELEBRATION MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {resultSubmitted && currentMatchId && innings[0] && innings[1] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 shadow-2xl text-center space-y-5"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">Match Completed</h2>
              {(() => {
                const i1 = innings[0];
                const i2 = innings[1];
                const winnerId = i2.runs > i1.runs ? i2.battingTeamId : i1.battingTeamId;
                const winner = franchises.find(f => f.id === winnerId);
                const margin = i2.runs > i1.runs 
                  ? `${10 - i2.wickets} wickets` 
                  : i2.runs === i1.runs ? 'Tie' : `${i1.runs - i2.runs} runs`;

                return (
                  <p className="text-base font-bold text-slate-600 mt-1">
                    {i2.runs === i1.runs ? "Match Tied" : <strong className="text-emerald-600">{winner?.name} won by {margin}</strong>}
                  </p>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block">{team1.shortName}</span>
                <span className="text-xl font-black text-slate-900">{innings[0]?.runs}/{innings[0]?.wickets}</span>
                <span className="text-[10px] text-slate-400 block">{formatOvers(innings[0]?.balls || 0)} ov</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-500 block">{team2.shortName}</span>
                <span className="text-xl font-black text-slate-900">{innings[1]?.runs}/{innings[1]?.wickets}</span>
                <span className="text-[10px] text-slate-400 block">{formatOvers(innings[1]?.balls || 0)} ov</span>
              </div>
            </div>

            <button
              onClick={() => setGameState(GameState.ARENA_HUB)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md"
            >
              Return to Tournament Hub
            </button>
          </motion.div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          7. MANUAL PLAYER SELECTION DRAWER / MODAL
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
