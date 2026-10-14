import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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

type Tab = 'Live' | 'Scorecard' | 'Commentary' | 'Points Table' | 'News';

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
  const { currentMatchId, fixtures, franchises, players, selectedFranchiseId, selectedSquadIds, playingXIIds, setSelectedSquadIds, setPlayingXIIds, currentMatchToss, standings, setGameState, updateMatchResult, liveMatchState, saveLiveMatchState, selectedFormat } = useGameStore();
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
  const [historyDeliveryResults, setHistoryDeliveryResults] = useState<DeliveryResult[]>([]);

  useEffect(() => {
    if (currentDeliveryResult) {
      setHistoryDeliveryResults(prev => {
        if (prev.some(d => d.id === currentDeliveryResult.id)) return prev;
        return [currentDeliveryResult, ...prev].slice(0, 50);
      });
    }
  }, [currentDeliveryResult]);

  const handleConfirmOpeners = (sId: string, nsId: string) => {
    setStrikerId(sId);
    setNonStrikerId(nsId);
    setBattingCursor(2);
    setPending('bowler');
    setManualDrawerOpen(null);
  };

  const handleConfirmBatter = (bId: string) => {
    if (pendingBatterEnd === 'non-striker') {
      setNonStrikerId(bId);
    } else {
      setStrikerId(bId);
    }
    setPending(queueBowlerAfterBatter ? 'bowler' : null);
    setQueueBowlerAfterBatter(false);
    setManualDrawerOpen(null);
  };

  const handleConfirmBowler = (bwId: string) => {
    setBowlerId(bwId);
    setPending(null);
    setManualDrawerOpen(null);
    if (aiCaptainRecommendation) {
      setAiCaptainRecommendation(null);
    }
  };

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
      if (isMyTeamBatting && !autoPlay) return;
      setStrikerId(battingSquad[0]?.id || null);
      setNonStrikerId(battingSquad[1]?.id || null);
      setBattingCursor(2);
      setPending('bowler');
      return;
    }
    if (pending === 'batter') {
      if (isMyTeamBatting && !autoPlay) return;
      const next = getAvailableBatters(inning, battingSquad, strikerId, nonStrikerId)[0] || battingSquad[battingCursor];
      if (next) {
        if (pendingBatterEnd === 'non-striker') setNonStrikerId(next.id);
        else setStrikerId(next.id);
        setBattingCursor((value) => value + 1);
      }
      setPending(queueBowlerAfterBatter ? 'bowler' : null);
      setQueueBowlerAfterBatter(false);
      return;
    }
    if (pending === 'bowler') {
      const availBowlers = getAvailableBowlers(inning, bowlingSquad, lastOverBowlerId);
      const aiDecision = AICaptainEngine.decideCaptainAction({
        format: (selectedFormat as ArenaFormat) || 'T20',
        teamId: bowlingTeam.id,
        inningsState: {
          score: inning.runs,
          wickets: inning.wickets,
          balls: inning.balls,
          recentBalls: inning.recentBalls,
        },
        availableBowlers: availBowlers,
        previousOverBowlerId: lastOverBowlerId,
        striker: striker || null,
        nonStriker: nonStriker || null,
        pitchState: { pitchType: pitch },
        decisionTrigger: 'OVER_END',
      });

      if (isMyTeamBowling) {
        if (userTeamControlMode === 'FULL_AUTO' || autoPlay) {
          const chosenId = aiDecision.selectedBowlerId || chooseAiBowler(inning, bowlingSquad, lastOverBowlerId)?.id || null;
          setBowlerId(chosenId);
          if (aiDecision.bowlingPlan) {
            setUserBowlingPlan(aiDecision.bowlingPlan as DetailedBowlingPlan);
          }
          setPending(null);
        } else {
          // Manual or AI recommendations: provide recommendation for player to review
          setAiCaptainRecommendation(aiDecision);
          return;
        }
      } else {
        // Opponent is bowling: autonomous intelligent decision
        const chosenId = aiDecision.selectedBowlerId || chooseAiBowler(inning, bowlingSquad, lastOverBowlerId)?.id || null;
        setBowlerId(chosenId);
        setOpponentTacticalNotice(`${bowlingTeam.name} Captain: ${aiDecision.reasoning}`);
        setPending(null);
      }
    }
  }, [pending, inning, battingSquad, bowlingSquad, battingCursor, isMyTeamBatting, isMyTeamBowling, strikerId, nonStrikerId, getAvailableBatters, getAvailableBowlers, chooseAiBowler, queueBowlerAfterBatter, lastOverBowlerId, pendingBatterEnd, autoPlay, selectedFormat, bowlingTeam, pitch, userTeamControlMode, striker, nonStriker]);

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

    // Check tactical events: Wicket fall or boundary cluster
    if (wicket) {
      if (!isMyTeamBowling) {
        setOpponentTacticalNotice(`${bowlingTeam.name} Captain: Wicket! Attacking close-in catchers deployed for new batter.`);
      } else if (userTeamControlMode === 'AI_RECOMMENDATIONS') {
        const avail = getAvailableBowlers(inning, bowlingSquad, lastOverBowlerId);
        const rec = AICaptainEngine.decideCaptainAction({
          format: (selectedFormat as ArenaFormat) || 'T20',
          teamId: bowlingTeam.id,
          inningsState: {
            score: (inning?.runs || 0) + ballRuns,
            wickets: (inning?.wickets || 0) + 1,
            balls: (inning?.balls || 0) + (isLegalDelivery ? 1 : 0),
            recentBalls: [...(inning?.recentBalls || []), wicket ? 'W' : String(ballRuns)],
          },
          availableBowlers: avail,
          currentBowler,
          previousOverBowlerId: lastOverBowlerId,
          pitchState: { pitchType: pitch },
          decisionTrigger: 'WICKET_FALL',
        });
        setAiCaptainRecommendation(rec);
      }
    } else {
      const recent = [...(inning?.recentBalls || []), String(ballRuns)].slice(-6);
      const bCount = recent.filter((b) => b === '4' || b === '6').length;
      if (bCount >= 2) {
        if (!isMyTeamBowling) {
          setOpponentTacticalNotice(`${bowlingTeam.name} Captain: Boundary surge detected! Deep boundary protection deployed.`);
        } else if (userTeamControlMode === 'AI_RECOMMENDATIONS' && !aiCaptainRecommendation) {
          const avail = getAvailableBowlers(inning, bowlingSquad, lastOverBowlerId);
          const rec = AICaptainEngine.decideCaptainAction({
            format: (selectedFormat as ArenaFormat) || 'T20',
            teamId: bowlingTeam.id,
            inningsState: {
              score: (inning?.runs || 0) + ballRuns,
              wickets: (inning?.wickets || 0),
              balls: (inning?.balls || 0) + (isLegalDelivery ? 1 : 0),
              recentBalls: recent,
            },
            availableBowlers: avail,
            currentBowler,
            previousOverBowlerId: lastOverBowlerId,
            pitchState: { pitchType: pitch },
            decisionTrigger: 'BOUNDARY_CLUSTER',
          });
          setAiCaptainRecommendation(rec);
        }
      }
    }
  }, [currentDeliveryResult, inningNo, battingTeam.shortName, maxBalls, striker, currentMatchId, isMyTeamBowling, bowlingTeam.name, bowlingTeam.id, userTeamControlMode, inning, bowlingSquad, lastOverBowlerId, currentBowler, pitch, selectedFormat, aiCaptainRecommendation, getAvailableBowlers]);

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
    if (isBallAnimating || isFieldChanging) return;
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
      let effectiveBattingIntent: BattingIntent = 'NORMAL';
      if (isMyTeamBatting) {
        if (userTeamControlMode === 'FULL_AUTO') {
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
        } else {
          effectiveBattingIntent = userBattingIntent;
        }
      } else {
        // Opponent is batting: autonomous intelligent intent
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

      // Resolve Bowling Plan
      let effectiveBowlingPlan: DetailedBowlingPlan | undefined = undefined;
      if (isMyTeamBowling) {
        if (userBowlingPlan) {
          effectiveBowlingPlan = userBowlingPlan;
        }
      } else {
        effectiveBowlingPlan = BowlingPlanEngine.selectBowlingPlan(currentBowler, striker, {
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
      }

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
      });

      setCurrentDeliveryResult(deliveryRes);
      setDeliveryLifecycle('RESULT_LOCKED');
      setIsBallAnimating(true);
      setDeliveryLifecycle('BALL_PATH_PLAYBACK');
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
  const sortedStandings = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  const currentOverRuns = overRuns(inning);
  const firstWorm = wormPoints(innings[0]);
  const secondWorm = wormPoints(innings[1]);
  const maxWormRuns = Math.max(200, ...firstWorm.map((point) => point.runs), ...secondWorm.map((point) => point.runs));
  const projectedScore = inning?.balls ? Math.round((inning.runs / inning.balls) * 120) : 0;
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
    const match = historyDeliveryResults.find(d => {
      const overNum = d.ballPath ? Math.floor(d.currentBalls / 6) : 0;
      const ballNum = d.ballPath ? (d.currentBalls % 6) + 1 : 1;
      return `${overNum}.${ballNum}` === ballItem.ball;
    }) || currentDeliveryResult;
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

  const newsArticles = useMemo(() => [
    {
      id: 'news-1',
      tag: 'MATCH REPORT',
      title: `${battingTeam.name} vs ${bowlingTeam.name}: High-Intensity ${selectedFormat || 'T20'} Clash at Wankhede`,
      snippet: `${battingTeam.shortName} stand at ${inning?.runs || 0}/${inning?.wickets || 0} in ${formatOvers(inning?.balls || 0)} overs. Both captains implement tactical shifts across the innings.`,
      time: 'Just now',
      source: 'Cricket Arena Bureau',
      readTime: '2 min read',
    },
    {
      id: 'news-2',
      tag: 'TACTICS & ANALYSIS',
      title: `Field Strategy Breakdown: Ring Restriction & Boundary Protection Tactics`,
      snippet: `Detailed analysis of slip cordons and boundary sweeper deployments in varying pitch conditions. How field pressure influences batting risk thresholds.`,
      time: '18 mins ago',
      source: 'Tactical Desk',
      readTime: '4 min read',
    },
    {
      id: 'news-3',
      tag: 'PLAYER SPOTLIGHT',
      title: `${striker?.name || 'Top Batter'} Takes Control in the Middle Overs`,
      snippet: `With a strike rate of ${strikeRate(strikerLine.runs, strikerLine.balls)}, the current partnership of ${inning?.partnershipRuns || 0} runs is pivotal for ${battingTeam.shortName}.`,
      time: '45 mins ago',
      source: 'Arena Insider',
      readTime: '3 min read',
    },
    {
      id: 'news-4',
      tag: 'POINTS TABLE',
      title: `Tournament Equations: Playoff Scenarios for ${team1.shortName} and ${team2.shortName}`,
      snippet: `A decisive victory alters the championship standings. Projected Net Run Rate swings and upcoming round fixtures examined.`,
      time: '2 hours ago',
      source: 'League Analytics',
      readTime: '5 min read',
    },
  ], [battingTeam.name, battingTeam.shortName, bowlingTeam.name, bowlingTeam.shortName, inning?.runs, inning?.wickets, inning?.balls, inning?.partnershipRuns, selectedFormat, striker?.name, strikerLine.runs, strikerLine.balls, team1.shortName, team2.shortName]);

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
              <button onClick={() => setActiveTab('Points Table')} className="hover:text-blue-600 transition-colors">Stats</button>
              <button onClick={() => setActiveTab('Points Table')} className="hover:text-blue-600 transition-colors">Rankings</button>
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
              <span className="font-bold text-slate-900">{currentMatch?.title || 'Indian Premier League 2026'}</span>
              <span>·</span>
              <span className="font-semibold text-blue-600">{selectedFormat || 'T20'} Match</span>
              <span>·</span>
              <span className="text-slate-500">Wankhede Stadium, Mumbai</span>
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
                  <div className="text-xs text-slate-500 font-semibold">
                    CRR: <span className="font-bold text-slate-800">{currentRunRate}</span>
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

            {/* Playback & Tactical Mode Controls */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              {/* Tactical Mode Toggle */}
              <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200">
                {(['MANUAL', 'AI_RECOMMENDATIONS', 'FULL_AUTO'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setUserTeamControlMode(m);
                      if (m === 'FULL_AUTO') setAutoPlay(true);
                      else if (m === 'MANUAL') setAutoPlay(false);
                    }}
                    className={cn(
                      "px-2 py-1 rounded text-[9px] font-black uppercase transition-all",
                      userTeamControlMode === m
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    {m === 'AI_RECOMMENDATIONS' ? 'AI REC' : m === 'FULL_AUTO' ? 'AUTO' : 'MANUAL'}
                  </button>
                ))}
              </div>

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

              {/* Bowl / Skip Button */}
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
              >
                {isBallAnimating ? 'Skip' : 'Bowl'}
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
          {(['Live', 'Scorecard', 'Commentary', 'Points Table', 'News'] as Tab[]).map((tab) => (
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
            TAB 1: LIVE (3-COLUMN DESKTOP GRID)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'Live' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* ── LEFT COLUMN: 2D FIELD VISUALIZATION (lg:col-span-4 xl:col-span-5) ── */}
            <div className="lg:col-span-4 xl:col-span-5 space-y-3">
              {/* Field Map Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Live 2D Field Tactics</span>
                    <span className="text-[10px] text-slate-400 font-semibold">(Interactive)</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">Drag fielders to reposition</span>
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
                    userTeamControlMode={userTeamControlMode}
                    onUserTeamControlModeChange={setUserTeamControlMode}
                    aiCaptainRecommendation={aiCaptainRecommendation}
                    onApplyAIRecommendation={(rec) => {
                      if (rec.selectedBowlerId) {
                        setBowlerId(rec.selectedBowlerId);
                        setPending(null);
                      }
                      if (rec.bowlingPlan) {
                        setUserBowlingPlan(rec.bowlingPlan as DetailedBowlingPlan);
                      }
                      if (rec.battingIntent) {
                        setUserBattingIntent(rec.battingIntent);
                      }
                      setAiCaptainRecommendation(null);
                    }}
                    onIgnoreAIRecommendation={() => setAiCaptainRecommendation(null)}
                    userBattingIntent={userBattingIntent}
                    onUserBattingIntentChange={setUserBattingIntent}
                    userBowlingPlan={userBowlingPlan || undefined}
                    onUserBowlingPlanChange={setUserBowlingPlan}
                    isUserTeamBatting={isMyTeamBatting}
                    isUserTeamBowling={isMyTeamBowling}
                    opponentTacticalNotice={opponentTacticalNotice}
                    eligibleBowlers={selectableBowlers}
                    onSelectBowlerManual={handleConfirmBowler}
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
                  />
                </div>
              </div>

              {/* Partnership & Last Wicket Mini-Card */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Partnership</span>
                  <div className="font-bold text-slate-800">
                    <span className="text-base font-black text-blue-600">{inning?.partnershipRuns || 0}</span> runs
                    <span className="text-slate-500 font-semibold ml-1">({inning?.partnershipBalls || 0}b)</span>
                  </div>
                </div>

                {lastWicket && (
                  <div className="text-right border-l border-slate-100 pl-3">
                    <span className="text-[10px] uppercase font-bold text-red-500 block">Last Wicket</span>
                    <div className="font-bold text-slate-800">
                      {lastWicketBatter?.name || 'Batter'} <span className="text-red-600 font-black">{lastWicket.score}/{lastWicket.wicket}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── CENTRE COLUMN: LIVE BALL-BY-BALL & COMMENTARY (lg:col-span-4 xl:col-span-4) ── */}
            <div className="lg:col-span-4 xl:col-span-4 space-y-3">
              {/* Current Over Outcome Chips */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">
                    Over {currentOverIdx + 1} ({currentOverBalls.length}/6)
                  </span>
                  <span className="text-slate-500 font-semibold">
                    {currentOverTotalRuns} runs · {currentOverWickets} wkt
                  </span>
                </div>

                {/* Outcome Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {currentOverBalls.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Over starting...</span>
                  ) : (
                    currentOverBalls.map((b, i) => {
                      const isW = b === 'W';
                      const isSix = b === '6';
                      const isFour = b === '4';
                      const isZero = b === '0';
                      return (
                        <span
                          key={i}
                          className={cn(
                            "grid h-7 w-7 place-items-center rounded-full text-xs font-black tabular-nums transition-transform shadow-xs",
                            isW
                              ? "bg-red-600 text-white shadow-red-200"
                              : isSix
                              ? "bg-purple-600 text-white shadow-purple-200"
                              : isFour
                              ? "bg-blue-600 text-white shadow-blue-200"
                              : isZero
                              ? "bg-slate-100 text-slate-500 border border-slate-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          )}
                        >
                          {b}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Commentary Feed Card with Filter Bar */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    Ball-by-Ball Commentary
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">Tap to replay</span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {(['ALL', 'HIGHLIGHTS', 'OVERS', 'WICKETS', 'BOUNDARIES'] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setCommentaryFilter(flt)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                        commentaryFilter === flt
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {flt}
                    </button>
                  ))}
                </div>

                {/* Delivery Rows */}
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {filteredCommentary.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No commentary for selected filter.
                    </div>
                  ) : (
                    filteredCommentary.map((item, idx) => {
                      const isW = item.outcome === 'W';
                      const isSix = item.outcome === '6';
                      const isFour = item.outcome === '4';
                      const isZero = item.outcome === '0';

                      return (
                        <div
                          key={`${item.ball}-${idx}`}
                          onClick={() => handleReplayBall(item)}
                          className={cn(
                            "group p-2.5 rounded-xl border transition-all cursor-pointer",
                            isW
                              ? "bg-red-50/70 border-red-200 hover:border-red-300"
                              : isSix
                              ? "bg-purple-50/70 border-purple-200 hover:border-purple-300"
                              : isFour
                              ? "bg-blue-50/70 border-blue-200 hover:border-blue-300"
                              : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50"
                          )}
                          title="Click to replay ball trajectory on field map"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">{item.ball}</span>
                              <span
                                className={cn(
                                  "grid h-6 w-6 place-items-center rounded-full text-[10px] font-black shadow-xs",
                                  isW
                                    ? "bg-red-600 text-white"
                                    : isSix
                                    ? "bg-purple-600 text-white"
                                    : isFour
                                    ? "bg-blue-600 text-white"
                                    : isZero
                                    ? "bg-slate-100 text-slate-500 border border-slate-200"
                                    : "bg-emerald-100 text-emerald-800"
                                )}
                              >
                                {item.outcome}
                              </span>
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                                {item.text}
                              </p>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                <span>{item.badge}</span>
                                <span className="opacity-0 group-hover:opacity-100 text-blue-600 font-bold transition-opacity flex items-center gap-1">
                                  <RotateCcw className="w-2.5 h-2.5" /> Replay
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN: MATCH STATUS & TACTICAL CONTROLS (lg:col-span-4 xl:col-span-3) ── */}
            <div className="lg:col-span-4 xl:col-span-3 space-y-3">
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
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide">Current Bowler</span>
                  {isMyTeamBowling && (
                    <button
                      onClick={() => setManualDrawerOpen('BOWLER')}
                      className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <UserCheck className="w-3 h-3" /> Change
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-xs font-black text-slate-900">{currentBowler?.name || 'Bowler'}</div>
                    <div className="text-[10px] text-slate-500">{currentBowler?.bowlingStyle || currentBowler?.role || 'Fast'}</div>
                  </div>
                  <div className="flex items-center gap-3 text-center text-xs">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">O-M-R-W</span>
                      <span className="font-black text-slate-900 tabular-nums">
                        {formatOvers(bowlerLine.balls)}-{bowlerMaidens(inning, currentBowler?.id || '')}-{bowlerLine.runs}-{bowlerLine.wickets}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">ECO</span>
                      <span className="font-bold text-slate-700 tabular-nums">{economy(bowlerLine.runs, bowlerLine.balls)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Captain Recommendation Card */}
              {aiCaptainRecommendation && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-900 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      AI Captain Rec
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-200/60 text-indigo-800">
                      {aiCaptainRecommendation.confidence}% Conf
                    </span>
                  </div>

                  <p className="text-xs font-bold text-indigo-950">{aiCaptainRecommendation.observation}</p>
                  <p className="text-[10px] text-slate-600">{aiCaptainRecommendation.reasoning}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        if (aiCaptainRecommendation.selectedBowlerId) {
                          setBowlerId(aiCaptainRecommendation.selectedBowlerId);
                          setPending(null);
                        }
                        if (aiCaptainRecommendation.bowlingPlan) {
                          setUserBowlingPlan(aiCaptainRecommendation.bowlingPlan as DetailedBowlingPlan);
                        }
                        if (aiCaptainRecommendation.battingIntent) {
                          setUserBattingIntent(aiCaptainRecommendation.battingIntent);
                        }
                        setAiCaptainRecommendation(null);
                      }}
                      className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setAiCaptainRecommendation(null)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              )}

              {/* My Team Manual Tactical Controls Panel */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    My Team Tactical Control
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">
                    {isMyTeamBatting ? 'Batting Side' : isMyTeamBowling ? 'Bowling Side' : 'Opponent'}
                  </span>
                </div>

                {/* Sub-tabs: BATTING | BOWLING | FIELD */}
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
                  {(['BATTING', 'BOWLING', 'FIELD'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setTacticalSubTab(tab)}
                      className={cn(
                        "py-1 rounded-lg uppercase transition-all",
                        tacticalSubTab === tab
                          ? "bg-white text-slate-900 shadow-xs font-black"
                          : "text-slate-500 hover:text-slate-900"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tactical Sub-tab 1: Batting Intent */}
                {tacticalSubTab === 'BATTING' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500 uppercase">Batting Intent</span>
                      <span className="font-black text-blue-600">{userBattingIntent}</span>
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
                  </div>
                )}

                {/* Tactical Sub-tab 2: Bowling Plan */}
                {tacticalSubTab === 'BOWLING' && (
                  <div className="space-y-2 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-500 uppercase">Bowling Intent</span>
                      <span className="font-black text-purple-600">{userBowlingPlan?.intent || 'WICKET_TAKING'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {(['WICKET_TAKING', 'CONTAINMENT', 'DOT_PRESSURE', 'ATTACK_STUMPS'] as const).map((intent) => (
                        <button
                          key={intent}
                          onClick={() => {
                            setUserBowlingPlan(prev => ({
                              line: prev?.line || 'OFF_STUMP',
                              length: prev?.length || 'GOOD_LENGTH',
                              intent,
                            }));
                          }}
                          className={cn(
                            "py-1.5 px-2 rounded-lg text-[9px] font-bold uppercase transition-all border text-left truncate",
                            userBowlingPlan?.intent === intent
                              ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                              : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          {intent.replace('_', ' ')}
                        </button>
                      ))}
                    </div>

                    {/* Change Bowler Drawer Button */}
                    <button
                      onClick={() => setManualDrawerOpen('BOWLER')}
                      className="w-full mt-2 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-purple-200"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Select Next Bowler
                    </button>
                  </div>
                )}

                {/* Tactical Sub-tab 3: Field Strategy */}
                {tacticalSubTab === 'FIELD' && (
                  <div className="space-y-2 text-[10px]">
                    <span className="font-bold text-slate-500 uppercase block">Quick Presets</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['Attacking Slips', 'Balanced Ring', 'Death Defensive', 'Spin Trap'].map((pName) => (
                        <button
                          key={pName}
                          onClick={() => {
                            // Quick feedback
                          }}
                          className="py-1.5 px-2 rounded-lg text-[9px] font-bold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 text-left truncate"
                        >
                          {pName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending Drawer Prompt if active */}
                {pending && (
                  <button
                    onClick={() => {
                      if (pending === 'openers') setManualDrawerOpen('OPENERS');
                      else if (pending === 'batter') setManualDrawerOpen('BATTER');
                      else if (pending === 'bowler') setManualDrawerOpen('BOWLER');
                    }}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase shadow-sm flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{pending === 'openers' ? 'Select Openers' : pending === 'batter' ? 'Select New Batter' : 'Select Bowler'}</span>
                  </button>
                )}
              </div>

              {/* Match Analytics Card */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 space-y-3">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  Match Analytics
                </span>

                {/* Win Probability Bar */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-blue-700">{battingTeam.shortName} {winProbability.batting}%</span>
                    <span className="text-purple-700">{bowlingTeam.shortName} {winProbability.bowling}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${winProbability.batting}%` }} />
                    <div className="bg-purple-600 h-full transition-all duration-500" style={{ width: `${winProbability.bowling}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 block text-center font-medium">Win Probability Metric</span>
                </div>

                {/* Projected Score */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Projected Total</span>
                  <span className="font-black text-slate-900 tabular-nums">~{projectedScore} runs</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 2: FULL SCORECARD (BOTH INNINGS)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'Scorecard' && (
          <div className="space-y-6">
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
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 3: COMPREHENSIVE COMMENTARY (FULL BALL-BY-BALL)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'Commentary' && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-4">
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
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 4: POINTS TABLE (STANDINGS)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'Points Table' && (
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
        )}

        {/* ─────────────────────────────────────────────────────────────────
            TAB 5: NEWS & POST-MATCH REPORTS
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === 'News' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4">
              <h3 className="text-sm font-black text-slate-900 uppercase">Match Intelligence & Sports Bureau</h3>
              <p className="text-xs text-slate-500">Live reports, strategic insights and tournament dispatches</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {newsArticles.map((article) => (
                <div key={article.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 space-y-2.5 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{article.tag}</span>
                    <span>{article.time} · {article.readTime}</span>
                  </div>

                  <h4 className="text-sm font-black text-slate-900 leading-snug">{article.title}</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">{article.snippet}</p>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Source: {article.source}</span>
                    <button className="text-blue-600 font-bold hover:underline">Read Story →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
        isOpen={
          manualDrawerOpen !== null ||
          (pending === 'openers' && isMyTeamBatting && !autoPlay) ||
          (pending === 'batter' && isMyTeamBatting && !autoPlay) ||
          (pending === 'bowler' && isMyTeamBowling && !autoPlay && userTeamControlMode !== 'FULL_AUTO')
        }
        onClose={() => setManualDrawerOpen(null)}
        mode={
          manualDrawerOpen
            ? manualDrawerOpen
            : pending === 'openers'
              ? 'OPENERS'
              : pending === 'batter'
                ? 'BATTER'
                : 'BOWLER'
        }
        teamName={pending === 'bowler' || manualDrawerOpen === 'BOWLER' ? bowlingTeam.name : battingTeam.name}
        squad={pending === 'bowler' || manualDrawerOpen === 'BOWLER' ? bowlingSquad : battingSquad}
        format={(selectedFormat as ArenaFormat) || 'T20'}
        currentScore={{
          batters: inning?.batters,
          bowlers: inning?.bowlers,
          balls: inning?.balls,
        }}
        currentStrikerId={strikerId}
        currentNonStrikerId={nonStrikerId}
        lastOverBowlerId={lastOverBowlerId}
        aiRecommendedPlayerId={
          pending === 'bowler' || manualDrawerOpen === 'BOWLER'
            ? aiCaptainRecommendation?.selectedBowlerId || chooseAiBowler(inning, bowlingSquad, lastOverBowlerId)?.id
            : pending === 'batter'
              ? selectableBatters[0]?.id
              : battingSquad[0]?.id
        }
        aiReasoning={
          pending === 'bowler' || manualDrawerOpen === 'BOWLER'
            ? aiCaptainRecommendation?.reasoning || 'Optimal tactical matchup based on batter stats and pitch condition'
            : pending === 'batter'
              ? 'Highest rated batsman available in the playing squad'
              : 'Standard opening pair for team composition'
        }
        onConfirmOpeners={handleConfirmOpeners}
        onConfirmBatter={handleConfirmBatter}
        onConfirmBowler={handleConfirmBowler}
      />
    </div>
  );
}
