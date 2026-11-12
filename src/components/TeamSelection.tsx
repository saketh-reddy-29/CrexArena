import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { useArenaStore } from '../stores/useArenaStore';
import { Shield, ChevronRight, Target, Users, Check, ArrowLeft, Globe, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { INTL_TEAMS_DATA } from '../data/intlPlayers';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import PlayerProfileModal from './PlayerProfileModal';

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

function resolveLogo(shortName?: string, fallback?: string): string {
  if (!shortName) return fallback || '';
  return getIntlTeamLogoUrl(shortName) || IPL_TEAM_LOGOS[shortName] || fallback || '';
}

export default function TeamSelection() {
  const { franchises, selectFranchise, setGameState, selectedFormat, goBack } = useGameStore();
  const { createArena } = useArenaStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState<string | null>(null);
  
  const isIPL = selectedFormat === 'IPL';
  const selectedFranchise = isIPL ? franchises.find(f => f.id === selectedId) : null;
  const selectedIntlTeam = !isIPL ? INTL_TEAMS_DATA.find(t => t.id === selectedId) : null;

  const handleJoin = () => {
    if (selectedId && selectedFormat) {
      if (isIPL) {
        selectFranchise(selectedId);
        useGameStore.getState().setActiveTab('AUCTION');
        setGameState(GameState.ARENA_HUB);
        try {
          const teamName = franchises.find(f => f.id === selectedId)?.name || 'My Franchise';
          createArena(`My IPL Career - ${teamName}`, selectedFormat, selectedId);
        } catch (e) {
          console.warn('[handleJoin] createArena error:', e);
        }
      } else {
        const teamName = selectedIntlTeam?.name || 'My Team';
        try {
          createArena(`My ${selectedFormat} Career - ${teamName}`, selectedFormat, selectedId);
        } catch (e) {
          console.warn('[handleJoin] createArena error:', e);
        }
        selectFranchise(selectedId); 
        setGameState(GameState.BOARD_SELECTION);
      }
    }
  };

  // International Board UI
  if (!isIPL) {
    return (
      <div className="space-y-6 pb-16">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={goBack}
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="text-[10px] font-black text-[#F5B82E] uppercase tracking-wider mb-0.5">{selectedFormat} ARENA</div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Select National Board</h1>
            </div>
          </div>
          <div className="text-xs text-[#9DAEC4] font-bold">
            {INTL_TEAMS_DATA.length} Available Nations
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {INTL_TEAMS_DATA.map((team, idx) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => setSelectedId(team.id)}
              className={cn(
                "glass-card relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden group p-5 flex flex-col items-center justify-between shadow-lg",
                selectedId === team.id 
                  ? "border-[#258BFF] bg-gradient-to-b from-[#152C4D] to-[#10233D] ring-2 ring-blue-500/30 scale-[1.02]" 
                  : "border-white/5 bg-[#071426]/70 hover:border-white/20 hover:bg-[#10233D]/60"
              )}
            >
              <div className="w-16 h-16 mb-4 flex items-center justify-center bg-[#071426] rounded-2xl p-2.5 border border-white/10 shadow-inner group-hover:scale-105 transition-transform">
                {resolveLogo(team.shortName) ? (
                  <img 
                    src={resolveLogo(team.shortName)} 
                    alt={team.name} 
                    className="w-12 h-12 object-contain filter drop-shadow-md" 
                  />
                ) : (
                  <Globe className="w-8 h-8 text-[#9DAEC4]" />
                )}
              </div>

              <div className="text-center">
                <h3 className="text-sm font-black text-white mb-1 leading-tight text-center group-hover:text-blue-300 transition-colors">
                  {team.name}
                </h3>
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#9DAEC4] font-bold uppercase tracking-wider">
                  <Globe className="w-3 h-3" />
                  {team.shortName}
                </div>
              </div>

              {selectedId === team.id && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#258BFF] flex items-center justify-center shadow-md">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center justify-between">
          <div className="text-xs text-[#9DAEC4] font-medium">
            {selectedId ? (
              <span>Selected: <strong className="text-white font-bold">{selectedIntlTeam?.name}</strong></span>
            ) : (
              'Select a national board to continue'
            )}
          </div>
          <button
            disabled={!selectedId}
            onClick={handleJoin}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-md cursor-pointer btn-glow"
          >
            <span>Proceed to 15-Man Squad</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // IPL Franchise UI
  return (
    <div className="space-y-6 pb-16">
      <AnimatePresence mode="wait">
        <motion.div 
          key="selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -100 }}
          className="space-y-6"
        >
          {/* Header */}
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={goBack}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="text-[10px] font-black text-[#F5B82E] uppercase tracking-wider mb-0.5">IPL 2026 ARENA</div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Choose Your Franchise</h1>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10233D] border border-white/10">
                <Shield className="w-3.5 h-3.5 text-[#258BFF]" />
                <span className="font-bold text-[#F5B82E]">₹120 Cr Starting Purse</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#10233D] border border-white/10">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">25 Squad Slots</span>
              </div>
            </div>
          </header>

          {/* Team Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {franchises.map((team, idx) => {
              const logo = resolveLogo(team.shortName, team.logo);
              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => setSelectedId(team.id)}
                  className={cn(
                    "glass-card relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden group p-5 flex flex-col items-center justify-between shadow-lg",
                    selectedId === team.id 
                      ? "border-[#258BFF] bg-gradient-to-b from-[#152C4D] to-[#10233D] ring-2 ring-blue-500/30 scale-[1.02]" 
                      : "border-white/5 bg-[#071426]/70 hover:border-white/20 hover:bg-[#10233D]/60"
                  )}
                >
                  {/* Color Accent Bar */}
                  <div className="h-1.5 w-full rounded-full mb-3" style={{ backgroundColor: team.color }} />
                  
                  <div className="w-16 h-16 mb-4 flex items-center justify-center p-2 bg-[#071426] rounded-2xl border border-white/10 shadow-inner group-hover:scale-105 transition-transform">
                    <img src={logo} alt={team.shortName} className="max-w-full max-h-full object-contain filter drop-shadow-md" />
                  </div>
                  
                  <div className="text-center w-full">
                    <h3 className="text-sm font-black text-white mb-1 leading-tight group-hover:text-blue-300 transition-colors">
                      {team.name}
                    </h3>
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#9DAEC4] font-bold uppercase">
                      <Target className="w-3 h-3 text-[#F5B82E]" />
                      <span>{team.strategy}</span>
                    </div>
                  </div>

                  {selectedId === team.id && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#258BFF] flex items-center justify-center shadow-md">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Bottom CTA */}
          <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center justify-between">
            <div className="text-xs text-[#9DAEC4] font-medium">
              {selectedId ? (
                <span>Selected: <strong className="text-white font-bold">{selectedFranchise?.name}</strong></span>
              ) : (
                'Tap a franchise to select'
              )}
            </div>
            <button
              disabled={!selectedId}
              onClick={handleJoin}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#258BFF] hover:bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-md cursor-pointer btn-glow"
            >
              <span>Enter Mega Auction</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
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
