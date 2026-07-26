import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Play, Trophy, Users, Layout, Zap, BarChart3, Gamepad2, Star, Shield, FastForward } from 'lucide-react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { cn } from '../lib/utils';
import { getTeamLogoUrl } from '../data/crexTeams';

export default function LandingPage() {
  const { setGameState, franchises, selectFranchise, simulateFullAuction, selectedFranchiseId, fixtures, resetGame } = useGameStore();
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  const navItems = [
    { name: 'League', state: GameState.LEAGUE, icon: Trophy },
    { name: 'Planner', state: GameState.SQUAD_PLANNER, icon: Layout },
    { name: 'Players', state: GameState.PLAYERS, icon: Users },
    { name: 'Teams', state: GameState.TEAMS, icon: BarChart3 },
  ];

  const features = [
    { icon: Zap, title: 'Mega Auction', desc: 'Live bidding with AI franchises' },
    { icon: Gamepad2, title: 'Match Engine', desc: 'Ball-by-ball live simulation' },
    { icon: Trophy, title: 'Full Season', desc: 'Complete league with playoffs' },
  ];

  const handleStartOfficial = () => {
    if (!selectedTeamId) return;
    selectFranchise(selectedTeamId);
    simulateFullAuction(INITIAL_PLAYER_POOL);
  };

  const handleStartAuction = () => {
    if (!selectedTeamId) return;
    selectFranchise(selectedTeamId);
    setGameState(GameState.AUCTION);
  };

  return (
    <div 
      className="min-h-screen text-zinc-900 font-['Outfit'] flex flex-col safe-bottom relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/stadium_bg.png)', backgroundColor: '#f0f2f5' }}
    >
      <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px]"></div>
      {/* Subtle ambient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/60 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-white/50 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-zinc-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1A2938] flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-[#1A2938]">CREX Arena</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => (
              <button
                key={item.name}
                onClick={() => setGameState(item.state)}
                className="px-4 py-2 text-[11px] font-semibold tracking-wide text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all uppercase"
              >
                {item.name}
              </button>
            ))}
          </nav>

          <button
            onClick={() => setShowStartModal(true)}
            className="premium-btn bg-[#1A2938] text-white text-[11px] hover:bg-slate-800 transition-colors"
          >
            Play Now
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-16 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center max-w-2xl mx-auto relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-zinc-200/80 mb-8 backdrop-blur-md shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">IPL Season 2026</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl tracking-tight leading-[1.1] mb-6">
            <span className="font-semibold text-[#1A2938]">Own The</span>
            <br />
            <span className="font-black text-blue-600">Arena</span>
          </h1>
          
          <p className="text-sm sm:text-base text-zinc-600 max-w-lg mx-auto mb-10 leading-relaxed">
            Build your IPL dynasty. Bid in the mega auction, simulate every ball, and lead your franchise to championship glory.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {selectedFranchiseId ? (
              <>
                <button 
                  onClick={() => setGameState(fixtures.length > 0 ? GameState.LEAGUE : GameState.AUCTION)}
                  className="w-full sm:w-auto group flex items-center justify-center gap-2.5 px-8 py-4 bg-[#1A2938] hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-md"
                >
                  <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Continue Career
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to resign and start a fresh career? All progress will be lost.")) {
                      resetGame();
                      setShowStartModal(true);
                    }
                  }}
                  className="w-full sm:w-auto group flex items-center justify-center gap-2.5 px-8 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-bold text-sm transition-all active:scale-95"
                >
                  Resign & Start Fresh
                </button>
              </>
            ) : (
              <button 
                onClick={() => setShowStartModal(true)}
                className="w-full sm:w-auto group flex items-center justify-center gap-2.5 px-8 py-4 bg-[#1A2938] hover:bg-slate-800 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 shadow-md"
              >
                <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Start Franchise
              </button>
            )}
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 w-full max-w-3xl mx-auto relative z-10"
        >
          {features.map((f, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -8 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="bg-white border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col items-center text-center cursor-default group rounded-3xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50/50 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-base font-bold mb-2 text-[#1A2938]">{f.title}</h3>
              <p className="text-[13px] text-zinc-500 leading-relaxed font-medium">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Mobile Nav */}
      <nav className="md:hidden sticky bottom-0 z-50 bg-white/95 backdrop-blur-xl border-t border-zinc-200 safe-bottom">
        <div className="grid grid-cols-4 gap-0">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setGameState(item.state)}
              className="flex flex-col items-center gap-1 py-2.5 text-zinc-500 hover:text-blue-600 transition-colors"
            >
              <item.icon className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-wide">{item.name}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* START MODAL */}
      <AnimatePresence>
        {showStartModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white shadow-2xl border border-zinc-200 rounded-2xl max-w-3xl w-full p-6 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 mb-1">Choose Your Franchise</h2>
                  <p className="text-sm text-zinc-500">Select a team to manage for the upcoming season</p>
                </div>
                <button onClick={() => setShowStartModal(false)} className="text-zinc-400 hover:text-zinc-900 p-2">✕</button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8 overflow-y-auto pr-2 custom-scrollbar">
                {franchises.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={cn(
                      "flex flex-col items-center p-3 rounded-xl border transition-all text-center gap-2",
                      selectedTeamId === team.id 
                        ? "border-blue-500 bg-blue-50 shadow-sm" 
                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-100"
                    )}
                  >
                    <div className="w-12 h-12 flex items-center justify-center shrink-0 mb-1">
                      {getTeamLogoUrl(team.shortName) ? (
                        <img 
                          src={getTeamLogoUrl(team.shortName)!} 
                          alt={team.name} 
                          className="w-full h-full object-contain drop-shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0 shadow-sm" style="background-color: ${team.color}; color: white;">${team.shortName}</div>`;
                          }}
                        />
                      ) : (
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black shrink-0 shadow-sm"
                          style={{ backgroundColor: team.color, color: 'white' }}
                        >
                          {team.shortName}
                        </div>
                      )}
                    </div>
                    <div className="text-xs font-bold leading-tight text-zinc-900">{team.name}</div>
                  </button>
                ))}
              </div>

              <div className="mt-auto border-t border-zinc-100 pt-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    disabled={!selectedTeamId}
                    onClick={handleStartOfficial}
                    className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FastForward className="w-4 h-4 text-zinc-500 group-hover:text-zinc-900" />
                      <span className="font-bold text-zinc-900">Play Official 2026 Squads</span>
                    </div>
                    <span className="text-xs text-zinc-500 text-center">Skip auction and use real-world teams</span>
                  </button>

                  <button
                    disabled={!selectedTeamId}
                    onClick={handleStartAuction}
                    className="flex-1 flex flex-col items-center justify-center p-4 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-white" />
                      <span className="font-bold text-white">Enter Mega Auction</span>
                    </div>
                    <span className="text-xs text-blue-100 text-center">Build your squad from scratch in the auction</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
