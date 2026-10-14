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
  ChevronDown
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

type Tab = 'Commentary' | 'Scorecard' | 'Graphs' | 'Points Table';

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
  const [activeTab, setActiveTab] = useState<Tab>('Commentary');
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

  return (
    <div className="relative min-h-screen bg-[#070b14] font-sans text-slate-100 pb-16">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#090e1c] via-[#060a14] to-[#04060a] z-0 pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/10 via-transparent to-transparent pointer-events-none z-0" />

      {/* ═══════════════════════════════════════════════════════════════════════
          1. UNIFIED BROADCAST HEADER: TEAMS, SCORE, TARGET, CONTROLS
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl px-3 py-2 shadow-2xl relative">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
          {/* Left: Back + Arena Branding + Format Selector */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => {
                if (inning?.isComplete && inningNo === 2) {
                  saveLiveMatchState(null);
                  setGameState(GameState.ARENA_HUB);
                } else {
                  saveLiveMatchState({
                    currentMatchId, inningNo, innings, strikerId, nonStrikerId,
                    bowlerId, lastOverBowlerId, battingCursor, pending,
                    pendingBatterEnd, pitch, weather
                  });
                  setGameState(GameState.ARENA_HUB);
                }
              }} 
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white transition-colors"
              title="Return to Hub"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
                <Compass className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[9px] font-black tracking-widest text-cyan-400 uppercase leading-none">CRICKET ARENA</div>
                <div className="text-xs font-black text-white">LIVE MATCH</div>
              </div>
            </div>

            <div className="h-4 w-px bg-white/10 hidden md:block" />

            {/* Format Pills */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-white/10">
              {(['T20', 'ODI', 'TEST'] as ArenaFormat[]).map((fmt) => (
                <span
                  key={fmt}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all",
                    (selectedFormat || 'T20') === fmt
                      ? fmt === 'TEST'
                        ? "bg-red-600 text-white shadow-sm"
                        : fmt === 'ODI'
                          ? "bg-blue-600 text-white shadow-sm"
                          : "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-500"
                  )}
                >
                  {fmt}
                </span>
              ))}
            </div>

            {/* Match Status Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span>{matchStatus.toUpperCase()}</span>
            </div>
          </div>

          {/* Center: Live Authoritative Scoreboard */}
          <div className="flex items-center gap-2 sm:gap-4 order-last sm:order-none w-full sm:w-auto justify-between sm:justify-center">
            {/* Batting Team */}
            <div className="flex items-center gap-2">
              <img
                src={resolveTeamLogo(battingTeam)}
                alt={battingTeam.shortName}
                className="h-7 w-7 object-contain drop-shadow"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="flex flex-col items-start leading-tight">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-white">{battingTeam.shortName}</span>
                  {battingTeam.id === myTeamId && (
                    <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-[8px] font-black px-1 rounded">YOU</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  CRR: <span className="text-slate-200 font-bold">{currentRunRate}</span>
                </span>
              </div>
            </div>

            {/* Score in Bold Broadcast Typography */}
            <div className="px-3 py-1 rounded-xl bg-white/[0.04] border border-white/10 text-center">
              <div className="text-lg sm:text-xl font-black text-white tabular-nums tracking-tight">
                {inning?.runs || 0}<span className="text-white/40">-{inning?.wickets || 0}</span>
                <span className="text-[11px] font-bold text-slate-400 ml-1.5">
                  ({formatOvers(inning?.balls || 0)} ov)
                </span>
              </div>
              {inningNo === 2 && innings[0] && (
                <div className="text-[9px] font-bold text-amber-300">
                  Need {Math.max(0, innings[0].runs + 1 - (inning?.runs || 0))} from {Math.max(0, maxBalls - (inning?.balls || 0))} balls · RRR: {(((innings[0].runs + 1 - (inning?.runs || 0)) / Math.max(0.5, (maxBalls - (inning?.balls || 0)) / 6))).toFixed(2)}
                </div>
              )}
            </div>

            {/* Bowling Team */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end leading-tight">
                <div className="flex items-center gap-1">
                  {bowlingTeam.id === myTeamId && (
                    <span className="bg-purple-500/20 text-purple-300 border border-purple-400/40 text-[8px] font-black px-1 rounded">YOU</span>
                  )}
                  <span className="text-xs font-black text-slate-300">{bowlingTeam.shortName}</span>
                </div>
                {inningNo === 2 && innings[0] && (
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    1st: {innings[0].runs}-{innings[0].wickets}
                  </span>
                )}
              </div>
              <img
                src={resolveTeamLogo(bowlingTeam)}
                alt={bowlingTeam.shortName}
                className="h-7 w-7 object-contain opacity-85 drop-shadow"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          </div>

          {/* Right: Tactical Mode & Playback Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Control Mode Selector */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-white/10">
              {(['MANUAL', 'AI_RECOMMENDATIONS', 'FULL_AUTO'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setUserTeamControlMode(m);
                    if (m === 'FULL_AUTO') setAutoPlay(true);
                    else if (m === 'MANUAL') setAutoPlay(false);
                  }}
                  className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all",
                    userTeamControlMode === m
                      ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                      : "text-slate-400 hover:text-white"
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
                  ? "bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                  : "bg-amber-500/20 border-amber-400 text-amber-300"
              )}
              title={autoPlay ? "Pause Auto-play" : "Resume Auto-play"}
            >
              {autoPlay && !isPlaybackPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            {/* Playback Speed Pills (1x, 1.5x, 2x) */}
            <div className="hidden md:flex items-center bg-slate-900/90 p-0.5 rounded-lg border border-white/10">
              {([1, 1.5, 2] as AnimationSpeed[]).map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-black transition-all",
                    playbackSpeed === spd
                      ? "bg-white text-slate-950 font-black"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Replay */}
            <button
              onClick={() => setReplayTrigger(n => n + 1)}
              className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Replay Last Ball"
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
                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all border",
                isBallAnimating
                  ? "bg-slate-800 border-white/10 text-slate-300 hover:text-white"
                  : canPlayManualBall && !autoPlay
                    ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30"
                    : "opacity-40 bg-slate-900 border-white/5 text-slate-500 cursor-not-allowed"
              )}
            >
              {isBallAnimating ? 'Skip' : 'Bowl'}
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-5xl xl:max-w-6xl shadow-2xl px-2 sm:px-3 pt-3">
        {/* ═══════════════════════════════════════════════════════════════════════
            2. REAL-TIME 2D STADIUM VISUALIZATION (MAIN CENTERPIECE)
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950/95 shadow-2xl mb-3">
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
            userBowlingPlan={userBowlingPlan}
            onUserBowlingPlanChange={setUserBowlingPlan}
            isUserTeamBatting={isMyTeamBatting}
            isUserTeamBowling={isMyTeamBowling}
            opponentTacticalNotice={opponentTacticalNotice}
            eligibleBowlers={selectableBowlers}
            onSelectBowlerManual={(id) => {
              setBowlerId(id);
              setPending(null);
            }}
            batterState={striker ? (batterStates[striker.id] || null) : null}
            hideTopHeader={true}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
            playbackSpeed={playbackSpeed}
            isPlaybackPaused={isPlaybackPaused}
            replayTrigger={replayTrigger}
            skipTrigger={skipTrigger}
          />
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            3. TIMELINE & QUICK MATCH CONTROLS STRIP
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-3.5 py-3 mb-3 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Over timeline chips */}
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">This Over</span>
              {inning?.isFreeHitPending && (
                <span className="animate-pulse rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                  Free Hit
                </span>
              )}
              <div className="flex gap-1.5 items-center">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const v = currentOverBalls[i];
                  const c =
                    v === 'W'
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/40 ring-1 ring-red-400'
                      : v === '6'
                        ? 'bg-gradient-to-br from-purple-500 to-amber-400 text-white font-black shadow-md shadow-purple-500/40'
                        : v === '4'
                          ? 'bg-blue-500 text-white font-black shadow-md shadow-blue-500/30'
                          : v === '0'
                            ? 'bg-slate-800 text-slate-400 border border-white/5'
                            : v
                              ? 'bg-white/15 text-white border border-white/10'
                              : 'bg-white/5 text-white/20 border border-white/5';
                  return (
                    <span
                      key={i}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-full text-[10px] font-black tabular-nums transition-all",
                        c
                      )}
                    >
                      {v || '·'}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Center: Partnership & Last Wicket */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="bg-white/[0.03] px-2.5 py-1 rounded-lg border border-white/5">
                <span>P'ship: </span>
                <span className="text-white font-bold">{inning?.partnershipRuns || 0}</span>
                <span className="text-slate-400 text-[10px]"> ({inning?.partnershipBalls || 0}b)</span>
              </div>
              {lastWicket && (
                <div className="hidden sm:block bg-red-950/20 px-2.5 py-1 rounded-lg border border-red-500/20 text-red-200">
                  <span>Last Wkt: </span>
                  <span className="font-bold text-white">{lastWicketBatter?.name || 'Batter'}</span>
                  <span className="text-red-400 font-bold ml-1">{lastWicket.score}/{lastWicket.wicket}</span>
                </div>
              )}
            </div>

            {/* Right: Tactical Actions & Manual Selectors */}
            <div className="flex items-center gap-2">
              {/* Batting Intent Quick Selector (When user team is batting) */}
              {isMyTeamBatting && (
                <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-white/10">
                  {(['DEFENSIVE', 'NORMAL', 'AGGRESSIVE', 'VERY_AGGRESSIVE'] as BattingIntent[]).map((intent) => (
                    <button
                      key={intent}
                      onClick={() => setUserBattingIntent(intent)}
                      className={cn(
                        "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase transition-all",
                        userBattingIntent === intent
                          ? intent === 'VERY_AGGRESSIVE'
                            ? "bg-red-500 text-white shadow-sm"
                            : intent === 'AGGRESSIVE'
                              ? "bg-amber-500 text-slate-950 shadow-sm"
                              : intent === 'DEFENSIVE'
                                ? "bg-blue-500 text-white shadow-sm"
                                : "bg-cyan-500 text-slate-950 shadow-sm"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      {intent === 'VERY_AGGRESSIVE' ? 'ATTACK' : intent === 'AGGRESSIVE' ? 'AGG' : intent === 'DEFENSIVE' ? 'DEF' : 'NORM'}
                    </button>
                  ))}
                </div>
              )}

              {/* Bowler Selection Button (When user team is bowling) */}
              {isMyTeamBowling && (
                <button
                  onClick={() => setManualDrawerOpen('BOWLER')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-bold hover:bg-purple-500/30 transition-colors shadow-sm"
                >
                  <UserCheck className="w-3.5 h-3.5 text-purple-400" />
                  <span>Change Bowler</span>
                </button>
              )}

              {/* Pending Selection Action Button */}
              {pending && (
                <button
                  onClick={() => {
                    if (pending === 'openers') setManualDrawerOpen('OPENERS');
                    else if (pending === 'batter') setManualDrawerOpen('BATTER');
                    else if (pending === 'bowler') setManualDrawerOpen('BOWLER');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black uppercase animate-pulse shadow-md shadow-cyan-500/30"
                >
                  <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                  <span>
                    {pending === 'openers' ? 'Choose Openers' : pending === 'batter' ? 'Choose Batter' : 'Choose Bowler'}
                  </span>
                </button>
              )}

              {/* Impact Player */}
              {!((inning as any)?.impactPlayer) && (
                <button
                  onClick={() => setShowImpactModal(true)}
                  className="px-2 py-1 rounded-lg bg-slate-800 text-[10px] font-bold uppercase text-slate-300 hover:text-white border border-white/10 transition-colors"
                >
                  Impact Player
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            4. BROADCAST BATTER & BOWLER SUMMARY STRIP
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {/* Batters Strip */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-white/5 bg-white/[0.02]">
                  <th className="py-1.5 pl-3 text-left font-bold">Batter</th>
                  <th className="py-1.5 w-10 text-center font-bold">R</th>
                  <th className="py-1.5 w-10 text-center font-bold">B</th>
                  <th className="py-1.5 w-10 text-center font-bold">4s</th>
                  <th className="py-1.5 w-10 text-center font-bold">6s</th>
                  <th className="py-1.5 pr-3 w-12 text-right font-bold">SR</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { player: striker, line: strikerLine, isStriker: true },
                  { player: nonStriker, line: nonStrikerLine, isStriker: false }
                ].map(({ player, line, isStriker }) => (
                  <tr
                    key={player?.id || (isStriker ? 's' : 'ns')}
                    className={cn(
                      "transition-colors",
                      isStriker ? "bg-cyan-500/[0.04]" : ""
                    )}
                  >
                    <td className="py-2 pl-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={getPlayerImage(player)}
                          onError={(e) => handlePlayerImageError(e, player?.name)}
                          className="h-7 w-7 rounded-full object-cover object-top ring-1 ring-white/10"
                          alt={player?.name}
                        />
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-bold text-white truncate max-w-[110px]">{player?.name || '--'}</span>
                          {isStriker && <span className="text-cyan-400 font-black text-xs">*</span>}
                        </div>
                      </div>
                    </td>
                    <td className={cn(
                      "py-2 text-center font-black tabular-nums",
                      line.runs >= 50 ? "text-amber-400" : "text-slate-100"
                    )}>
                      {line.runs}
                    </td>
                    <td className="py-2 text-center tabular-nums text-slate-400">{line.balls}</td>
                    <td className="py-2 text-center tabular-nums text-slate-300">{line.fours}</td>
                    <td className="py-2 text-center tabular-nums text-purple-300 font-bold">{line.sixes}</td>
                    <td className={cn(
                      "py-2 pr-3 text-right tabular-nums font-bold",
                      Number(strikeRate(line.runs, line.balls)) >= 150 ? "text-cyan-300" : "text-slate-400"
                    )}>
                      {strikeRate(line.runs, line.balls)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Current Bowler Strip */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-white/5 bg-white/[0.02]">
                  <th className="py-1.5 pl-3 text-left font-bold">Current Bowler</th>
                  <th className="py-1.5 w-10 text-center font-bold">O</th>
                  <th className="py-1.5 w-10 text-center font-bold">M</th>
                  <th className="py-1.5 w-10 text-center font-bold">R</th>
                  <th className="py-1.5 w-10 text-center font-bold">W</th>
                  <th className="py-1.5 pr-3 w-12 text-right font-bold">ECO</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={getPlayerImage(currentBowler)}
                        onError={(e) => handlePlayerImageError(e, currentBowler?.name)}
                        className="h-7 w-7 rounded-full object-cover object-top ring-1 ring-white/10"
                        alt={currentBowler?.name}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-white truncate max-w-[110px]">{currentBowler?.name || '--'}</span>
                        <span className="text-[9px] text-slate-400">{currentBowler?.bowlingStyle || currentBowler?.role || ''}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2 text-center tabular-nums text-slate-300">{formatOvers(bowlerLine.balls)}</td>
                  <td className="py-2 text-center tabular-nums text-slate-400">{bowlerMaidens(inning, currentBowler?.id || '')}</td>
                  <td className="py-2 text-center tabular-nums text-slate-300">{bowlerLine.runs}</td>
                  <td className="py-2 text-center tabular-nums font-black text-red-400">{bowlerLine.wickets}</td>
                  <td className={cn(
                    "py-2 pr-3 text-right tabular-nums font-bold",
                    bowlerLine.balls && (bowlerLine.runs / (bowlerLine.balls / 6)) <= 6 ? "text-emerald-400" : "text-slate-300"
                  )}>
                    {economy(bowlerLine.runs, bowlerLine.balls)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            5. MATCH TABS BAR
        ═══════════════════════════════════════════════════════════════════════ */}
        <div className="flex border-b border-slate-800 bg-slate-900/80 backdrop-blur-md rounded-t-2xl overflow-hidden mb-0">
          {(['Commentary', 'Scorecard', 'Graphs', 'Points Table'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2",
                activeTab === tab
                  ? "text-cyan-400 border-cyan-400 bg-white/[0.02]"
                  : "text-slate-400 border-transparent hover:text-white"
              )}
            >
              {tab === 'Points Table' ? 'Table' : tab === 'Commentary' ? 'Live Commentary' : tab}
            </button>
          ))}
        </div>

        {/* ── Over History (CREX style) ── */}
        {activeTab === 'Commentary' && (
          <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-3 py-2">
            <div className="space-y-1.5">
              {(() => {
                const overs: { over: number; balls: string[]; total: number }[] = [];
                const grouped = new Map<number, { balls: string[]; total: number }>();
                (inning?.deliveries || []).forEach((d) => {
                  const row = grouped.get(d.over) || { balls: [], total: 0 };
                  row.balls.push(d.isWicket ? 'W' : d.isLegal ? String(d.runs) : d.outcome);
                  row.total += d.runs;
                  grouped.set(d.over, row);
                });
                grouped.forEach((v, k) => overs.push({ over: k, ...v }));
                return overs.slice(-4).reverse().map((ov) => (
                  <div key={ov.over} className="flex items-center gap-2 text-[11px]">
                    <span className="shrink-0 w-14 text-zinc-500 font-bold">Over {ov.over + 1}</span>
                    <div className="flex gap-1 flex-1 flex-wrap">
                      {ov.balls.map((b, bi) => {
                        const c = b === 'W' ? 'text-red-400' : b === '6' ? 'text-zinc-100' : b === '4' ? 'text-zinc-300' : b === '0' ? 'text-zinc-600' : 'text-zinc-400';
                        return <span key={bi} className={`font-bold tabular-nums ${c}`}>{b}</span>;
                      })}
                    </div>
                    <span className="text-zinc-400 font-bold tabular-nums">= {ov.total}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── Tab Content ── */}
        <div className="px-3 py-3">
          {activeTab === 'Commentary' && (
            <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
              {(inning?.commentary || []).map((item, ci) => {
                const isHighlight = item.tone === 'wicket' || item.tone === 'six' || item.tone === 'four';
                const ballBg = item.outcome === 'W' ? 'bg-red-500/80 text-white' : item.outcome === '6' ? 'bg-zinc-200 text-zinc-900' : item.outcome === '4' ? 'bg-zinc-400 text-zinc-900' : item.outcome === '0' ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-700 text-zinc-200';
                const rowBg = item.tone === 'wicket' ? 'bg-red-500/5' : item.tone === 'six' ? 'bg-white/5' : item.tone === 'four' ? 'bg-white/5' : '';
                return (
                  <div key={`${item.ball}-${ci}`} className={`flex gap-2.5 rounded-lg px-2 py-2 ${rowBg} ${ci === 0 ? 'border border-zinc-700/50' : ''}`}>
                    <div className="shrink-0 w-8 text-right text-[11px] font-bold text-zinc-500 pt-0.5">{item.ball}</div>
                    <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-black ${ballBg}`}>{item.outcome}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-5 ${isHighlight ? 'text-white font-semibold' : 'text-zinc-400'}`}>{item.text}</p>
                      <span className="text-[10px] text-zinc-500">{item.badge}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'Scorecard' && (
            <div className="space-y-5">
              {[0, 1].map((idx) => {
                const score = innings[idx];
                const batTeam = franchises.find((f) => f.id === score?.battingTeamId);
                const bowlTeam = franchises.find((f) => f.id === score?.bowlingTeamId);
                const batSquad = score ? getTeamSquad(score.battingTeamId) : [];
                const usedBowlers = score ? getTeamSquad(score.bowlingTeamId).filter((player) => (score.bowlers[player.id]?.balls || 0) > 0) : [];
                return (
                  <div key={idx}>
                    <div className="mb-2 text-xs font-black uppercase tracking-wider text-zinc-300">{batTeam?.shortName} {score?.balls ? `${score.runs}-${score.wickets} (${formatOvers(score.balls)})` : 'Yet to bat'}</div>
                    <div className="overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-zinc-800/30 text-[9px] uppercase tracking-wider text-zinc-500">
                          <th className="py-2 pl-3 text-left">Batter</th><th className="py-2 w-8 text-center">R</th><th className="py-2 w-8 text-center">B</th><th className="py-2 w-8 text-center">4s</th><th className="py-2 w-8 text-center">6s</th><th className="py-2 pr-3 w-10 text-right">SR</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {batSquad.map((player, i) => {
                            const line = score?.batters[player.id] || { balls: 0, fours: 0, out: false, runs: 0, sixes: 0, status: i < 2 && score?.balls ? 'not out' : '' };
                            const active = score === inning && (player.id === strikerId || player.id === nonStrikerId);
                            if (!score?.batters[player.id] && (!score?.balls || (i >= 2 && !active))) return null;
                            return <tr key={player.id} className={active ? 'bg-zinc-800/30' : ''}>
                              <td className="py-1.5 pl-3"><div className="flex items-center gap-1.5"><img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player.name)} className="h-6 w-6 rounded-full object-cover object-top" alt={player.name} /><div><div className="flex items-center gap-1 font-bold text-white text-[11px]">{player.name}{batTeam?.captainId === player.id && <span className="text-[8px] font-black text-amber-500 bg-amber-500/20 px-1 rounded">C</span>}{player.id === strikerId && <span className="text-zinc-400"> *</span>}</div><div className="text-[9px] text-zinc-500 truncate max-w-[120px]">{line.status}</div></div></div></td>
                              <td className={`py-1.5 text-center font-black tabular-nums ${line.runs >= 50 ? 'text-zinc-100' : 'text-zinc-300'}`}>{line.runs}</td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-500">{line.balls}</td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-500">{line.fours}</td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-500">{line.sixes}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-500">{strikeRate(line.runs, line.balls)}</td>
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Extras */}
                    <div className="mt-2 flex gap-3 text-[10px] text-zinc-500 px-1">
                      <span>Extras: <span className="text-white font-bold">{(score?.extras.wides || 0) + (score?.extras.noBalls || 0) + (score?.extras.byes || 0) + (score?.extras.legByes || 0)}</span></span>
                      <span>(wd {score?.extras.wides || 0}, nb {score?.extras.noBalls || 0}, b {score?.extras.byes || 0}, lb {score?.extras.legByes || 0})</span>
                    </div>
                    {/* FOW */}
                    {(score?.wicketLog.length || 0) > 0 && (
                      <div className="mt-2 px-1">
                        <div className="text-[9px] font-bold uppercase text-zinc-500 mb-1">Fall of Wickets</div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400">
                          {score!.wicketLog.map((w) => {
                            const b = players.find((p) => p.id === w.playerId);
                            return <span key={`${w.wicket}-${w.playerId}`}><span className="text-white font-bold">{w.score}-{w.wicket}</span> ({b?.name}, {w.ball})</span>;
                          })}
                        </div>
                      </div>
                    )}
                    {/* Bowlers */}
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-300 px-1">{bowlTeam?.shortName} Bowling</div>
                    <div className="mt-1 overflow-x-auto rounded-lg border border-zinc-800">
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-zinc-800/30 text-[9px] uppercase tracking-wider text-zinc-500">
                          <th className="py-2 pl-3 text-left">Bowler</th><th className="py-2 w-8 text-center">O</th><th className="py-2 w-8 text-center">M</th><th className="py-2 w-8 text-center">R</th><th className="py-2 w-8 text-center">W</th><th className="py-2 pr-3 w-10 text-right">ECO</th>
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {usedBowlers.map((player) => {
                            const line = score!.bowlers[player.id];
                            return <tr key={player.id}>
                              <td className="py-1.5 pl-3"><div className="flex items-center gap-1.5"><img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player.name)} className="h-6 w-6 rounded-full object-cover object-top" alt={player.name} /><span className="font-bold text-white">{player.name}</span></div></td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-400">{formatOvers(line.balls)}</td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-400">{bowlerMaidens(score, player.id)}</td>
                              <td className="py-1.5 text-center tabular-nums text-zinc-400">{line.runs}</td>
                              <td className="py-1.5 text-center tabular-nums font-black text-zinc-300">{line.wickets}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums text-zinc-400">{economy(line.runs, line.balls)}</td>
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'Graphs' && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">Manhattan</div>
                <div className="flex h-40 items-end gap-1 rounded-lg border border-white/8 bg-white/[.02] p-3">
                  {currentOverRuns.map((row) => {
                    const height = Math.max(6, Math.min(100, (row.runs / 24) * 100));
                    const phase = row.over < 6 ? 'bg-cyan-400' : row.over >= 16 ? 'bg-amber-300' : 'bg-white/30';
                    return (
                      <div key={row.over} className="flex flex-1 flex-col items-center justify-end gap-1">
                        {row.wickets > 0 && <span className="text-[8px] font-black text-red-400">{row.wickets}W</span>}
                        <div className={`w-full rounded-t ${phase}`} style={{ height: `${height}%` }} />
                        <span className="text-[8px] text-slate-600">{row.over + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">Worm Comparison</div>
                <div className="relative h-48 rounded-lg border border-white/8 bg-white/[.02] p-3">
                  <svg viewBox="0 0 120 200" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                    {[{ points: firstWorm, color: '#22d3ee' }, { points: secondWorm, color: '#f59e0b' }].map((series, idx) => {
                      const path = series.points.map((point) => `${(point.ball / 120) * 120},${200 - (point.runs / maxWormRuns) * 180}`).join(' ');
                      return <polyline key={idx} fill="none" stroke={series.color} strokeWidth="2.5" points={path} />;
                    })}
                  </svg>
                  <div className="absolute bottom-2 left-3 flex gap-3 text-[10px] font-bold"><span className="text-cyan-300">1st Inn</span><span className="text-amber-300">2nd Inn</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Points Table' && (
            <div className="overflow-x-auto rounded-lg border border-white/8">
              <table className="w-full text-[11px]">
                <thead><tr className="bg-white/5 text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pl-3 text-left">Team</th><th className="py-2 w-6 text-center">P</th><th className="py-2 w-6 text-center">W</th><th className="py-2 w-6 text-center">L</th><th className="py-2 w-10 text-center">NRR</th><th className="py-2 pr-3 w-8 text-center">Pts</th>
                </tr></thead>
                <tbody className="divide-y divide-white/5">
                  {sortedStandings.map((standing, index) => {
                    const team = franchises.find((f) => f.id === standing.teamId);
                    return (
                      <tr key={standing.teamId} className={team?.id === selectedFranchiseId ? 'bg-cyan-400/5' : ''}>
                        <td className="py-2 pl-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-600 w-3">{index + 1}</span>
                            <img src={team?.logo} alt={team?.shortName} className="h-6 w-6 shrink-0 object-contain" />
                            <span className="font-bold text-white truncate max-w-[80px]">{team?.name}</span>
                          </div>
                        </td>
                        <td className="py-2 text-center tabular-nums text-slate-400">{standing.played}</td>
                        <td className="py-2 text-center tabular-nums text-green-300">{standing.won}</td>
                        <td className="py-2 text-center tabular-nums text-red-300">{standing.lost}</td>
                        <td className={`py-2 text-center tabular-nums font-mono text-[10px] ${standing.nrr >= 0 ? 'text-green-300' : 'text-red-300'}`}>{standing.nrr > 0 ? '+' : ''}{standing.nrr.toFixed(3)}</td>
                        <td className="py-2 pr-3 text-center font-black text-white">{standing.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Impact Player Modal ── */}
      {showImpactModal && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/80 pb-0 sm:justify-center sm:p-4">
          <div className="w-full max-w-md rounded-t-2xl bg-zinc-900 p-4 sm:rounded-2xl border border-zinc-800 animate-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Impact Player Substitution</h2>
              <button onClick={() => setShowImpactModal(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-400 mb-2 block">Outgoing Player (From Playing XI)</label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectedXiPlayers.map(p => (
                    <button key={p.id} onClick={() => setImpactOutgoingId(p.id)} className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${impactOutgoingId === p.id ? 'border-zinc-500 bg-zinc-800' : 'border-zinc-800/50 bg-white/[.02] hover:bg-white/5'}`}>
                      <img src={getPlayerImage(p)} onError={(e) => handlePlayerImageError(e, p.name)} className="h-6 w-6 rounded-full object-cover object-top" alt={p.name} />
                      <span className="flex-1 text-xs font-bold truncate text-white">{p.name}</span>
                      <span className="text-[10px] text-zinc-500">{p.role}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 mb-2 block">Incoming Player (From Bench)</label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {franchises.find(f => f.id === myTeamId)?.squad.filter(id => !selectedSquadIds.includes(id)).map(id => players.find(p => p.id === id)).filter(Boolean).map(p => (
                    <button key={p!.id} onClick={() => setImpactIncomingId(p!.id)} className={`w-full flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${impactIncomingId === p!.id ? 'border-zinc-500 bg-zinc-800' : 'border-zinc-800/50 bg-white/[.02] hover:bg-white/5'}`}>
                      <img src={getPlayerImage(p!)} onError={(e) => handlePlayerImageError(e, p!.name)} className="h-6 w-6 rounded-full object-cover object-top" alt={p!.name} />
                      <span className="flex-1 text-xs font-bold truncate text-white">{p!.name}</span>
                      <span className="text-[10px] text-zinc-500">{p!.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowImpactModal(false)} className="flex-1 rounded-xl border border-zinc-700 bg-transparent py-3 text-sm font-bold text-zinc-300 hover:bg-zinc-800">Cancel</button>
              <button disabled={!impactIncomingId || !impactOutgoingId} onClick={handleImpactSubstitution} className="flex-1 rounded-xl bg-white py-3 text-sm font-bold text-zinc-950 hover:bg-zinc-200 disabled:opacity-50">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Match Complete Modal ── */}
      {resultSubmitted && currentMatchId && innings[0] && innings[1] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-lg rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Background ambient */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full bg-emerald-500/10 blur-[80px]" />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4">
                <Trophy className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Match Complete</h2>
              
              {(() => {
                const i1 = innings[0];
                const i2 = innings[1];
                const winnerId = i2.runs > i1.runs ? i2.battingTeamId : i1.battingTeamId;
                const winner = franchises.find(f => f.id === winnerId);
                const margin = i2.runs > i1.runs 
                  ? `${10 - i2.wickets} wickets` 
                  : i2.runs === i1.runs ? 'Tie' : `${i1.runs - i2.runs} runs`;

                return (
                  <>
                    <p className="text-lg font-bold text-zinc-300 mb-8">
                      {i2.runs === i1.runs ? "Match Tied" : <span className="text-emerald-400">{winner?.name} won by {margin}</span>}
                    </p>
                    
                    <div className="w-full grid grid-cols-2 gap-4 mb-8">
                      {/* Team 1 Score */}
                      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex flex-col items-center justify-center">
                        <div className="text-sm font-bold text-zinc-400 mb-1">{team1.shortName}</div>
                        <div className="text-2xl font-black text-white">{i1.battingTeamId === team1.id ? i1.runs : i2.runs}/{i1.battingTeamId === team1.id ? i1.wickets : i2.wickets}</div>
                        <div className="text-xs font-bold text-zinc-500 mt-1">{i1.battingTeamId === team1.id ? (i1.balls/6).toFixed(1) : (i2.balls/6).toFixed(1)} ov</div>
                      </div>
                      
                      {/* Team 2 Score */}
                      <div className="p-4 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 flex flex-col items-center justify-center">
                        <div className="text-sm font-bold text-zinc-400 mb-1">{team2.shortName}</div>
                        <div className="text-2xl font-black text-white">{i1.battingTeamId === team2.id ? i1.runs : i2.runs}/{i1.battingTeamId === team2.id ? i1.wickets : i2.wickets}</div>
                        <div className="text-xs font-bold text-zinc-500 mt-1">{i1.battingTeamId === team2.id ? (i1.balls/6).toFixed(1) : (i2.balls/6).toFixed(1)} ov</div>
                      </div>
                    </div>
                  </>
                );
              })()}

              <button 
                onClick={() => setGameState(GameState.ARENA_HUB)}
                className="w-full py-4 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-bold tracking-wide transition-all active:scale-95"
              >
                Return to League
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* ── Manual Player Selection Drawer / Modal ── */}
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
