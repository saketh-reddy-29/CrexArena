import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchEngine } from '../lib/matchEngine';
import { 
  PitchType, 
  WeatherCondition, 
  TossDecision, 
  InningsData, 
  BallOutcome,
  MatchStatus
} from '../types/match';
import { ArrowLeft, Target, Layout, ListOrdered, Radio, History } from 'lucide-react';
import { cn } from '../lib/utils';
import CricketActionVisualizer from './CricketActionVisualizer';
import { ArenaFormat } from '../engine/models/ArenaState';

function formatOvers(overs: number, balls: number) {
  return `${overs}.${balls}`;
}

function totalLegalBalls(overs: number, balls: number) {
  return overs * 6 + balls;
}

export default function MatchSimulation() {
  const { currentMatchId, fixtures, franchises, players, updateMatchResult, setGameState, selectedSquadIds, playingXIIds, selectedFranchiseId, currentMatchToss, selectedFormat } = useGameStore();
  const currentMatch = fixtures.find(f => f.id === currentMatchId);
  const team1 = franchises.find(f => f.id === currentMatch?.team1Id);
  const team2 = franchises.find(f => f.id === currentMatch?.team2Id);
  const userTeam = franchises.find(f => f.id === selectedFranchiseId);
  const format = selectedFormat || 'T20';
  const matchMaxOvers = MatchEngine.getOversPerMatch(format);
  const bowlerMaxBalls = MatchEngine.getMaxOversPerBowler(format) * 6;
  const matchMaxBalls = matchMaxOvers * 6;

  // Match State
  const [activeTab, setActiveTab] = useState<'info' | 'live' | 'scorecard'>('live');
  const [pitch, setPitch] = useState<PitchType>(MatchEngine.generatePitch());
  const [weather, setWeather] = useState<WeatherCondition>(MatchEngine.generateWeather());
  const [toss, setToss] = useState<{ winnerId: string; decision: TossDecision } | null>(null);
  const [innings1, setInnings1] = useState<InningsData | null>(null);
  const [innings2, setInnings2] = useState<InningsData | null>(null);
  const [currentInnings, setCurrentInnings] = useState<1 | 2>(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [commentary, setCommentary] = useState<string[]>([]);
  const [lastBall, setLastBall] = useState<BallOutcome | null>(null);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [currentBowlerId, setCurrentBowlerId] = useState<string | null>(null);
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string | null>(null);
  const [pendingUserAction, setPendingUserAction] = useState<'pick-openers' | 'pick-batter' | 'pick-bowler' | null>(null);
  const [recentOutcomes, setRecentOutcomes] = useState<string[]>([]);
  const [nextBatIdx, setNextBatIdx] = useState<number>(2);

  const matchEnded = useRef(false);

  useEffect(() => {
    if (!innings1) {
      const matchStateKey = `match-sim-v2-${currentMatchId}`;
      const saved = localStorage.getItem(matchStateKey);
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setPitch(data.pitch);
          setWeather(data.weather);
          setToss(data.toss);
          setInnings1(data.innings1);
          setInnings2(data.innings2);
          setCurrentInnings(data.currentInnings);
          setCommentary(data.commentary);
          setLastBall(data.lastBall);
          setStrikerId(data.strikerId);
          setNonStrikerId(data.nonStrikerId);
          setCurrentBowlerId(data.currentBowlerId);
          setLastOverBowlerId(data.lastOverBowlerId);
          setPendingUserAction(data.pendingUserAction);
          setRecentOutcomes(data.recentOutcomes || []);
          setNextBatIdx(data.nextBatIdx || 2);
          matchEnded.current = data.matchEnded || false;
          setIsSimulating(true);
          return;
        } catch(e) {}
      }

      // Use the toss result from the store
      const res = currentMatchToss || MatchEngine.simulateToss(team1!.id, team2!.id);
      setToss(res);
      const batFirstId = res.decision === TossDecision.BAT ? res.winnerId : (res.winnerId === team1!.id ? team2!.id : team1!.id);
      const bowlFirstId = batFirstId === team1!.id ? team2!.id : team1!.id;
      
      setInnings1(MatchEngine.createEmptyInnings(batFirstId, bowlFirstId));
      setInnings2(MatchEngine.createEmptyInnings(bowlFirstId, batFirstId));

      const batSquad = getSquad(batFirstId);
      const bowlSquad = getSquad(bowlFirstId);
      
      if (batFirstId === userTeam?.id) {
          setPendingUserAction('pick-openers');
          // AI picks bowler using proper bowler order
          const bowlerOrder = MatchEngine.getBowlerOrder(bowlSquad.map(p => p.id), players);
          setCurrentBowlerId(bowlerOrder[0]?.id || bowlSquad[0]?.id); 
          setLastOverBowlerId(null);
      } else if (bowlFirstId === userTeam?.id) {
          setStrikerId(batSquad[0]?.id || null);
          setNonStrikerId(batSquad[1]?.id || null);
          setLastOverBowlerId(null);
          setPendingUserAction('pick-bowler');
      } else {
          setStrikerId(batSquad[0]?.id || null);
          setNonStrikerId(batSquad[1]?.id || null);
          const bowlerOrder = MatchEngine.getBowlerOrder(bowlSquad.map(p => p.id), players);
          setCurrentBowlerId(bowlerOrder[0]?.id || bowlSquad[0]?.id);
          setLastOverBowlerId(null);
      }
      
      // Let's add an initial commentary about the toss
      const tossWinner = franchises.find(f => f.id === res.winnerId);
      setCommentary([`${tossWinner?.name} won the toss and elected to ${res.decision.toLowerCase()} first.`]);

      setIsSimulating(true);
    }
  }, []);

  const getSquad = (teamId: string) => {
    const isUser = teamId === userTeam?.id;
    let squadIds: string[] = [];
    
    if (isUser && playingXIIds && playingXIIds.length === 11) {
        squadIds = playingXIIds;
    } else {
        const team = franchises.find(f => f.id === teamId);
        squadIds = team?.squad.slice(0, 11) || [];
    }
    return MatchEngine.orderSquad(squadIds, players);
  };

  useEffect(() => {
    if (!isSimulating || !currentMatchId) return;
    const matchStateKey = `match-sim-v2-${currentMatchId}`;
    localStorage.setItem(matchStateKey, JSON.stringify({
        pitch, weather, toss, innings1, innings2, currentInnings, commentary, lastBall, strikerId, nonStrikerId, currentBowlerId, lastOverBowlerId, pendingUserAction, recentOutcomes, nextBatIdx, matchEnded: matchEnded.current
    }));
  }, [pitch, weather, toss, innings1, innings2, currentInnings, commentary, lastBall, strikerId, nonStrikerId, currentBowlerId, lastOverBowlerId, pendingUserAction, recentOutcomes, nextBatIdx, isSimulating, currentMatchId]);

  useEffect(() => {
    if (!isSimulating || matchEnded.current || pendingUserAction) return;
    const interval = setInterval(() => simulateBall(), 2000);
    return () => clearInterval(interval);
  }, [isSimulating, currentInnings, innings1, innings2, strikerId, nonStrikerId, currentBowlerId, pendingUserAction]);

  // Ensure scorecard rows exist as soon as players take the field.
  useEffect(() => {
    const innings = currentInnings === 1 ? innings1 : innings2;
    if (!innings) return;

    const needsStriker = !!strikerId && !innings.batsmen[strikerId];
    const needsNonStriker = !!nonStrikerId && !innings.batsmen[nonStrikerId];
    const needsBowler = !!currentBowlerId && !innings.bowlers[currentBowlerId];

    if (!needsStriker && !needsNonStriker && !needsBowler) return;

    const updatedInnings: InningsData = {
      ...innings,
      batsmen: { ...innings.batsmen },
      bowlers: { ...innings.bowlers },
    };

    if (strikerId) MatchEngine.getPlayerStats(strikerId, updatedInnings.batsmen);
    if (nonStrikerId) MatchEngine.getPlayerStats(nonStrikerId, updatedInnings.batsmen);
    if (currentBowlerId) MatchEngine.getPlayerStats(currentBowlerId, updatedInnings.bowlers);

    if (currentInnings === 1) setInnings1(updatedInnings);
    else setInnings2(updatedInnings);
  }, [currentInnings, innings1, innings2, strikerId, nonStrikerId, currentBowlerId]);

  // Auto-resolve pending user actions so autoplay can continue without manual picks.
  useEffect(() => {
    if (!isSimulating || matchEnded.current || !pendingUserAction || !userTeam?.id) return;

    const innings = currentInnings === 1 ? innings1 : innings2;
    if (!innings) return;

    const timer = setTimeout(() => {
      const mySquad = getSquad(userTeam.id);
      if (!mySquad.length) return;

      if (pendingUserAction === 'pick-openers') {
        const first = mySquad[0]?.id || null;
        const second = mySquad.find(p => p.id !== first)?.id || null;
        if (!strikerId) setStrikerId(first);
        if (!nonStrikerId) setNonStrikerId(second);
        setPendingUserAction(null);
        return;
      }

      if (pendingUserAction === 'pick-batter') {
        const occupied = new Set<string>(Object.keys(innings.batsmen));
        if (strikerId) occupied.add(strikerId);
        if (nonStrikerId) occupied.add(nonStrikerId);

        const nextBatter = mySquad.find(p => !occupied.has(p.id)) || mySquad.find(p => p.id !== nonStrikerId) || mySquad[0];
        if (nextBatter) {
          setStrikerId(nextBatter.id);
          setPendingUserAction(null);
        }
        return;
      }

      if (pendingUserAction === 'pick-bowler') {
        const ordered = MatchEngine.getBowlerOrder(mySquad.map(p => p.id), players);
        const valid = ordered.find(p => {
          const s = innings.bowlers[p.id];
          const overs = s?.overs || 0;
          const balls = s?.balls || 0;
          const hasOversLeft = totalLegalBalls(overs, balls) < bowlerMaxBalls;
          const notConsecutive = p.id !== lastOverBowlerId;
          return hasOversLeft && notConsecutive;
        }) || ordered.find(p => p.id !== lastOverBowlerId) || ordered[0];

        if (valid) {
          setCurrentBowlerId(valid.id);
          setPendingUserAction(null);
        }
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [
    isSimulating,
    pendingUserAction,
    userTeam?.id,
    currentInnings,
    innings1,
    innings2,
    players,
    strikerId,
    nonStrikerId,
    lastOverBowlerId,
  ]);

  const simulateBall = () => {
    const innings = currentInnings === 1 ? innings1! : innings2!;
    const battingSquad = getSquad(innings.battingTeamId);
    const bowlingSquad = getSquad(innings.bowlingTeamId);
    
    if (!strikerId || !nonStrikerId || !currentBowlerId) return;

    const currentBatsman = players.find(p => p.id === strikerId)!;
    const currentBowler = players.find(p => p.id === currentBowlerId)!;

    const requiredRate = currentInnings === 2 
        ? ((innings1!.runs + 1 - innings.runs) / (Math.max(1, matchMaxBalls - (innings.overs * 6 + innings.balls)) / 6))
        : 8;

    // Update Innings
    const updatedInnings = { ...innings };
    
    // Update Batsman Stats
    const strikerStats = MatchEngine.getPlayerStats(strikerId, updatedInnings.batsmen);
    const bowlerStats = MatchEngine.getPlayerStats(currentBowler.id, updatedInnings.bowlers);
    
    // Simulate ball using the updated stats
    const currentOverProgress = innings.overs + innings.balls / 6;
    const { selectedFormat } = useGameStore.getState();
    const ball = MatchEngine.simulateBall(currentBatsman, currentBowler, currentOverProgress, innings.wickets, requiredRate, pitch, weather, strikerStats, bowlerStats, recentOutcomes, false, 0, selectedFormat || 'T20');
    const isLegalDelivery = ball.extraType !== 'Wide' && ball.extraType !== 'No Ball';
    const batterRuns = ball.isExtra ? 0 : ball.runs;

    // Track recent outcomes for the engine's recent-wicket modifier
    if (isLegalDelivery) {
      setRecentOutcomes(prev => [...prev.slice(-23), ball.isWicket ? 'W' : ball.isExtra ? (ball.extraType === 'Wide' ? 'Wd' : 'Nb') : String(ball.runs)]);
    }
    setLastBall(ball);
    setCommentary(prev => [`${innings.overs}.${innings.balls + 1} ${ball.commentary}`, ...prev]);

    if (isLegalDelivery) strikerStats.balls += 1;
    strikerStats.runs += batterRuns;
    
    if (!strikerStats.momentum) strikerStats.momentum = 0;
    if (!bowlerStats.momentum) bowlerStats.momentum = 0;
    strikerStats.wicketBurst = Math.max(0, (strikerStats.wicketBurst || 0) - 0.2);
    
    if (ball.runs === 4 && !ball.isExtra) {
        strikerStats.fours += 1;
        strikerStats.momentum += 5;
        bowlerStats.momentum -= 2;
        strikerStats.ballsSinceBoundary = 0;
    }
    if (ball.runs === 6 && !ball.isExtra) {
        strikerStats.sixes += 1;
        strikerStats.momentum += 8;
        bowlerStats.momentum -= 3;
        strikerStats.ballsSinceBoundary = 0;
    }
    if (ball.runs === 0 && !ball.isExtra) {
        strikerStats.momentum -= 2;
        bowlerStats.momentum += 2;
        strikerStats.dots += 1;
        strikerStats.consecutiveDots = (strikerStats.consecutiveDots || 0) + 1;
    } else if (!ball.isExtra) {
        strikerStats.consecutiveDots = 0;
        strikerStats.ballsSinceBoundary = (strikerStats.ballsSinceBoundary || 0) + 1;
    }
    
    if (ball.isWicket) {
        bowlerStats.momentum += 10;
        strikerStats.momentum = 0;
        strikerStats.wicketBurst = (strikerStats.wicketBurst || 0) + 1;
    }

    // Update Bowler Stats
    if (isLegalDelivery) {
        bowlerStats.balls = (bowlerStats.balls || 0) + 1;
        if (bowlerStats.balls === 6) {
            bowlerStats.overs += 1;
            bowlerStats.balls = 0;
            bowlerStats.lastOverRuns = 0;
        }
    }
    bowlerStats.runsConceded += ball.runs;
    bowlerStats.lastOverRuns = (bowlerStats.lastOverRuns || 0) + ball.runs;
    if (ball.runs === 0 && !ball.isExtra) bowlerStats.dots += 1;
    if (ball.isWicket && !ball.isExtra) bowlerStats.wickets += 1;

    updatedInnings.runs += ball.runs;
    if (ball.isExtra) {
      if (ball.extraType === 'Wide') updatedInnings.extras.wides += 1;
      if (ball.extraType === 'No Ball') updatedInnings.extras.noBalls += 1;
    } else if (ball.runs % 2 !== 0) {
      setStrikerId(nonStrikerId);
      setNonStrikerId(strikerId);
    }

    if (ball.isWicket) {
      updatedInnings.wickets += 1;
      updatedInnings.fallOfWickets.push({ score: updatedInnings.runs, wicket: updatedInnings.wickets, over: updatedInnings.overs });
      if (updatedInnings.wickets < 10) {
        if (updatedInnings.battingTeamId === userTeam?.id) {
            setPendingUserAction('pick-batter');
            setStrikerId(null);
        } else {
            const nextBat = battingSquad[nextBatIdx] || battingSquad[0];
            setStrikerId(nextBat.id);
            setNextBatIdx(nextBatIdx + 1);
        }
      }
    }

    if (isLegalDelivery) {
        updatedInnings.balls += 1;
      if (updatedInnings.balls === 6) {
        setLastOverBowlerId(currentBowlerId);
        updatedInnings.overs += 1;
        updatedInnings.balls = 0;
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
        
        if (updatedInnings.wickets < 10) {
            if (updatedInnings.bowlingTeamId === userTeam?.id) {
                setCurrentBowlerId(null);
                setPendingUserAction('pick-bowler');
            } else {
                // Enforce strict top 6 bowlers for auto-selection (avoids pure batters bowling)
                const bowlerOrder = MatchEngine.getBowlerOrder(bowlingSquad.map(p => p.id), players);
                const activeBowlers = bowlerOrder.slice(0, 6);
                
                let nextBowlerId = null;
                // Try to find an eligible top bowler using rotation
                for (let i = 0; i < activeBowlers.length; i++) {
                   const candidate = activeBowlers[(updatedInnings.overs + i) % activeBowlers.length];
                   const stats = updatedInnings.bowlers[candidate.id];
                   const ballsBowled = stats ? (stats.overs * 6 + (stats.balls || 0)) : 0;
                   
                   if (candidate.id !== currentBowlerId && ballsBowled < bowlerMaxBalls) {
                       nextBowlerId = candidate.id;
                       break;
                   }
                }
                
                // Fallback if all top 6 bowlers have finished their quotas (e.g. T20 requires 5 bowlers minimum, but someone could get injured or if there's a bug)
                if (!nextBowlerId) {
                   const fallback = bowlerOrder.find(b => {
                       if (b.id === currentBowlerId) return false;
                       const stats = updatedInnings.bowlers[b.id];
                       const ballsBowled = stats ? (stats.overs * 6 + (stats.balls || 0)) : 0;
                       return ballsBowled < bowlerMaxBalls;
                   });
                   nextBowlerId = fallback?.id || bowlingSquad[0]?.id;
                }
                
                setCurrentBowlerId(nextBowlerId);
            }
        }
      }
    }

    if (currentInnings === 1) {
      setInnings1(updatedInnings);
      if (updatedInnings.overs === matchMaxOvers || updatedInnings.wickets === 10) {
        setCurrentInnings(2);
        setCurrentBowlerId(null);
        setLastOverBowlerId(null);
        setStrikerId(null);
        setNonStrikerId(null);
        setRecentOutcomes([]);
        setNextBatIdx(2);
        const batSquad2 = getSquad(updatedInnings.bowlingTeamId);
        const bowlSquad2 = getSquad(updatedInnings.battingTeamId);
        
        if (updatedInnings.bowlingTeamId === userTeam?.id) {
            setPendingUserAction('pick-openers');
            const bowlerOrder2 = MatchEngine.getBowlerOrder(bowlSquad2.map(p => p.id), players);
            setCurrentBowlerId(bowlerOrder2[0]?.id || bowlSquad2[0]?.id);
        } else if (updatedInnings.battingTeamId === userTeam?.id) {
            setStrikerId(batSquad2[0]?.id || null);
            setNonStrikerId(batSquad2[1]?.id || null);
            setPendingUserAction('pick-bowler');
        } else {
            setStrikerId(batSquad2[0]?.id || null);
            setNonStrikerId(batSquad2[1]?.id || null);
            const bowlerOrder2 = MatchEngine.getBowlerOrder(bowlSquad2.map(p => p.id), players);
            setCurrentBowlerId(bowlerOrder2[0]?.id || bowlSquad2[0]?.id);
        }
      }
    } else {
      setInnings2(updatedInnings);
      if (updatedInnings.runs > innings1!.runs) {
        endMatch(updatedInnings.battingTeamId, updatedInnings, innings1!);
      } else if (updatedInnings.overs === matchMaxOvers || updatedInnings.wickets === 10) {
        endMatch(innings1!.battingTeamId, innings1!, updatedInnings);
      }
    }
  };

  const endMatch = (winnerId: string, winInn: InningsData, loseInn: InningsData) => {
    if (matchEnded.current) return;
    matchEnded.current = true;
    setIsSimulating(false);
    localStorage.removeItem(`match-sim-v2-${currentMatchId}`);
    setTimeout(() => {
        updateMatchResult(currentMatchId!, {
            team1Id: team1!.id,
            team2Id: team2!.id,
            innings: [innings1!, innings2!],
            winnerId,
            margin: winnerId === winInn.battingTeamId ? `${10 - winInn.wickets} wickets` : `${winInn.runs - loseInn.runs} runs`
        });
        setGameState(GameState.ARENA_HUB);
    }, 5000);
  };

  const activeInnings = currentInnings === 1 ? innings1 : innings2;
  const battingTeam = franchises.find(f => f.id === activeInnings?.battingTeamId);
  const bowlingTeam = franchises.find(f => f.id === activeInnings?.bowlingTeamId);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
      {/* Ambient effects & Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-40 pointer-events-none mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col flex-1">
      {/* CREX STYLE HEADER */}
      <div className="bg-[#0f1629]/60 backdrop-blur-md p-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-4">
            <button onClick={() => setGameState(GameState.ARENA_HUB)}><ArrowLeft className="w-5 h-5 text-white/60" /></button>
            <span className="text-sm font-bold opacity-60 uppercase tracking-widest">{team1?.name} vs {team2?.name}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-[10px] font-black uppercase animate-pulse">
            Live
        </div>
      </div>

      <div className="bg-[#0f1629]/90 backdrop-blur-xl border-t border-white/5 flex flex-col items-center py-6 px-12 text-center shadow-xl">
            <div className="flex items-center gap-12 mb-4">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full mb-2 bg-blue-500 border-2 border-white/10" />
                    <span className="text-2xl font-black">{activeInnings?.runs}/{activeInnings?.wickets}</span>
                    <span className="text-xs opacity-40 uppercase tracking-widest font-black">{battingTeam?.shortName}</span>
                </div>
                <div className="text-4xl font-serif italic text-white/10">VS</div>
                <div className="flex flex-col items-center opacity-40">
                    <div className="w-12 h-12 rounded-full mb-2 bg-yellow-500 border-2 border-white/10" />
                    <span className="text-2xl font-black">{currentInnings === 1 ? 'Yet to bat' : `${innings1?.runs}/${innings1?.wickets}`}</span>
                    <span className="text-xs uppercase tracking-widest font-black">{bowlingTeam?.shortName}</span>
                </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold text-white/40">
                <span>{activeInnings?.overs}.{activeInnings?.balls} OVERS</span>
                <span>â€¢</span>
                <span>CRR: {(activeInnings ? (activeInnings.runs / Math.max(0.1, activeInnings.overs + activeInnings.balls/6)).toFixed(2) : '0.00')}</span>
                {currentInnings === 2 && <span>â€¢ RRR: {((innings1!.runs + 1 - innings2!.runs) / Math.max(0.1, (120 - (innings2!.overs*6 + innings2!.balls))/6)).toFixed(2)}</span>}
            </div>
      </div>

      {/* TABS */}
      <nav className="flex bg-[#0f1629]/60 backdrop-blur-md border-b border-white/5 relative z-10">
        {[
            { id: 'info', label: 'Match Info', icon: Layout },
            { id: 'live', label: 'Live', icon: Radio },
            { id: 'scorecard', label: 'Scorecard', icon: ListOrdered }
        ].map(tab => (
            <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                    "flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all",
                    activeTab === tab.id ? "border-blue-500 text-blue-400" : "border-transparent text-white/40"
                )}
            >
                <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden flex relative">
        {pendingUserAction && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-[#0f1629]/80 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
              <h2 className="text-2xl font-serif italic mb-2">
                {pendingUserAction === 'pick-openers' && 'Select Opening Batsmen'}
                {pendingUserAction === 'pick-batter' && 'Select Next Batter'}
                {pendingUserAction === 'pick-bowler' && 'Select Bowler for Next Over'}
              </h2>
              <p className="text-white/40 mb-8 text-sm">
                {pendingUserAction === 'pick-openers' && 'Choose your striker and non-striker to start the innings.'}
                {pendingUserAction === 'pick-batter' && 'A wicket has fallen. Send in your next batsman.'}
                {pendingUserAction === 'pick-bowler' && 'Choose who will bowl the next over.'}
              </p>

              <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar mb-8">
                {(() => {
                  const mySquad = getSquad(userTeam?.id!);
                  if (pendingUserAction === 'pick-openers') {
                    // Show all batters
                    return mySquad.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          if (!strikerId) setStrikerId(p.id);
                          else if (!nonStrikerId && strikerId !== p.id) {
                            setNonStrikerId(p.id);
                            setPendingUserAction(null);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border transition-all text-left",
                          strikerId === p.id || nonStrikerId === p.id ? "bg-blue-500/20 border-blue-500" : "bg-white/5 border-white/10 hover:bg-white/10"
                        )}
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          {strikerId === p.id ? 'S' : nonStrikerId === p.id ? 'NS' : p.role[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                          <div className="text-[10px] uppercase text-white/40">{p.role}</div>
                        </div>
                      </button>
                    ));
                  }
                  
                  if (pendingUserAction === 'pick-batter') {
                    // Show available batters (not out, not currently playing)
                    const outOrPlaying = [
                        ...activeInnings?.fallOfWickets.map(f => {}), // We don't track who got out precisely yet in fallOfWickets
                        strikerId, 
                        nonStrikerId
                    ];
                    // Since we don't track exactly who got out, we'll just check if they are striker/nonStriker or have stats but are no longer playing
                    return mySquad.filter(p => p.id !== nonStrikerId && !(activeInnings?.batsmen[p.id] && p.id !== strikerId)).map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setStrikerId(p.id);
                          setPendingUserAction(null);
                        }}
                        className="flex items-center gap-4 p-4 rounded-xl border bg-white/5 border-white/10 hover:bg-white/10 transition-all text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          {p.role[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                          <div className="text-[10px] uppercase text-white/40">{p.role}</div>
                        </div>
                      </button>
                    ));
                  }

                  if (pendingUserAction === 'pick-bowler') {
                    // Show top 6 bowlers only
                    const bowlingOrdered = MatchEngine.getBowlerOrder(mySquad.map(p => p.id), players).slice(0, 6);
                    return bowlingOrdered.map(p => {
                      const bowlerStats = activeInnings?.bowlers[p.id];
                      const oversBowled = bowlerStats?.overs || 0;
                      const ballsBowled = bowlerStats?.balls || 0;
                      const isLastBowler = lastOverBowlerId === p.id;
                      const isDisabled = totalLegalBalls(oversBowled, ballsBowled) >= bowlerMaxBalls || isLastBowler;
                      return (
                        <button
                          key={p.id}
                          disabled={isDisabled}
                          onClick={() => {
                            setCurrentBowlerId(p.id);
                            setPendingUserAction(null);
                          }}
                          className={cn(
                             "flex items-center gap-4 p-4 rounded-xl border bg-white/5 border-white/10 transition-all text-left relative",
                             isDisabled ? "opacity-30 cursor-not-allowed" : "hover:bg-white/10"
                          )}
                        >
                        {isLastBowler && <div className="absolute top-2 right-2 text-[8px] uppercase tracking-widest text-red-400 font-bold">Just Bowled</div>}
                        {totalLegalBalls(oversBowled, ballsBowled) >= bowlerMaxBalls && <div className="absolute top-2 right-2 text-[8px] uppercase tracking-widest text-white/40 font-bold">Max Overs</div>}
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          {p.role[0]}
                        </div>
                        <div>
                          <div className="font-bold text-sm whitespace-nowrap overflow-hidden text-ellipsis">{p.name}</div>
                          <div className="text-[10px] uppercase text-white/40">{p.role} • {formatOvers(oversBowled, ballsBowled)} overs</div>
                        </div>
                      </button>
                      );
                    });
                  }
                  
                })()}
              </div>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait">
            {activeTab === 'live' && (
                <motion.div 
                    key="live"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex-1 overflow-y-auto p-4 flex flex-col lg:flex-row gap-6 max-h-[calc(100vh-250px)]"
                >
                    {/* LEFT: VISUALIZER & COMMENTARY */}
                    <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                        <CricketActionVisualizer
                          striker={players.find(p => p.id === strikerId) || null}
                          nonStriker={players.find(p => p.id === nonStrikerId) || null}
                          bowler={players.find(p => p.id === currentBowlerId) || null}
                          lastBall={lastBall ? { ...lastBall, runs: lastBall.runs || 0 } : null}
                          ballCount={activeInnings?.balls || 0}
                          format={(format as ArenaFormat) || 'T20'}
                          battingTeamName={activeInnings?.battingTeamId === team1?.id ? team1?.name || '' : team2?.name || ''}
                          bowlingTeamName={activeInnings?.bowlingTeamId === team1?.id ? team1?.name || '' : team2?.name || ''}
                          isFreeHit={Boolean(activeInnings?.isFreeHitPending)}
                        />
                        {commentary.map((line, i) => (
                            <div key={i} className={cn("p-4 rounded-xl border border-white/5", i === 0 ? "bg-white/5 border-white/10" : "bg-[#0f1629]/40 backdrop-blur-md")}>
                                <div className="text-sm leading-relaxed">{line}</div>
                            </div>
                        ))}
                    </div>

                    {/* RIGHT: LIVE STATS (Batsmen/Bowler) */}
                    <div className="w-full lg:w-80 flex flex-col gap-6">
                        <div className="p-6 rounded-2xl bg-[#0f1629]/60 backdrop-blur-md border border-white/5">
                            <h3 className="text-[10px] font-black uppercase text-white/20 mb-4 tracking-widest">Batting</h3>
                            <div className="space-y-4">
                                {[strikerId, nonStrikerId].map(id => {
                                    const p = players.find(x => x.id === id);
                                    const stats = activeInnings?.batsmen[id!] || { runs: 0, balls: 0 };
                                    return (
                                        <div key={id} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/5" />
                                                <span className={cn("text-sm font-bold", id === strikerId ? "text-blue-400" : "")}>{p?.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-black italic">{stats.runs} ({stats.balls})</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="p-6 rounded-2xl bg-[#0f1629]/60 backdrop-blur-md border border-white/5">
                            <h3 className="text-[10px] font-black uppercase text-white/20 mb-4 tracking-widest">Bowling</h3>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/5" />
                                    {(() => {
                                        const p = players.find(x => x.id === currentBowlerId);
                                        const stats = currentBowlerId ? (activeInnings?.bowlers[currentBowlerId] || { wickets: 0, runsConceded: 0, overs: 0, balls: 0 }) : { wickets: 0, runsConceded: 0, overs: 0, balls: 0 };
                                        return (
                                            <>
                                                <span className="text-sm font-bold">{p?.name}</span>
                                                <div className="text-right flex-1">
                                                    <div className="text-sm font-black italic">{stats.wickets}-{stats.runsConceded} ({formatOvers(stats.overs, stats.balls || 0)})</div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {activeTab === 'scorecard' && (
                <motion.div 
                    key="scorecard"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex-1 overflow-y-auto p-4 max-h-[calc(100vh-250px)]"
                >
                    <div className="bg-[#0f1629] rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                                <tr>
                                    <th className="px-6 py-4">Batsman</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-center">R</th>
                                    <th className="px-6 py-4 text-center">B</th>
                                    <th className="px-6 py-4 text-center">4s</th>
                                    <th className="px-6 py-4 text-center">6s</th>
                                    <th className="px-6 py-4 text-right">SR</th>
                                </tr>
                            </thead>
                             <tbody className="divide-y divide-white/5">
                                {getSquad(activeInnings?.battingTeamId!).map(p => {
                                    const stats = activeInnings?.batsmen[p.id] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                                    const isOut = activeInnings?.fallOfWickets.some(f => {
                                        // This is a bit simplified, we'd need to track WHO got out
                                        // For now, let's just show runs
                                        return false;
                                    });
                                    return (
                                        <tr key={p.id} className="hover:bg-white/[0.02]">
                                            <td className="px-6 py-4 text-sm font-bold">{p.name}</td>
                                            <td className="px-6 py-4 text-xs opacity-40 italic">{isOut ? 'Out' : 'Not Out'}</td>
                                            <td className="px-6 py-4 text-center text-sm font-black">{stats.runs}</td>
                                            <td className="px-6 py-4 text-center text-xs opacity-40">{stats.balls}</td>
                                            <td className="px-6 py-4 text-center text-xs opacity-40">{stats.fours}</td>
                                            <td className="px-6 py-4 text-center text-xs opacity-40">{stats.sixes}</td>
                                            <td className="px-6 py-4 text-right text-xs opacity-40">
                                                {stats.balls > 0 ? ((stats.runs / stats.balls) * 100).toFixed(1) : '0.0'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}

