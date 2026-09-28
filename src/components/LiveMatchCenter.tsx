import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Trophy
} from 'lucide-react';
import { GameState, useGameStore } from '../stores/useGameStore';
import type { Player } from '../types/common';
import { MatchEngine } from '../lib/matchEngine';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import { MatchStatus, PitchType, WeatherCondition, type InningsData, type PlayerMatchStats, DRSResult } from '../types/match';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';

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
    
    // Strict rule: Only the top 6 bowlers in the playing XI can bowl.
    // This perfectly prevents pure batters from ever bowling in ODI or T20.
    const top6 = bowlerOrder.slice(0, 6);
    
    const available = top6.filter((player) => (score?.bowlers[player.id]?.balls || 0) < maxBalls && player.id !== previousOverBowlerId);
    
    // Fallback if somehow all top 6 are exhausted (should not happen normally)
    if (available.length === 0) {
        return bowlerOrder.filter((player) => (score?.bowlers[player.id]?.balls || 0) < maxBalls && player.id !== previousOverBowlerId);
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
      if (isMyTeamBatting) return;
      setStrikerId(battingSquad[0]?.id || null);
      setNonStrikerId(battingSquad[1]?.id || null);
      setBattingCursor(2);
      setPending('bowler');
      return;
    }
    if (pending === 'batter') {
      if (isMyTeamBatting) return;
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
      if (isMyTeamBowling) return;
      setBowlerId(chooseAiBowler(inning, bowlingSquad, lastOverBowlerId)?.id || null);
      setPending(null);
    }
  }, [pending, inning, battingSquad, bowlingSquad, battingCursor, isMyTeamBatting, isMyTeamBowling, strikerId, nonStrikerId, getAvailableBatters, chooseAiBowler, queueBowlerAfterBatter, lastOverBowlerId, pendingBatterEnd, autoPlay]);

  useEffect(() => {
    if (!inning || inning.isComplete || pending || !striker || !nonStriker || !currentBowler) return;
    if (!autoPlay && manualBallRequests <= 0) return;

    const playDelivery = () => {
      // ---- Compute ball result from closure state (fresh thanks to setTimeout) ----
      const current = inning;
      if (current.isComplete) return;

      const target = inningNo === 2 ? (innings[0]?.runs || 0) + 1 : 0;
      const ballsRemaining = Math.max(1, maxBalls - current.balls);
      const requiredRate = target ? ((target - current.runs) / (ballsRemaining / 6)) : 0;
      const strikerLine = current.batters[striker.id] || { balls: 0, dots: 0, fours: 0, out: false, runs: 0, sixes: 0, status: 'not out' };
      const currentBowlerLine = current.bowlers[currentBowler.id] || { balls: 0, dots: 0, runs: 0, wickets: 0 };
      const currentOverProgress = current.balls / 6;
      const ball = MatchEngine.simulateBall(
        striker,
        currentBowler,
        currentOverProgress,
        current.wickets,
        requiredRate,
        pitch,
        weather,
        {
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
        },
        {
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
        },
        current.recentBalls,
        current.isFreeHitPending,
        currentBowlerLine.bouncersThisOver || 0,
        selectedFormat || 'T20'
      );

      let wicket = ball.isWicket && current.wickets < 10;
      let review = null;
      let drsReviewsRemaining = current.drsReviewsRemaining;
      const drsReviews = [...current.drsReviews];
      let ballCommentary = ball.commentary;

      if (wicket && current.drsReviewsRemaining > 0) {
        review = MatchEngine.simulateDRS(ball, battingTeam.id, current.drsReviewsRemaining);
      } else if (!wicket && ball.wicketType && current.drsReviewsRemaining > 0) {
        review = MatchEngine.simulateDRS(ball, bowlingTeam.id, current.drsReviewsRemaining);
      }

      if (review) {
        drsReviews.push(review);
        ballCommentary += '\n\n' + MatchEngine.getDRSCommentary(review, striker.name, currentBowler.name);
        if (review.overturned) {
            wicket = review.originalDecision === 'Not Out';
        } else if (review.result !== DRSResult.UMPIRES_CALL) {
            drsReviewsRemaining -= 1;
        }
      }

      const isLegalDelivery = ball.extraType !== 'Wide' && ball.extraType !== 'No Ball';
      const ballRuns = ball.runs;
      const batterRuns = ball.isExtra ? 0 : ball.runs;
      const nextBall = current.balls + (isLegalDelivery ? 1 : 0);
      const ballLabel = `${Math.floor(current.balls / 6)}.${(current.balls % 6) + 1}`;
      const overIndex = Math.floor(current.balls / 6);
      const outcomeText = wicket ? 'W' : ball.isExtra ? (ball.extraType === 'No Ball' ? 'Nb' : 'Wd') : String(ballRuns);
      const nextRuns = current.runs + ballRuns;
      const wicketNumber = current.wickets + (wicket ? 1 : 0);
      const wicketStatus = `${ball.wicketType || 'Out'} b ${currentBowler.name}`;
      const tone: CommentaryLine['tone'] = wicket ? 'wicket' : ballRuns === 6 ? 'six' : ballRuns === 4 ? 'four' : ballRuns === 0 ? 'dot' : 'info';

      // ---- Determine state transitions ----
      const overEnded = !wicket && isLegalDelivery && nextBall % 6 === 0;
      const wicketAtOverEnd = wicket && isLegalDelivery && nextBall % 6 === 0;
      const inningsComplete = nextBall >= maxBalls || wicketNumber >= 10 || (inningNo === 2 && target > 0 && nextRuns >= target);

      // ---- Update innings (pure updater, no side effects) ----
      setInnings((previous) => {
        const next = [...previous];
        const upd = {
          ...next[inningNo - 1],
          batters: { ...next[inningNo - 1].batters },
          bowlers: { ...next[inningNo - 1].bowlers },
          deliveries: [...next[inningNo - 1].deliveries],
          extras: { ...next[inningNo - 1].extras },
          commentary: [...next[inningNo - 1].commentary],
          recentBalls: [...next[inningNo - 1].recentBalls],
          runRateHistory: [...next[inningNo - 1].runRateHistory],
          wicketLog: [...next[inningNo - 1].wicketLog],
        };

        upd.batters[striker.id] = {
          ...strikerLine,
          balls: strikerLine.balls + (isLegalDelivery ? 1 : 0),
          ballsSinceBoundary: ballRuns === 4 || ballRuns === 6 ? 0 : (strikerLine.ballsSinceBoundary || 0) + (isLegalDelivery ? 1 : 0),
          consecutiveDots: ballRuns === 0 && !ball.isExtra && !wicket ? (strikerLine.consecutiveDots || 0) + 1 : 0,
          dots: (strikerLine.dots || 0) + (ballRuns === 0 && !ball.isExtra && !wicket ? 1 : 0),
          fours: strikerLine.fours + (ballRuns === 4 && !ball.isExtra ? 1 : 0),
          momentum: Math.max(-18, Math.min(24, (strikerLine.momentum || 0) + (ballRuns === 6 ? 8 : ballRuns === 4 ? 5 : ballRuns === 0 ? -2 : 1) - (wicket ? 8 : 0))),
          runs: strikerLine.runs + batterRuns,
          sixes: strikerLine.sixes + (ballRuns === 6 && !ball.isExtra ? 1 : 0),
          out: wicket,
          status: wicket ? wicketStatus : strikerLine.status,
          wicketBurst: Math.max(0, (strikerLine.wicketBurst || 0) + (wicket ? 1 : -0.2)),
        };

        upd.bowlers[currentBowler.id] = {
          balls: currentBowlerLine.balls + (isLegalDelivery ? 1 : 0),
          dots: (currentBowlerLine.dots || 0) + (ballRuns === 0 && !ball.isExtra ? 1 : 0),
          lastOverRuns: ((currentBowlerLine.lastOverRuns || 0) + ballRuns) * (nextBall > 0 && nextBall % 6 === 0 ? 0 : 1),
          momentum: Math.max(-16, Math.min(24, (currentBowlerLine.momentum || 0) + (wicket ? 10 : ballRuns === 0 ? 2 : ballRuns >= 4 ? -3 : 0))),
          runs: currentBowlerLine.runs + ballRuns,
          wickets: currentBowlerLine.wickets + (wicket ? 1 : 0),
          bouncersThisOver: overEnded ? 0 : (currentBowlerLine.bouncersThisOver || 0) + (!wicket && isLegalDelivery && ballRuns === 0 && Math.random() < 0.15 ? 1 : 0),
        };

        upd.isFreeHitPending = ball.triggeredFreeHit ? true : (isLegalDelivery || (ball.extraType && ball.extraType !== 'No Ball' && ball.extraType !== 'Wide') ? false : current.isFreeHitPending);
        upd.drsReviews = drsReviews;
        upd.drsReviewsRemaining = drsReviewsRemaining;

        upd.runs = nextRuns;
        upd.balls = nextBall;
        upd.wickets = wicketNumber;
        if (ball.extraType === 'Wide') upd.extras.wides += 1;
        if (ball.extraType === 'No Ball') upd.extras.noBalls += 1;
        if (ball.extraType === 'Bye') upd.extras.byes += 1;
        if (ball.extraType === 'Leg Bye') upd.extras.legByes += 1;
        upd.deliveries = [
          ...upd.deliveries,
          {
            ball: ballLabel,
            batterId: striker.id,
            bowlerId: currentBowler.id,
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
            text: ballCommentary,
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
              bowlerId: currentBowler.id,
              playerId: striker.id,
              score: nextRuns,
              status: wicketStatus,
              wicket: wicketNumber,
              wicketType: ball.wicketType || 'Out',
            },
          ];
          upd.partnershipBalls = 0;
          upd.partnershipRuns = 0;
        } else if (!ball.isExtra) {
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

        if (inningsComplete) {
          upd.isComplete = true;
        }

        next[inningNo - 1] = upd;
        return next;
      });

      // ---- Set all other states directly (no dependency on updater side effects) ----
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
          setLastOverBowlerId(currentBowler.id);
          setBowlerId(null);
          setStrikerId(nonStriker.id);
        }
        setPending('batter');
      } else if (overEnded) {
        setLastOverBowlerId(currentBowler.id);
        setBowlerId(null);
        setStrikerId(nonStriker.id);
        setNonStrikerId(striker.id);
        setPending('bowler');
      } else {
        // Mid-over: swap strike on odd runs
        if (!ball.isExtra && ballRuns % 2 === 1) {
          setStrikerId(nonStriker.id);
          setNonStrikerId(striker.id);
        }
      }

      if (!autoPlay) setManualBallRequests((value) => Math.max(0, value - 1));
    };

    const timer = window.setTimeout(playDelivery, autoPlay ? 1900 : 0);
    return () => window.clearTimeout(timer);
  }, [inning, innings, inningNo, pending, striker, nonStriker, currentBowler, battingCursor, autoPlay, manualBallRequests, pitch, weather, battingTeam]);

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
    <div className="relative min-h-screen bg-[#080c15] font-sans text-zinc-100 pb-12">
      {/* ── Sticky top bar ── */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-40 mix-blend-luminosity z-0 pointer-events-none" />
      <div className="fixed inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20 z-0 pointer-events-none" />
      
      <div className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl relative">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2">
          <button 
            onClick={() => {
              if (inning?.isComplete && inningNo === 2) {
                saveLiveMatchState(null); // Clear state if match is over
                setGameState(GameState.LEAGUE);
              } else {
                saveLiveMatchState({
                  currentMatchId, inningNo, innings, strikerId, nonStrikerId,
                  bowlerId, lastOverBowlerId, battingCursor, pending,
                  pendingBatterEnd, pitch, weather
                });
                setGameState(GameState.LEAGUE);
              }
            }} 
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-bold">{team1.shortName} vs {team2.shortName}</div>
            <div className="text-[10px] text-slate-500">{currentMatch?.isPlayoff ? currentMatch.playoffType : `Match ${currentMatch?.matchNumber || 1}`} · {selectedFormat || 'T20'} · {matchStatus}</div>
          </div>
          <button onClick={() => setAutoPlay((v) => !v)} className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase ${autoPlay ? 'bg-green-500 text-white' : 'bg-white/10 text-slate-300'}`}>
            {autoPlay ? 'Auto' : 'Manual'}
          </button>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-lg shadow-2xl">
        {/* ── Score Card ── */}
        <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-3 py-3">
          {/* Batting team */}
          <div className="flex items-center gap-2.5">
            <img src={resolveTeamLogo(battingTeam)} alt={battingTeam.shortName} className="h-9 w-9 shrink-0 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">{battingTeam.name}</span>
                {battingTeam.id === myTeamId && <span className="rounded bg-zinc-700 px-1 py-px text-[8px] font-black text-zinc-300">YOU</span>}
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black tabular-nums">{inning?.runs || 0}<span className="text-white/35">-{inning?.wickets || 0}</span></span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{formatOvers(inning?.balls || 0)} Ov</span>
            <span>CRR: <span className="text-white font-bold">{currentRunRate}</span></span>
            {currentMatchToss && <span>{tossWinner?.shortName} opt to {currentMatchToss.decision}</span>}
          </div>
          {/* Target info */}
          {inningNo === 2 && innings[0] && inning && !inning.isComplete && (
            <div className="mt-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-center text-xs font-bold text-zinc-300">
              {battingTeam.shortName} need <span className="text-white">{Math.max(0, innings[0].runs + 1 - inning.runs)}</span> runs from <span className="text-white">{Math.max(0, maxBalls - inning.balls)}</span> balls · RRR: <span className="text-white">{(((innings[0].runs + 1 - inning.runs) / Math.max(0.5, (maxBalls - inning.balls) / 6))).toFixed(2)}</span>
            </div>
          )}
          {inningNo === 2 && innings[0] && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
              <img src={resolveTeamLogo(bowlingTeam)} alt={bowlingTeam.shortName} className="h-5 w-5 shrink-0 object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              <span>{innings[0].runs}-{innings[0].wickets} ({formatOvers(innings[0].balls)})</span>
            </div>
          )}
        </div>

        {/* ── Tab bar (CREX style) ── */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md">
          {(['Commentary', 'Scorecard', 'Graphs', 'Points Table'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${activeTab === tab ? 'text-white border-b-2 border-white' : 'text-zinc-500'}`}>
              {tab === 'Points Table' ? 'Table' : tab === 'Commentary' ? 'Live' : tab}
            </button>
          ))}
        </div>

        {/* ── Batter Strip ── */}
        <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-[11px]">
            <thead><tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1.5 pl-3 text-left font-bold">Batter</th>
              <th className="py-1.5 w-10 text-center font-bold">R</th>
              <th className="py-1.5 w-10 text-center font-bold">B</th>
              <th className="py-1.5 w-10 text-center font-bold">4s</th>
              <th className="py-1.5 w-10 text-center font-bold">6s</th>
              <th className="py-1.5 pr-3 w-12 text-right font-bold">SR</th>
            </tr></thead>
            <tbody>
              {[{ player: striker, line: strikerLine, isStriker: true }, { player: nonStriker, line: nonStrikerLine, isStriker: false }].map(({ player, line, isStriker }) => (
                <tr key={player?.id || (isStriker ? 's' : 'ns')} className={isStriker ? 'bg-zinc-800/30' : ''}>
                  <td className="py-2 pl-3">
                    <div className="flex items-center gap-2">
                      <img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player?.name)} className="h-7 w-7 rounded-full object-cover object-top" alt={player?.name} />
                      <span className="font-bold text-white truncate max-w-[100px]">{player?.name || '--'}</span>
                      {player && battingTeam.captainId === player.id && <span className="text-[8px] font-black text-amber-500 bg-amber-500/20 px-1 rounded">C</span>}
                      {isStriker && <span className="text-[8px] text-zinc-400">*</span>}
                    </div>
                  </td>
                  <td className={`py-2 text-center font-black tabular-nums ${line.runs >= 50 ? 'text-zinc-100' : 'text-zinc-300'}`}>{line.runs}</td>
                  <td className="py-2 text-center tabular-nums text-zinc-500">{line.balls}</td>
                  <td className="py-2 text-center tabular-nums text-zinc-400">{line.fours}</td>
                  <td className="py-2 text-center tabular-nums text-zinc-400">{line.sixes}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${Number(strikeRate(line.runs, line.balls)) >= 150 ? 'text-zinc-200' : Number(strikeRate(line.runs, line.balls)) < 80 && line.balls > 10 ? 'text-zinc-500' : 'text-zinc-400'}`}>{strikeRate(line.runs, line.balls)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Bowler Strip ── */}
        <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
          <table className="w-full text-[11px]">
            <thead><tr className="text-[9px] uppercase tracking-wider text-zinc-500">
              <th className="py-1.5 pl-3 text-left font-bold">Bowler</th>
              <th className="py-1.5 w-10 text-center font-bold">O</th>
              <th className="py-1.5 w-10 text-center font-bold">M</th>
              <th className="py-1.5 w-10 text-center font-bold">R</th>
              <th className="py-1.5 w-10 text-center font-bold">W</th>
              <th className="py-1.5 pr-3 w-12 text-right font-bold">ECO</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="py-2 pl-3">
                  <div className="flex items-center gap-2">
                    <img src={getPlayerImage(currentBowler)} onError={(e) => handlePlayerImageError(e, currentBowler?.name)} className="h-7 w-7 rounded-full object-cover object-top" alt={currentBowler?.name} />
                    <span className="font-bold text-white truncate max-w-[100px]">{currentBowler?.name || '--'}</span>
                  </div>
                </td>
                <td className="py-2 text-center tabular-nums text-zinc-400">{formatOvers(bowlerLine.balls)}</td>
                <td className="py-2 text-center tabular-nums text-zinc-400">{bowlerMaidens(inning, currentBowler?.id || '')}</td>
                <td className="py-2 text-center tabular-nums text-zinc-400">{bowlerLine.runs}</td>
                <td className="py-2 text-center tabular-nums font-black text-red-400/80">{bowlerLine.wickets}</td>
                <td className={`py-2 pr-3 text-right tabular-nums font-bold ${bowlerLine.balls ? ((bowlerLine.runs / (bowlerLine.balls / 6)) <= 6 ? 'text-zinc-300' : (bowlerLine.runs / (bowlerLine.balls / 6)) >= 10 ? 'text-zinc-500' : 'text-zinc-400') : 'text-zinc-400'}`}>{economy(bowlerLine.runs, bowlerLine.balls)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── This Over + Partnership + Last Wicket ── */}
        <div className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur-md px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[10px] font-bold uppercase text-zinc-500">This Over</span>
            {inning?.isFreeHitPending && <span className="animate-pulse rounded bg-red-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-[0_0_8px_rgba(239,68,68,0.6)]">Free Hit</span>}
            <div className="flex gap-1.5 flex-wrap">
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const v = currentOverBalls[i];
                const c = v === 'W' ? 'bg-red-500 text-white' : v === '6' ? 'bg-gradient-to-br from-purple-500 to-amber-400 text-white' : v === '4' ? 'bg-blue-500 text-white' : v === '0' ? 'bg-slate-800 text-slate-400' : v ? 'bg-white/15 text-white' : 'bg-white/5 text-white/20';
                return <span key={i} className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${c}`}>{v || '·'}</span>;
              })}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-400">
            <span>P'ship: <span className="text-white font-bold">{inning?.partnershipRuns || 0}</span>({inning?.partnershipBalls || 0})</span>
            {lastWicket && <span>Last Wkt: <span className="text-white">{lastWicketBatter?.name}</span> {lastWicket.score}/{lastWicket.wicket}</span>}
          </div>
        </div>

        {/* ── Captain Controls ── */}
        {((pending === 'openers' && isMyTeamBatting) ||
          (pending === 'batter' && isMyTeamBatting) ||
          (pending === 'bowler' && isMyTeamBowling) ||
          (!autoPlay && canPlayManualBall)) && (
          <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md px-3 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Captain Controls</span>
              <div className="flex items-center gap-2">
                {pending && <span className="animate-pulse text-[10px] font-bold text-white">Your call</span>}
                {!((inning as any)?.impactPlayer) && pending && (
                  <button onClick={() => setShowImpactModal(true)} className="px-2 py-1 rounded bg-zinc-800 text-[9px] font-bold uppercase text-white hover:bg-zinc-700 transition-colors">
                    Impact Player
                  </button>
                )}
              </div>
            </div>
            {(pending === 'openers' && isMyTeamBatting) && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-200 mb-1">{strikerId ? 'Select non-striker' : 'Select striker'}</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {battingSquad.map((player) => {
                    const isSel = player.id === strikerId;
                    return (
                      <button key={player.id} disabled={isSel} onClick={() => { if (!strikerId) setStrikerId(player.id); else if (strikerId !== player.id) { setNonStrikerId(player.id); setPending('bowler'); } }} className={`w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${isSel ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-800/50 bg-white/[.03] active:bg-white/10'}`}>
                        <img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player.name)} className="h-7 w-7 rounded-full object-cover object-top" alt={player.name} />
                        <span className="flex-1 text-xs font-bold truncate">{player.name}</span>
                        <span className="text-[10px] text-zinc-500">{player.role}</span>
                        <span className="text-xs font-black text-white w-6 text-right">{player.stats.batting}</span>
                        {isSel && <span className="text-[9px] font-black text-zinc-300">STR</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {(pending === 'batter' && isMyTeamBatting) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-red-300 mb-1"><span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />Wicket! Choose next batter</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectableBatters.map((player, i) => (
                    <button key={player.id} onClick={() => { if (pendingBatterEnd === 'non-striker') setNonStrikerId(player.id); else setStrikerId(player.id); setPending(queueBowlerAfterBatter ? 'bowler' : null); setQueueBowlerAfterBatter(false); }} className="w-full flex items-center gap-2 rounded-lg border border-zinc-800/50 bg-white/[.03] px-2.5 py-1.5 text-left active:bg-white/10">
                      <img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player.name)} className="h-7 w-7 rounded-full object-cover object-top" alt={player.name} />
                      <span className="flex-1 text-xs font-bold truncate">{player.name}</span>
                      <span className="text-[10px] text-zinc-500">{player.role}</span>
                      <span className="text-xs font-black text-white w-6 text-right">{player.stats.batting}</span>
                      {i === 0 && <span className="text-[8px] font-black text-zinc-300 bg-zinc-700/50 rounded px-1">REC</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {(pending === 'bowler' && isMyTeamBowling) && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-zinc-200 mb-1">Choose bowler</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {selectableBowlers.map((player, i) => {
                    const bLine = inning?.bowlers[player.id];
                    return (
                      <button key={player.id} onClick={() => { setBowlerId(player.id); setPending(null); }} className="w-full flex items-center gap-2 rounded-lg border border-zinc-800/50 bg-white/[.03] px-2.5 py-1.5 text-left active:bg-white/10">
                        <img src={getPlayerImage(player)} onError={(e) => handlePlayerImageError(e, player.name)} className="h-7 w-7 rounded-full object-cover object-top" alt={player.name} />
                        <span className="flex-1 text-xs font-bold truncate">{player.name}</span>
                        {bLine && <span className="text-[10px] text-zinc-500 tabular-nums">{formatOvers(bLine.balls)}ov</span>}
                        <span className="text-xs font-black text-white w-6 text-right">{player.stats.bowling}</span>
                        {i === 0 && <span className="text-[8px] font-black text-zinc-300 bg-zinc-700/50 rounded px-1">REC</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!pending && canPlayManualBall && (
              <button onClick={() => setManualBallRequests((v) => v + 1)} className="w-full rounded-lg bg-white py-2.5 text-center text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-colors">
                Next Ball ▶
              </button>
            )}
          </div>
        )}

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
                onClick={() => setGameState(GameState.LEAGUE)}
                className="w-full py-4 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl font-bold tracking-wide transition-all active:scale-95"
              >
                Return to League
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
