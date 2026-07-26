import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { Search, Globe, ArrowLeft, Star, X } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { Player } from '../types/common';

export default function PlayersView() {
  const { setGameState, franchises } = useGameStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper'>('All');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name'>('default');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const roles = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'];

  const filteredPlayers = INITIAL_PLAYER_POOL.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.role === filter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const PlayerCard = ({ player }: { player: Player }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      layout
      onClick={() => setSelectedPlayer(player)}
      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-white/[.06] bg-[#0f1629] cursor-pointer hover:border-cyan-500/50 transition-colors"
    >
      <JerseyPlayerImage
        player={player}
        franchiseId={franchises.find(f => f.squad.includes(player.id))?.id}
        className="w-full h-full group-hover:scale-105 transition-transform duration-500 origin-bottom"
        imageClassName="w-full h-full"
      />
      <div className="absolute inset-x-0 bottom-0 h-2/5 z-[15] bg-gradient-to-t from-[#0f172a] via-[#0f172a]/80 to-transparent" />

      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-black/60 rounded-md backdrop-blur-sm border border-white/10">
          <Star className={cn("w-2.5 h-2.5", player.rating > 90 ? 'text-amber-400 fill-amber-400 drop-shadow-md' : 'text-white/40')} />
          <span className="text-[9px] font-bold text-white/90">{player.rating}</span>
        </div>
        {player.nationality === 'Overseas' && (
          <Globe className="w-3.5 h-3.5 text-blue-400/80 drop-shadow-md" />
        )}
      </div>

      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20">
        <div className="text-[8px] font-bold text-white/40 uppercase mb-0.5 tracking-wider">{player.role}</div>
        <h3 className="text-xs font-black leading-tight truncate drop-shadow-md">{player.name}</h3>
        <div className="text-[10px] text-cyan-400 font-black mt-0.5 drop-shadow-md">
          ₹{(player.basePrice / 10000000).toFixed(2)} Cr
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#080c15] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080c15]/90 backdrop-blur-md border-b border-white/[.06] px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setGameState(GameState.LANDING)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold flex-1">Player Roster</h1>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="px-4 py-3 sm:px-6 border-b border-white/[.06]">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0f1629] border border-white/[.06] rounded-lg py-2 pl-9 pr-3 outline-none focus:border-white/15 transition-all text-xs"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-[#0f1629] border border-white/[.06] rounded-lg py-2 px-3 text-[10px] font-bold outline-none uppercase text-white/70"
          >
            <option value="default">Default Sort</option>
            <option value="rating">By Rating (High to Low)</option>
            <option value="name">By Name (A-Z)</option>
          </select>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {['All', ...roles].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all",
                  filter === f ? "bg-cyan-500/20 text-cyan-300" : "text-white/30 hover:text-white/60"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player Grid / Lists */}
      <main className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">
          {filter === 'All' ? (
            roles.map(role => {
              const rolePlayers = filteredPlayers.filter(p => p.role === role);
              if (rolePlayers.length === 0) return null;
              return (
                <div key={role} className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest">{role}S</h2>
                    <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    <AnimatePresence>
                      {rolePlayers.map(player => (
                        <PlayerCard key={player.id} player={player} />
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              <AnimatePresence>
                {filteredPlayers.map(player => (
                  <PlayerCard key={player.id} player={player} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>

      {/* Stats Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90vw] max-w-[400px]"
            >
              <div
                className="bg-[#0a0a0a] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative"
              >
                {/* Close button */}
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Top image area */}
                <div className="relative h-[320px] bg-gradient-to-b from-[#1a2333] to-[#0a0a0a]">
                  <JerseyPlayerImage
                    player={selectedPlayer}
                    franchiseId={franchises.find(f => f.squad.includes(selectedPlayer.id))?.id}
                    className="w-full h-full object-contain"
                    imageClassName="w-full h-full object-contain"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10" />
                </div>

                {/* Info area */}
                <div className="px-6 pb-8 relative z-20 -mt-8 flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-md" />
                      <span className="text-xs font-black text-amber-400">{selectedPlayer.rating}</span>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                        {selectedPlayer.nationality === 'Indian' ? '🇮🇳 IND' : '🌐 OVS'}
                      </span>
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                      <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                        {selectedPlayer.role}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-1">{selectedPlayer.name}</h2>
                    <div className="text-cyan-400 font-bold tracking-widest text-[11px] uppercase mt-2">
                      Base Price: ₹{(selectedPlayer.basePrice / 10000000).toFixed(2)} Cr
                    </div>
                  </div>

                  {/* Stats Box */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'BAT', value: selectedPlayer.stats.batting, color: '#38bdf8' },
                      { label: 'BOWL', value: selectedPlayer.stats.bowling, color: '#f472b6' },
                      { label: 'FIELD', value: selectedPlayer.stats.fielding, color: '#4ade80' },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 rounded-xl p-4 border border-white/10 shadow-inner flex flex-col items-center justify-center gap-1">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-[0.2em]">{s.label}</span>
                        <span className="text-3xl font-black leading-none drop-shadow-md" style={{ color: s.color }}>{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

