import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Zap, Globe, Shield, Play } from 'lucide-react';
import { useGameStore, GameState, ArenaFormat } from '../stores/useGameStore';
import { useArenaStore } from '../stores/useArenaStore';
import { cn } from '../lib/utils';

const FORMATS = [
  {
    id: 'IPL' as ArenaFormat,
    title: 'IPL Franchise',
    icon: Zap,
    color: 'from-blue-500 to-indigo-600',
    description: 'Auction-based squad building. Manage your purse, bid on players, and build a dynasty under overseas player restrictions.',
    features: ['Mega Auction', 'Purse Management', 'Overseas Rules']
  },
  {
    id: 'ODI' as ArenaFormat,
    title: 'ODI Internationals',
    icon: Globe,
    color: 'from-sky-500 to-blue-600',
    description: 'Lead a National Board. Select a perfectly balanced 15-man squad capable of sustaining 50 overs of intense cricket.',
    features: ['Board Selection', '15-man Squads', '50-Over Balance']
  },
  {
    id: 'T20' as ArenaFormat,
    title: 'T20 Internationals',
    icon: Trophy,
    color: 'from-emerald-500 to-teal-600',
    description: 'Fast-paced T20 World Cup mode. Prioritize strike rates, death bowling, and extreme power-hitting.',
    features: ['Board Selection', 'Power Hitters', 'Death Bowling']
  },
  {
    id: 'TEST' as ArenaFormat,
    title: 'Test Matches',
    icon: Shield,
    color: 'from-rose-500 to-red-600',
    description: 'The ultimate format. Requires immense batting depth, bowling endurance, and specialist roles to survive 5 days.',
    features: ['Board Selection', 'Batting Patience', 'Bowling Endurance']
  }
];

export default function LandingPage() {
  const { setGameState, setFormat, selectedFormat, resetGame } = useGameStore();
  const { arenas, loadArena } = useArenaStore();

  const handleSelectFormat = (format: ArenaFormat) => {
    setFormat(format);
    setGameState(GameState.TEAM_SELECTION);
  };

  return (
    <div 
      className="min-h-screen text-zinc-900 font-['Outfit'] flex flex-col safe-bottom relative overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundColor: '#f4f4f5' }}
    >
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-100/50 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-100/50 blur-[100px]" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-16 max-w-7xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-zinc-200 mb-6 shadow-sm">
            <span className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.2em]">Management Simulator</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tight text-[#1A2938] mb-4">
            CRICKET ARENA
          </h1>
          <p className="text-lg text-zinc-600 max-w-2xl mx-auto font-medium">
            Build your squad. Manage your team. Prove your strength.
          </p>
        </motion.div>

        {arenas.length > 0 && (
          <div className="mb-16 w-full">
            <h2 className="text-xl font-bold text-zinc-900 mb-4 px-2">My Arenas</h2>
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
                    // Depending on status, transition to relevant screen
                    if (arena.status === 'AUCTION') setGameState(GameState.AUCTION);
                    else setGameState(GameState.ARENA_HUB);
                  }}
                  className="bg-zinc-900 text-white rounded-2xl p-5 text-left flex flex-col justify-between shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400 tracking-wider uppercase">{arena.format}</span>
                      <span className="text-[10px] text-zinc-500">{new Date(arena.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-lg font-bold mb-1">{arena.name}</h3>
                    <p className="text-sm text-zinc-400">Team: {arena.userTeamId}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-zinc-800">
                    <span className="text-xs font-semibold text-zinc-400">Status: {arena.status}</span>
                    <Play className="w-4 h-4 text-white" />
                  </div>
                </motion.button>
              ))}
            </div>
            
            <div className="mt-12 mb-6 flex items-center gap-4">
              <div className="h-px bg-zinc-200 flex-1" />
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Or Start A New Career</span>
              <div className="h-px bg-zinc-200 flex-1" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {FORMATS.map((format, index) => (
            <motion.button
              key={format.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectFormat(format.id)}
              className="group flex flex-col bg-white rounded-3xl p-6 text-left border border-zinc-200 shadow-sm hover:shadow-xl transition-all relative overflow-hidden"
            >
              <div className={cn(
                "absolute top-0 left-0 w-full h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity",
                format.color
              )} />
              
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br text-white shadow-inner",
                format.color
              )}>
                <format.icon className="w-7 h-7" />
              </div>

              <h2 className="text-2xl font-black tracking-tight text-zinc-900 mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-zinc-900 group-hover:to-zinc-600">
                {format.title}
              </h2>
              
              <p className="text-sm text-zinc-500 leading-relaxed font-medium mb-8 flex-1">
                {format.description}
              </p>

              <div className="space-y-2 mt-auto">
                {format.features.map(feature => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-300 group-hover:bg-blue-500 transition-colors" />
                    <span className="text-xs font-bold text-zinc-600 uppercase tracking-wider">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-between pt-4 border-t border-zinc-100">
                <span className="text-sm font-bold text-zinc-400 group-hover:text-zinc-900 transition-colors">Select Format</span>
                <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-900 group-hover:text-white transition-all">
                  <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {selectedFormat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-16 text-center"
          >
            <button 
              onClick={() => {
                if (window.confirm("Resign from current team and start fresh?")) {
                  resetGame();
                }
              }}
              className="text-sm font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-wider"
            >
              Reset Current Career
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
