import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { MatchEngine } from '../lib/matchEngine';
import { TossDecision } from '../types/match';
import { ArrowLeft, Users, Trophy, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import JerseyPlayerImage from './JerseyPlayerImage';
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

  const [step, setStep] = useState<'toss' | 'squad'>('toss');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [tossResult, setTossResult] = useState<{ winnerId: string; decision: TossDecision | null } | null>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  // For international: use selectedSquadIds (15-man). For IPL: use franchise.squad.
  const teamPlayers = isIPL
    ? players.filter(p => userTeam?.squad.includes(p.id))
    : players.filter(p => selectedSquadIds.includes(p.id));

  const autoSelectSquad = () => {
    // Basic logic: Select top rated players by role to ensure balance
    const batsmen = teamPlayers.filter(p => p.role === 'Batsman').sort((a, b) => b.rating - a.rating);
    const allrounders = teamPlayers.filter(p => p.role === 'All-rounder').sort((a, b) => b.rating - a.rating);
    const bowlers = teamPlayers.filter(p => p.role === 'Bowler').sort((a, b) => b.rating - a.rating);

    const selected: string[] = [];
    
    // Pick top 4 batsmen
    selected.push(...batsmen.slice(0, 4).map(p => p.id));
    // Pick top 2 all-rounders
    selected.push(...allrounders.slice(0, 2).map(p => p.id));
    // Pick top 4 bowlers
    selected.push(...bowlers.slice(0, 4).map(p => p.id));
    
    // Fill the 11th spot with the highest rated remaining player
    const remaining = teamPlayers.filter(p => !selected.includes(p.id)).sort((a, b) => b.rating - a.rating);
    if (remaining[0]) selected.push(remaining[0].id);

    // If still not 11 (unlikely), just take top ratings
    if (selected.length < 11) {
        teamPlayers.sort((a, b) => b.rating - a.rating).forEach(p => {
            if (selected.length < 11 && !selected.includes(p.id)) selected.push(p.id);
        });
    }

    setSelectedIds(selected);
    if (!captainId && selected.length > 0) {
      // Auto-assign highest rated player as captain if none selected
      const bestPlayer = teamPlayers.filter(p => selected.includes(p.id)).sort((a, b) => b.rating - a.rating)[0];
      if (bestPlayer) setCaptainId(bestPlayer.id);
    }
  };

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

  const proceedToSquad = () => {
    autoSelectSquad(); // Pre-fill with a smart XI
    setStep('squad');
  };

  const startMatch = () => {
    if (userTeam && captainId) {
        setCaptain(userTeam.id, captainId);
    }
    if (tossResult && tossResult.decision) {
        setCurrentMatchToss({ winnerId: tossResult.winnerId, decision: tossResult.decision });
    }
    // Save the playing XI
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
            onClick={() => setGameState(GameState.ARENA_DASHBOARD)}
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
          {step === 'toss' ? (
            <motion.div
              key="toss"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="text-center"
            >
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
                  <p className="text-xs text-white/50 uppercase tracking-widest font-bold mt-4 animate-pulse">Tap coin to flip</p>
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
                            onClick={proceedToSquad}
                            className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm active:scale-95 transition-all"
                        >
                            Select Playing XI
                        </button>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="squad"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-lg font-bold">Playing XI</h1>
                    <p className="text-xs text-white/40">Select 11 players and designate a captain</p>
                </div>
                <button 
                    onClick={autoSelectSquad}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/[.06] text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all"
                >
                    Auto Select
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
                  </div>
                  <button
                    disabled={selectedIds.length !== 11 || !captainId}
                    onClick={startMatch}
                    className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm disabled:opacity-30 active:scale-95 transition-all"
                  >
                    Start Match <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
