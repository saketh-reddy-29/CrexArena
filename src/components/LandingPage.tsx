import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Globe, Shield, Play, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import { useGameStore, GameState, ArenaFormat } from '../stores/useGameStore';
import { useArenaStore } from '../stores/useArenaStore';
import { cn } from '../lib/utils';
import HomePage from './pages/HomePage';
import MatchRecoveryBanner from './common/MatchRecoveryBanner';

const FORMATS = [
  {
    id: 'IPL' as ArenaFormat,
    title: 'IPL Franchise',
    icon: Zap,
    color: 'from-blue-600 to-indigo-700',
    accentBorder: 'border-blue-500/30',
    description: 'Auction-based squad building. Manage your purse, bid on players, and build a dynasty under overseas player restrictions.',
    features: ['Mega Auction', 'Purse Management', 'Overseas Rules']
  },
  {
    id: 'ODI' as ArenaFormat,
    title: 'ODI Internationals',
    icon: Globe,
    color: 'from-sky-600 to-blue-700',
    accentBorder: 'border-sky-500/30',
    description: 'Lead a National Board. Select a perfectly balanced 15-man squad capable of sustaining 50 overs of intense cricket.',
    features: ['Board Selection', '15-man Squads', '50-Over Balance']
  },
  {
    id: 'T20' as ArenaFormat,
    title: 'T20 Internationals',
    icon: Trophy,
    color: 'from-emerald-600 to-teal-700',
    accentBorder: 'border-emerald-500/30',
    description: 'Fast-paced T20 World Cup mode. Prioritize strike rates, death bowling, and extreme power-hitting.',
    features: ['Board Selection', 'Power Hitters', 'Death Bowling']
  },
  {
    id: 'TEST' as ArenaFormat,
    title: 'Test Matches',
    icon: Shield,
    color: 'from-rose-600 to-red-800',
    accentBorder: 'border-rose-500/30',
    description: 'The ultimate format. Requires immense batting depth, bowling endurance, and specialist roles to survive 5 days.',
    features: ['Board Selection', 'Batting Patience', 'Bowling Endurance']
  }
];

export default function LandingPage() {
  const { setGameState, setFormat, selectedFormat, resetGame, selectedFranchiseId } = useGameStore();
  const { arenas, loadArena } = useArenaStore();

  const handleSelectFormat = (format: ArenaFormat) => {
    resetGame();
    setFormat(format);
    setGameState(GameState.TEAM_SELECTION);
  };

  // If a career is already in progress, show the rich Home experience first with format selection available below
  return (
    <div className="space-y-10">
      {/* If an active team/career is selected, render the Home dashboard */}
      {selectedFranchiseId ? (
        <HomePage />
      ) : (
        /* Otherwise, show the Welcome & Format Selection stage */
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-full max-w-5xl">
            <MatchRecoveryBanner />
          </div>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12 max-w-3xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#10233D] border border-white/10 mb-6 shadow-md">
              <Sparkles className="w-4 h-4 text-[#F5B82E]" />
              <span className="text-[11px] font-black text-[#F5B82E] uppercase tracking-[0.2em]">
                AAA Management & Simulation Experience
              </span>
            </div>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-4">
              CRICKET <span className="gold-gradient-text">ARENA</span>
            </h1>
            <p className="text-base sm:text-lg text-[#9DAEC4] font-medium leading-relaxed">
              Build your champion squad. Manage your finances. Dominate the field with authentic ball-by-ball physics.
            </p>
          </motion.div>

          {/* Arenas Saved List */}
          {arenas.length > 0 && (
            <div className="mb-12 w-full max-w-5xl">
              <h2 className="text-sm font-black text-[#9DAEC4] uppercase tracking-wider mb-4 px-1">
                Saved Careers & Arenas
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {arenas.map((arena, i) => (
                  <motion.button
                    key={arena.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      loadArena(arena.id);
                      setFormat(arena.format);
                      if (arena.status === 'AUCTION') {
                        useGameStore.getState().setActiveTab('AUCTION');
                        setGameState(GameState.ARENA_HUB);
                      } else {
                        setGameState(GameState.ARENA_HUB);
                      }
                    }}
                    className="glass-card rounded-2xl p-5 text-left flex flex-col justify-between border border-white/10 hover:border-blue-400/50 transition-all cursor-pointer shadow-lg"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-blue-400 tracking-wider uppercase">{arena.format}</span>
                        <span className="text-[10px] text-[#9DAEC4]">{new Date(arena.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-base font-black text-white mb-1">{arena.name}</h3>
                      <p className="text-xs text-[#9DAEC4]">Team: {arena.userTeamId}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-xs font-semibold text-[#9DAEC4]">Status: {arena.status}</span>
                      <Play className="w-4 h-4 text-white" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Formats Grid */}
          <div className="w-full max-w-6xl">
            <div className="text-xs font-black text-[#9DAEC4] uppercase tracking-wider mb-4 px-1 text-center sm:text-left">
              Select Competition Format to Begin Career
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {FORMATS.map((format, index) => (
                <motion.button
                  key={format.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -6, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleSelectFormat(format.id)}
                  className="glass-card rounded-3xl p-6 text-left border border-white/10 hover:border-cyan-400/50 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden group shadow-xl"
                >
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br text-white shadow-lg",
                    format.color
                  )}>
                    <format.icon className="w-7 h-7" />
                  </div>

                  <h2 className="text-xl font-black text-white mb-2 group-hover:text-blue-400 transition-colors">
                    {format.title}
                  </h2>
                  
                  <p className="text-xs text-[#9DAEC4] leading-relaxed font-medium mb-6 flex-1">
                    {format.description}
                  </p>

                  <div className="space-y-2 mt-auto">
                    {format.features.map(feature => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span className="text-[10px] font-bold text-[#9DAEC4] uppercase tracking-wider">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5">
                    <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                      Start Tournament
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#258BFF] group-hover:text-white transition-all">
                      <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
