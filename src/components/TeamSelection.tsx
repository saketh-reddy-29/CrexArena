import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { useArenaStore } from '../stores/useArenaStore';
import { Shield, ChevronRight, Target, Users, Check, ArrowLeft, Globe, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { INITIAL_PLAYER_POOL } from '../data/players';
import JerseyPlayerImage from './JerseyPlayerImage';
import { INTL_TEAMS_DATA } from '../data/intlPlayers';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import PlayerProfileModal from './PlayerProfileModal';

export default function TeamSelection() {
  const { franchises, selectFranchise, setGameState, updatePurse, addToSquad, selectedFormat, goBack } = useGameStore();
  const { createArena } = useArenaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRetention, setShowRetention] = useState(false);
  const [selectedRetentions, setSelectedRetentions] = useState<string[]>([]);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<string | null>(null);
  
  const isIPL = selectedFormat === 'IPL';
  const selectedFranchise = isIPL ? franchises.find(f => f.id === selectedId) : null;
  const selectedIntlTeam = !isIPL ? INTL_TEAMS_DATA.find(t => t.id === selectedId) : null;

  const handleJoin = () => {
    if (selectedId && selectedFormat) {
      if (isIPL) {
        selectFranchise(selectedId);
        setShowRetention(true);
      } else {
        const teamName = selectedIntlTeam?.name || 'My Team';
        createArena(`My ${selectedFormat} Career - ${teamName}`, selectedFormat, selectedId);
        selectFranchise(selectedId); 
        setGameState(GameState.BOARD_SELECTION);
      }
    }
  };

  const toggleRetention = (playerId: string) => {
      setSelectedRetentions(prev => {
          if (prev.includes(playerId)) return prev.filter(id => id !== playerId);
          if (prev.length >= 4) return prev;
          return [...prev, playerId];
      });
  };

  const startAuction = () => {
      if (selectedId) {
          selectedRetentions.forEach(playerId => {
              const player = INITIAL_PLAYER_POOL.find(p => p.id === playerId);
              if (player) {
                  const cost = player.rating > 95 ? 180000000 : (player.rating > 90 ? 140000000 : 100000000);
                  updatePurse(selectedId, cost);
                  addToSquad(selectedId, playerId);
              }
          });
          
          franchises.forEach(f => {
              if (f.id !== selectedId) {
                  const pool = INITIAL_PLAYER_POOL.filter(p => p.rating > 90).sort(() => 0.5 - Math.random());
                  const aiRetentions = pool.slice(0, 2);
                  aiRetentions.forEach(p => {
                      const cost = p.rating > 95 ? 180000000 : 120000000;
                      updatePurse(f.id, cost);
                      addToSquad(f.id, p.id);
                  });
              }
          });

          useGameStore.getState().setActiveTab('AUCTION');
          setGameState(GameState.ARENA_HUB);
          if (selectedFormat) {
            const teamName = selectedFranchise?.name || 'My Franchise';
            createArena(`My IPL Career - ${teamName}`, selectedFormat, selectedId);
          }
      }
  };

  // International Board UI
  if (!isIPL) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-20%] right-[-15%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px]" />
          <div className="absolute bottom-[-15%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[80px]" />
        </div>
        
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 py-3 sm:px-6">
            <div className="max-w-6xl mx-auto flex items-center gap-4">
                <button 
                  onClick={goBack}
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">{selectedFormat} MODE</div>
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight">Select National Board</h1>
                </div>
            </div>
        </header>

        <div className="flex-1 px-4 py-8 sm:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {INTL_TEAMS_DATA.map((team, idx) => (
                  <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => setSelectedId(team.id)}
                      className={cn(
                          "relative rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden group bg-zinc-900/50",
                          selectedId === team.id 
                          ? "border-blue-500 shadow-lg shadow-blue-500/20" 
                          : "border-zinc-800 hover:border-zinc-600"
                      )}
                  >
                      <div className="p-4 flex flex-col items-center">
                          <div className="w-16 h-16 mb-4 flex items-center justify-center bg-zinc-800/50 rounded-full p-2 border border-white/5">
                              <img 
                                src={getIntlTeamLogoUrl(team.shortName) || ''} 
                                alt={team.name} 
                                className="w-10 h-10 object-contain filter drop-shadow-md" 
                              />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold mb-1 leading-tight text-center">{team.name}</h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-white/50 font-semibold uppercase tracking-wider">
                              <Globe className="w-3 h-3" />
                              {team.shortName}
                          </div>
                      </div>

                      {/* Selected check */}
                      {selectedId === team.id && (
                          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/20">
                              <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                      )}
                  </motion.div>
              ))}
            </div>
        </div>

        <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60 px-4 py-4 sm:px-6 safe-bottom">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="text-sm text-white/40 font-medium">
                    {selectedId ? `Selected: ${selectedIntlTeam?.name}` : 'Select a national board to continue'}
                </div>
                <button
                    disabled={!selectedId}
                    onClick={handleJoin}
                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95 shadow-md shadow-blue-500/20"
                >
                    Proceed to Squad
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>
    );
  }

  // IPL Franchise UI
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-15%] w-[50%] h-[50%] rounded-full bg-zinc-800/20 blur-[100px]" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-800/15 blur-[80px]" />
      </div>
      <AnimatePresence mode="wait">
        {!showRetention ? (
            <motion.div 
                key="selection"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex flex-col min-h-screen relative z-10"
            >
                {/* Header */}
                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-4 py-3 sm:px-6">
                    <div className="max-w-6xl mx-auto flex items-center gap-4">
                        <button 
                          onClick={goBack}
                          className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex-1">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Step 1 of 3</div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight">Choose Your Franchise</h1>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/[.06]">
                                <Shield className="w-3.5 h-3.5" />
                                <span className="font-semibold">₹120 Cr Purse</span>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/[.06]">
                                <Users className="w-3.5 h-3.5" />
                                <span className="font-semibold">25 Slots</span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Team Grid */}
                <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
                    <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {franchises.map((team, idx) => (
                        <motion.div
                            key={team.id}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.04 }}
                            onClick={() => setSelectedId(team.id)}
                            className={cn(
                                "relative rounded-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden group",
                                selectedId === team.id 
                                ? "border-white shadow-lg shadow-white/5" 
                                : "border-zinc-800 hover:border-zinc-600"
                            )}
                        >
                            {/* Color bar */}
                            <div className="h-1.5 w-full" style={{ backgroundColor: team.color }} />
                            
                            <div className="p-3 sm:p-4">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 mb-3 flex items-center justify-center">
                                    <img src={team.logo} alt={team.shortName} className="max-w-full max-h-full object-contain filter drop-shadow-md" />
                                </div>
                                <h3 className="text-sm sm:text-base font-bold mb-1 leading-tight">{team.name}</h3>
                                <div className="flex items-center gap-1.5 text-[10px] text-white/40 font-medium">
                                    <Target className="w-3 h-3" />
                                    {team.strategy}
                                </div>
                            </div>

                            {/* Selected check */}
                            {selectedId === team.id && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                                    <Check className="w-3.5 h-3.5 text-zinc-950" />
                                </div>
                            )}
                        </motion.div>
                    ))}
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60 px-4 py-3 sm:px-6 sm:py-4 safe-bottom">
                    <div className="max-w-6xl mx-auto flex items-center justify-between">
                        <div className="sm:hidden flex items-center gap-3 text-xs text-white/40">
                            <span className="font-bold">₹120 Cr</span>
                            <span>•</span>
                            <span>25 Slots</span>
                        </div>
                        <div className="hidden sm:block text-sm text-white/40">
                            {selectedId ? `Selected: ${selectedFranchise?.name}` : 'Tap a franchise to select'}
                        </div>
                        <button
                            disabled={!selectedId}
                            onClick={handleJoin}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm transition-all disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                        >
                            Continue
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        ) : (
            <motion.div 
                key="retention"
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col min-h-screen"
            >
                {/* Header */}
                <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/60 px-4 py-3 sm:px-6">
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                        <button 
                          onClick={() => setShowRetention(false)}
                          className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="flex-1">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Step 2 of 3</div>
                            <h1 className="text-lg font-bold tracking-tight">Player Retentions</h1>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] text-white/30 font-bold uppercase">Retained</div>
                            <div className="text-sm font-bold text-white">{selectedRetentions.length}/4</div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
                    <div className="max-w-4xl mx-auto">
                        <p className="text-xs text-white/40 mb-4 leading-relaxed">
                            Select up to 4 core players to retain for <span className="text-white font-semibold">{selectedFranchise?.name}</span>. Retention costs reduce your auction purse.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {INITIAL_PLAYER_POOL.slice(0, 8).map(player => {
                                const isSelected = selectedRetentions.includes(player.id);
                                const cost = player.rating > 95 ? 18 : (player.rating > 90 ? 14 : 10);
                                return (
                                    <div 
                                        key={player.id}
                                        onClick={() => toggleRetention(player.id)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all group",
                                            isSelected ? "border-white bg-white/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                                        )}
                                    >
                                        <div 
                                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-zinc-950 overflow-hidden border border-zinc-800 shrink-0 cursor-pointer"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPlayerProfile(player.id);
                                          }}
                                        >
                                            <JerseyPlayerImage 
                                                player={player} 
                                                franchiseId={selectedId}
                                                className="w-full h-full bg-zinc-800"
                                                imageClassName="w-full h-full" 
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0" onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedPlayerProfile(player.id);
                                        }}>
                                            <h3 className="text-sm font-bold truncate hover:text-cyan-400 transition-colors">{player.name}</h3>
                                            <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium mt-0.5">
                                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold uppercase">{player.role}</span>
                                                <span className="flex items-center gap-1">
                                                    <Star className="w-3 h-3 text-yellow-500" />
                                                    {player.rating}
                                                </span>
                                                <span className="text-white/60 font-bold">₹{cost} Cr</span>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                            isSelected ? "bg-white border-white" : "border-zinc-700"
                                        )}>
                                            {isSelected && <Check className="w-4 h-4 text-zinc-950" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Bottom CTA */}
                <div className="sticky bottom-0 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800/60 px-4 py-3 sm:px-6 sm:py-4 safe-bottom">
                    <div className="max-w-4xl mx-auto flex items-center justify-between">
                        <div>
                            <div className="text-[10px] text-white/30 font-bold uppercase">Remaining Purse</div>
                            <div className="text-lg font-bold text-white">₹{(120 - selectedRetentions.reduce((acc, id) => {
                                const p = INITIAL_PLAYER_POOL.find(x => x.id === id);
                                return acc + (p?.rating ? (p.rating > 95 ? 18 : (p.rating > 90 ? 14 : 10)) : 0);
                            }, 0)).toFixed(0)} Cr</div>
                        </div>
                        <button 
                            onClick={startAuction}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm transition-all active:scale-95"
                        >
                            Start Auction
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Player Profile Modal */}
      <PlayerProfileModal 
        player={selectedPlayerProfile ? INITIAL_PLAYER_POOL.find(p => p.id === selectedPlayerProfile) || null : null}
        franchiseId={selectedId || undefined}
        onClose={() => setSelectedPlayerProfile(null)}
      />
    </div>
  );
}
