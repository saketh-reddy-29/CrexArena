import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchEngine } from '../lib/matchEngine';
import { TossDecision } from '../types/match';
import { ArrowLeft, Users, Trophy, CheckCircle2, ChevronRight, Sparkles, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { getPlayerRating } from '../lib/ratingEngine';

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

export default function PreMatch() {
  const { currentMatchId, fixtures, franchises, players, selectedFranchiseId, selectedSquadIds, playingXIIds, setSelectedSquadIds, setPlayingXIIds, setCurrentMatchToss, setCaptain, setGameState } = useGameStore();
  const isIPL = useGameStore(s => s.selectedFormat === 'IPL');
  const currentMatch = fixtures.find(f => f.id === currentMatchId);
  const userTeam = franchises.find(f => f.id === selectedFranchiseId);
  
  const team1 = franchises.find(f => f.id === currentMatch?.team1Id);
  const team2 = franchises.find(f => f.id === currentMatch?.team2Id);
  const opponentTeam = team1?.id === userTeam?.id ? team2 : team1;

  React.useEffect(() => {
    if (!userTeam || !opponentTeam) {
      setGameState(GameState.LANDING);
    }
  }, [userTeam, opponentTeam, setGameState]);

  if (!userTeam || !opponentTeam) return null;

  // Enforce squad selection BEFORE the toss only
  const [step, setStep] = useState<'squad' | 'toss'>('squad');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [tossResult, setTossResult] = useState<{ winnerId: string; decision: TossDecision | null } | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  // For international: use selectedSquadIds (15-man) or fallback. For IPL: use franchise.squad.
  const teamPlayers = useMemo(() => {
    if (isIPL) {
      return players.filter(p => userTeam?.squad?.includes(p.id));
    }
    if (selectedSquadIds && selectedSquadIds.length > 0) {
      const selected = players.filter(p => selectedSquadIds.includes(p.id));
      if (selected.length > 0) return selected;
    }
    const intended = players.filter(p => p.intendedTeamId === userTeam?.id);
    if (intended.length > 0) return intended;
    return players.filter(p => userTeam?.squad?.includes(p.id));
  }, [isIPL, players, userTeam, selectedSquadIds]);

  const autoSelectSquad = () => {
    const activeFormat = (useGameStore.getState().selectedFormat) || 'T20';
    const ratePlayer = (p: typeof players[0]) => getPlayerRating(p, activeFormat);
    const sorted = [...teamPlayers].sort((a, b) => ratePlayer(b) - ratePlayer(a));

    const keepers = sorted.filter(p => p.role === 'Wicketkeeper');
    const batsmen = sorted.filter(p => p.role === 'Batsman');
    const allrounders = sorted.filter(p => p.role === 'All-rounder');
    const bowlers = sorted.filter(p => p.role === 'Bowler');

    const selected: string[] = [];
    
    // Pick 1 Wicketkeeper
    if (keepers[0]) selected.push(keepers[0].id);

    // Pick top 4 batsmen
    selected.push(...batsmen.filter(p => !selected.includes(p.id)).slice(0, 4).map(p => p.id));

    // Pick top 2 all-rounders
    selected.push(...allrounders.filter(p => !selected.includes(p.id)).slice(0, 2).map(p => p.id));

    // Pick top 4 bowlers
    selected.push(...bowlers.filter(p => !selected.includes(p.id)).slice(0, 4).map(p => p.id));

    // Fill remaining up to 11
    if (selected.length < 11) {
      for (const p of sorted) {
        if (selected.length >= 11) break;
        if (!selected.includes(p.id)) {
          selected.push(p.id);
        }
      }
    }

    setSelectedIds(selected.slice(0, 11));

    if (userTeam?.captainId && selected.includes(userTeam.captainId)) {
      setCaptainId(userTeam.captainId);
    } else {
      const best = teamPlayers.filter(p => selected.includes(p.id)).sort((a, b) => ratePlayer(b) - ratePlayer(a))[0];
      if (best) setCaptainId(best.id);
    }
  };

  React.useEffect(() => {
    if (teamPlayers.length === 0) return;
    if (selectedIds.length === 0) {
      const existing = playingXIIds.filter(id => teamPlayers.some(p => p.id === id));
      if (existing.length === 11) {
        setSelectedIds(existing);
        if (userTeam?.captainId && existing.includes(userTeam.captainId)) {
          setCaptainId(userTeam.captainId);
        } else {
          const best = teamPlayers.filter(p => existing.includes(p.id)).sort((a, b) => b.rating - a.rating)[0];
          if (best) setCaptainId(best.id);
        }
      } else {
        autoSelectSquad();
      }
    }
  }, [teamPlayers]);

  const togglePlayer = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
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
        const winnerId = Math.random() > 0.5 ? userTeam?.id! : opponentTeam?.id!;
        const opponentDecision = winnerId !== userTeam?.id ? (Math.random() > 0.5 ? TossDecision.BAT : TossDecision.BOWL) : null;
        setTossResult({ winnerId, decision: opponentDecision });
    }, 2000);
  };

  const handleDecision = (decision: TossDecision) => {
    setTossResult(prev => prev ? { ...prev, decision } : null);
  };

  const proceedToToss = () => {
    if (selectedIds.length !== 11) return;
    const activeFormat = (useGameStore.getState().selectedFormat) || 'T20';
    let effectiveCaptain = captainId;
    if (!effectiveCaptain || !selectedIds.includes(effectiveCaptain)) {
      const best = teamPlayers.filter(p => selectedIds.includes(p.id)).sort((a, b) => getPlayerRating(b, activeFormat) - getPlayerRating(a, activeFormat))[0];
      effectiveCaptain = best ? best.id : selectedIds[0];
      setCaptainId(effectiveCaptain);
    }
    if (userTeam && effectiveCaptain) {
      setCaptain(userTeam.id, effectiveCaptain);
    }
    setPlayingXIIds(selectedIds);
    setStep('toss');
  };

  const startMatch = () => {
    if (userTeam && captainId) {
        setCaptain(userTeam.id, captainId);
    }
    if (tossResult && tossResult.decision) {
        setCurrentMatchToss({ winnerId: tossResult.winnerId, decision: tossResult.decision });
    }
    setPlayingXIIds(selectedIds);
    setGameState(GameState.MATCH_SIMULATION);
  };

  if (!userTeam || !opponentTeam) return null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex flex-col relative overflow-hidden">
      {/* Ambient effects & Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-40 pointer-events-none mix-blend-luminosity" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/20 pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[5%] w-[45%] h-[45%] rounded-full bg-zinc-800/20 blur-[100px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[35%] h-[35%] rounded-full bg-zinc-800/15 blur-[80px]" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => setGameState(GameState.ARENA_HUB)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
                <img src={resolveTeamLogo(userTeam)} alt={userTeam.shortName} className="w-6 h-6 object-contain" />
                <span className="text-sm font-bold hidden sm:inline truncate">{userTeam.name}</span>
            </div>
            <span className="text-[10px] font-bold text-white/20">VS</span>
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold hidden sm:inline truncate">{opponentTeam.name}</span>
                <img src={resolveTeamLogo(opponentTeam)} alt={opponentTeam.shortName} className="w-6 h-6 object-contain" />
            </div>
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {step === 'squad' ? (
            <motion.div 
              key="squad"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-0.5">Pre-Toss Squad Finalization</div>
                  <h1 className="text-lg font-bold">Select Playing XI</h1>
                  <p className="text-xs text-white/40">Select 11 players and designate a captain before the toss</p>
                </div>
                <button 
                  onClick={autoSelectSquad}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30 text-xs font-bold transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto Pick XI
                </button>
              </div>

              <div className="space-y-2 mb-4 max-h-[55vh] overflow-y-auto scrollbar-hide">
                {teamPlayers.map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                      selectedIds.includes(p.id) 
                        ? "bg-white/5 border-white/30" 
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                    )}
                  >
                    <button
                      onClick={() => togglePlayer(p.id)}
                      className="flex-1 flex items-center gap-3 text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                          {selectedIds.includes(p.id) ? (
                              <CheckCircle2 className="w-4 h-4 text-white" />
                          ) : (
                              <JerseyPlayerImage 
                                player={p}
                                franchiseId={selectedFranchiseId}
                                className="h-full w-full bg-zinc-800"
                                imageClassName="h-full w-full"
                              />
                          )}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        {captainId === p.id && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[10px] font-black leading-none">C</span>
                        )}
                        <div className="text-[10px] text-white/30 font-medium">{p.role}</div>
                      </div>
                      <div className="text-xs font-bold text-white/30 px-2">{p.rating}</div>
                    </button>
                    {selectedIds.includes(p.id) && captainId !== p.id && (
                        <button
                            onClick={() => setCaptainId(p.id)}
                            className="px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-[9px] font-bold uppercase tracking-wider shrink-0 transition-colors"
                        >
                            Make Captain
                        </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom sticky CTA */}
              <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60 -mx-4 px-4 py-3 sm:-mx-6 sm:px-6 safe-bottom">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{selectedIds.length}</span>
                    <span className="text-xs text-zinc-500 font-bold">/ 11 selected</span>
                    {captainId && (
                      <span className="text-xs text-amber-400 font-bold ml-2">
                        (C: {teamPlayers.find(p => p.id === captainId)?.name?.split(' ').pop()})
                      </span>
                    )}
                  </div>
                  <button
                    disabled={selectedIds.length !== 11}
                    onClick={proceedToToss}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm disabled:opacity-30 disabled:pointer-events-none active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Proceed to Toss <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="toss"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center"
            >
              {/* Squad Locked Status Badge */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Playing XI Locked ({selectedIds.length} players · C: {teamPlayers.find(p => p.id === captainId)?.name})</span>
                  {!tossResult && !isFlipping && (
                    <button
                      onClick={() => setStep('squad')}
                      className="ml-2 text-blue-400 hover:text-blue-300 font-bold underline text-[11px]"
                    >
                      Edit XI
                    </button>
                  )}
                </div>
              </div>

              {/* VS Screen inside Toss */}
              <div className="flex items-center justify-center gap-6 mb-12">
                <div className="flex flex-col items-center gap-3 w-32">
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <img src={resolveTeamLogo(userTeam)} alt={userTeam.name} className="w-16 h-16 object-contain relative z-10 drop-shadow-md" />
                  </div>
                  <span className="text-sm font-black tracking-tight text-center leading-tight drop-shadow-md">{userTeam.name}</span>
                </div>
                
                <div className="flex flex-col items-center justify-center -mt-8">
                  <div className="text-3xl font-black text-white/30 italic tracking-widest drop-shadow-sm">VS</div>
                </div>
                
                <div className="flex flex-col items-center gap-3 w-32">
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.05)] backdrop-blur-md relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <img src={resolveTeamLogo(opponentTeam)} alt={opponentTeam.name} className="w-16 h-16 object-contain relative z-10 drop-shadow-md" />
                  </div>
                  <span className="text-sm font-black tracking-tight text-center leading-tight drop-shadow-md">{opponentTeam.name}</span>
                </div>
              </div>

              {!tossResult ? (
                <div className="flex flex-col items-center">
                  <h1 className="text-2xl font-bold mb-8 text-white drop-shadow-lg tracking-tight">The Toss</h1>
                  <div style={{ perspective: "1200px" }} className="w-40 h-40 mx-auto mb-6 relative cursor-pointer" onClick={!isFlipping ? handleToss : undefined}>
                    <motion.div
                      animate={isFlipping ? { rotateY: 1800 + (Math.random() > 0.5 ? 0 : 180), y: [-30, -120, 0] } : { rotateY: 0 }}
                      transition={{ duration: 2.5, ease: "easeInOut" }}
                      style={{ transformStyle: "preserve-3d" }}
                      className="w-full h-full relative"
                    >
                      {/* HEADS (Front) */}
                      <div 
                        className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.8)] border-[6px] border-yellow-600/60"
                        style={{ 
                          backfaceVisibility: "hidden", 
                          background: 'radial-gradient(ellipse at top left, #FDE047 0%, #EAB308 30%, #A16207 100%)'
                        }}
                      >
                        <div className="w-[85%] h-[85%] rounded-full border border-yellow-600/30 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -rotate-45" />
                          <span className="text-6xl font-black text-yellow-900 tracking-tighter drop-shadow-sm">H</span>
                        </div>
                      </div>
                      
                      {/* TAILS (Back) */}
                      <div 
                        className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-[0_20px_40px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(0,0,0,0.8)] border-[6px] border-yellow-600/60"
                        style={{ 
                          backfaceVisibility: "hidden", 
                          transform: "rotateY(180deg)",
                          background: 'radial-gradient(ellipse at top left, #FDE047 0%, #EAB308 30%, #A16207 100%)'
                        }}
                      >
                        <div className="w-[85%] h-[85%] rounded-full border border-yellow-600/30 flex items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent -rotate-45" />
                          <span className="text-6xl font-black text-yellow-900 tracking-tighter drop-shadow-sm">T</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                  <button
                    onClick={!isFlipping ? handleToss : undefined}
                    disabled={isFlipping}
                    className="mt-4 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    {isFlipping ? 'Flipping...' : 'Flip Coin'}
                  </button>
                  <p className="text-[11px] text-white/40 uppercase tracking-widest font-semibold mt-2">or tap coin directly</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="premium-card p-6"
                  >
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-2">Toss Winner</div>
                    <div className="text-xl font-bold mb-3">
                        {tossResult.winnerId === userTeam.id ? "You won the toss!" : `${opponentTeam.name} won`}
                    </div>
                    {tossResult.winnerId !== userTeam.id && (
                        <p className="text-sm text-white/50">
                            {opponentTeam.name} elected to <span className="text-white font-bold uppercase">{tossResult.decision}</span> first.
                        </p>
                    )}
                  </motion.div>

                  {tossResult.winnerId === userTeam.id && !tossResult.decision && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleDecision(TossDecision.BAT)}
                        className="premium-card p-5 text-center hover:border-zinc-600 transition-all active:scale-95"
                      >
                        <div className="text-lg font-bold mb-0.5">BAT</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase">First</div>
                      </button>
                      <button
                        onClick={() => handleDecision(TossDecision.BOWL)}
                        className="premium-card p-5 text-center hover:border-zinc-600 transition-all active:scale-95"
                      >
                        <div className="text-lg font-bold mb-0.5">BOWL</div>
                        <div className="text-[10px] text-white/30 font-bold uppercase">First</div>
                      </button>
                    </div>
                  )}

                  {tossResult.decision && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        {tossResult.winnerId === userTeam.id && (
                            <div className="premium-card p-4 mb-3 text-center">
                                <span className="text-xs text-white/50">You elected to </span>
                                <span className="text-xs text-white font-bold uppercase">{tossResult.decision}</span>
                                <span className="text-xs text-white/50"> first</span>
                            </div>
                        )}
                        <button
                            onClick={startMatch}
                            className="w-full py-3.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
                        >
                            Start Match <ChevronRight className="w-4 h-4" />
                        </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
