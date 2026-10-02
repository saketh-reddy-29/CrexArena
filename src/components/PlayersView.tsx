import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { INTL_PLAYER_POOL } from '../data/intlPlayers';
import { Search, Globe, ArrowLeft, Star, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { Player } from '../types/common';
import PlayerProfileModal from './PlayerProfileModal';
import { getPlayerRating, getPlayerForm } from '../lib/ratingEngine';

export default function PlayersView() {
  const { setGameState, franchises, selectedFormat, getArenaPlayerState } = useGameStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper'>('All');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name'>('default');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const roles = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'];
  const allPlayers = [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL];

  const filteredPlayers = allPlayers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || p.role === filter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (sortBy === 'rating') {
      const rA = getPlayerRating(a, selectedFormat || 'T20');
      const rB = getPlayerRating(b, selectedFormat || 'T20');
      return rB - rA;
    }
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  const PlayerCard = ({ player }: { player: Player }) => {
    const activeFormat = selectedFormat || 'T20';
    const playerState = getArenaPlayerState(player.id, activeFormat);
    const rating = playerState ? playerState.currentRating : getPlayerRating(player, activeFormat);
    const formStatus = getPlayerForm(player, activeFormat, playerState);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        layout
        onClick={() => setSelectedPlayer(player)}
        className="group relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/[.08] bg-[#0c1324] cursor-pointer hover:border-cyan-400/60 transition-all hover:shadow-[0_0_25px_rgba(6,182,212,0.25)]"
      >
        <JerseyPlayerImage
          player={player}
          franchiseId={franchises.find(f => f.squad.includes(player.id))?.id}
          className="w-full h-full group-hover:scale-105 transition-transform duration-500 origin-bottom"
          imageClassName="w-full h-full"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 z-[15] bg-gradient-to-t from-[#080d1a] via-[#080d1a]/85 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-black/70 rounded-lg backdrop-blur-md border border-white/10 shadow-lg">
            <Star className={cn("w-2.5 h-2.5", rating > 90 ? 'text-amber-400 fill-amber-400 drop-shadow-md' : 'text-cyan-400')} />
            <span className="text-[10px] font-black text-white">{rating}</span>
          </div>
          
          <div className="flex items-center gap-1">
            {formStatus.value !== null ? (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-md border border-amber-500/30 text-[9px] font-black">
                {formStatus.value}
                {formStatus.trend === 'IMPROVING' && <TrendingUp className="w-2.5 h-2.5 text-green-400" />}
                {formStatus.trend === 'DECLINING' && <TrendingDown className="w-2.5 h-2.5 text-red-400" />}
              </div>
            ) : (
              <div className="px-1.5 py-0.5 bg-white/10 text-white/50 rounded-md text-[8px] font-bold">
                New
              </div>
            )}
            {player.nationality === 'Overseas' && (
              <Globe className="w-3.5 h-3.5 text-blue-400/80 drop-shadow-md" />
            )}
          </div>
        </div>

        {/* Bottom Details */}
        <div className="absolute bottom-3 left-3 right-3 z-20">
          <div className="text-[8px] font-black text-cyan-400 uppercase tracking-widest mb-0.5">{player.role}</div>
          <h3 className="text-xs font-black leading-tight truncate text-white drop-shadow-md">{player.name}</h3>
          <div className="flex items-center justify-between mt-1 text-[9px]">
            <span className="text-white/40">Base: ₹{(player.basePrice / 10000000).toFixed(2)} Cr</span>
            <span className="text-white/60 font-bold">{playerState?.recentMatchCount ? `${playerState.recentMatchCount}M` : '0M'}</span>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080c15] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080c15]/95 backdrop-blur-md border-b border-white/[.06] px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setGameState(GameState.LANDING)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold flex-1">Player Roster</h1>
          <div className="text-xs text-white/40 font-mono">
            {filteredPlayers.length} Players
          </div>
        </div>
      </header>

      {/* Search & Filters */}
      <div className="px-4 py-3 sm:px-6 border-b border-white/[.06] bg-[#0c1220]">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
            <input
              type="text"
              placeholder="Search player..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0f1629] border border-white/[.06] rounded-lg py-2 pl-9 pr-3 outline-none focus:border-cyan-500/40 transition-all text-xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['All', ...roles].map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r as any)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all",
                  filter === r ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20 font-black" : "bg-white/5 text-white/60 hover:text-white"
                )}
              >
                {r}
              </button>
            ))}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#0f1629] border border-white/[.06] rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none uppercase text-white/70"
            >
              <option value="default">Default Sort</option>
              <option value="rating">By Rating (High to Low)</option>
              <option value="name">By Name (A to Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="flex-1 px-4 py-6 sm:px-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} />
            ))}
          </div>
        </div>
      </main>

      {/* Detailed Modal */}
      {selectedPlayer && (
        <PlayerProfileModal
          player={selectedPlayer}
          franchiseId={franchises.find(f => f.squad.includes(selectedPlayer.id))?.id}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}
