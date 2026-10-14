import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { useArenaStore } from '../stores/useArenaStore';
import { Shield, ChevronRight, Target, Users, Check, ArrowLeft, Globe } from 'lucide-react';
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
      <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex flex-col font-sans">
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200/90 px-4 py-3 sm:px-6 shadow-xs">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <button 
              onClick={goBack}
              className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-0.5">{selectedFormat} ARENA</div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Select National Board</h1>
            </div>
          </div>
        </header>

        <div className="flex-1 px-4 py-6 sm:px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {INTL_TEAMS_DATA.map((team, idx) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setSelectedId(team.id)}
                className={cn(
                  "relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden group bg-white shadow-xs p-4 flex flex-col items-center justify-between",
                  selectedId === team.id 
                    ? "border-blue-600 shadow-md ring-2 ring-blue-600/20" 
                    : "border-slate-200/90 hover:border-blue-300 hover:shadow-sm"
                )}
              >
                <div className="w-16 h-16 mb-3 flex items-center justify-center bg-slate-50 rounded-2xl p-2 border border-slate-100">
                  {resolveLogo(team.shortName) ? (
                    <img 
                      src={resolveLogo(team.shortName)} 
                      alt={team.name} 
                      className="w-11 h-11 object-contain filter drop-shadow-sm" 
                    />
                  ) : (
                    <Globe className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                <div className="text-center">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 leading-tight text-center">{team.name}</h3>
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <Globe className="w-3 h-3" />
                    {team.shortName}
                  </div>
                </div>

                {selectedId === team.id && (
                  <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-xs">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 sm:px-6 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="text-xs text-slate-500 font-medium">
              {selectedId ? `Selected: ${selectedIntlTeam?.name}` : 'Select a national board to continue'}
            </div>
            <button
              disabled={!selectedId}
              onClick={handleJoin}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs cursor-pointer"
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
    <div className="min-h-screen bg-[#f4f6f9] text-slate-900 flex flex-col font-sans">
      <AnimatePresence mode="wait">
        <motion.div 
          key="selection"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -100 }}
          className="flex flex-col min-h-screen"
        >
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white border-b border-slate-200/90 px-4 py-3 sm:px-6 shadow-xs">
            <div className="max-w-6xl mx-auto flex items-center gap-4">
              <button 
                onClick={goBack}
                className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1">
                <div className="text-[10px] font-black text-blue-700 uppercase tracking-wider mb-0.5">IPL 2026 ARENA</div>
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Choose Your Franchise</h1>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-500">
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-slate-800">₹120 Cr Purse</span>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-bold text-slate-800">25 Slots</span>
                </div>
              </div>
            </div>
          </header>

          {/* Team Grid */}
          <div className="flex-1 px-4 py-6 sm:px-6">
            <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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
                      "relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden group bg-white shadow-xs p-4 flex flex-col items-center justify-between",
                      selectedId === team.id 
                        ? "border-blue-600 shadow-md ring-2 ring-blue-600/20" 
                        : "border-slate-200/90 hover:border-blue-300 hover:shadow-sm"
                    )}
                  >
                    {/* Color Accent Bar */}
                    <div className="h-1.5 w-full rounded-full mb-3" style={{ backgroundColor: team.color }} />
                    
                    <div className="w-14 h-14 mb-3 flex items-center justify-center p-1 bg-slate-50 rounded-2xl border border-slate-100">
                      <img src={logo} alt={team.shortName} className="max-w-full max-h-full object-contain filter drop-shadow-sm" />
                    </div>
                    
                    <div className="text-center w-full">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 mb-1 leading-tight">{team.name}</h3>
                      <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase">
                        <Target className="w-3 h-3" />
                        {team.strategy}
                      </div>
                    </div>

                    {selectedId === team.id && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 sm:px-6 shadow-sm">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {selectedId ? `Selected: ${selectedFranchise?.name}` : 'Tap a franchise to select'}
              </div>
              <button
                disabled={!selectedId}
                onClick={handleJoin}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-xs cursor-pointer"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
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
