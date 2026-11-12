import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { INTL_PLAYER_POOL } from '../data/intlPlayers';
import { Search, Globe, ArrowLeft, Star, Activity, TrendingUp, TrendingDown, Users, Filter } from 'lucide-react';
import { cn } from '../lib/utils';
import JerseyPlayerImage from './JerseyPlayerImage';
import { getPlayerImage } from '../lib/playerImages';
import { Player } from '../types/common';
import PlayerProfileModal from './PlayerProfileModal';
import { getPlayerRating, getPlayerForm } from '../lib/ratingEngine';

export default function PlayersView() {
  const { setGameState, franchises, selectedFormat, getArenaPlayerState, setViewedPlayer } = useGameStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper'>('All');
  const [nationalityFilter, setNationalityFilter] = useState<'All' | 'Indian' | 'Overseas'>('All');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name' | 'price'>('default');

  const roles = ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'];
  const allPlayers = [...INITIAL_PLAYER_POOL, ...INTL_PLAYER_POOL];

  const filteredPlayers = allPlayers.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filter === 'All' || p.role === filter;
    const matchesNationality = nationalityFilter === 'All' || p.nationality === nationalityFilter;
    return matchesSearch && matchesRole && matchesNationality;
  }).sort((a, b) => {
    if (sortBy === 'rating') {
      const rA = getPlayerRating(a, selectedFormat || 'T20');
      const rB = getPlayerRating(b, selectedFormat || 'T20');
      return rB - rA;
    }
    if (sortBy === 'price') return b.basePrice - a.basePrice;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Global Cricket Talent Pool
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-[#258BFF]" />
            Master Player Database
          </h1>
        </div>
        <div className="text-xs text-[#9DAEC4] font-bold px-3 py-1.5 rounded-xl bg-[#10233D] border border-white/10">
          {filteredPlayers.length} / {allPlayers.length} Registered Players
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {/* Search Input */}
          <div className="flex-1 w-full relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9DAEC4]" />
            <input
              type="text"
              placeholder="Search by player name or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#071426] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-[#9DAEC4]/60 outline-none focus:border-[#258BFF] transition-all"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="w-full sm:w-auto flex items-center gap-2">
            <span className="text-xs text-[#9DAEC4] font-bold shrink-0">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#071426] border border-white/10 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-[#258BFF]"
            >
              <option value="default">Default Order</option>
              <option value="rating">Highest Rating</option>
              <option value="price">Highest Base Price</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-xs">
          {/* Role Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1">
            {['All', ...roles].map((r) => (
              <button
                key={r}
                onClick={() => setFilter(r as any)}
                className={cn(
                  "px-3 py-1.5 rounded-xl font-bold uppercase transition-all shrink-0",
                  filter === r
                    ? "bg-[#258BFF] text-white shadow-md shadow-blue-500/20"
                    : "bg-[#071426] text-[#9DAEC4] hover:text-white border border-white/5"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Nationality Filter */}
          <div className="flex items-center gap-1.5">
            {(['All', 'Indian', 'Overseas'] as const).map((nat) => (
              <button
                key={nat}
                onClick={() => setNationalityFilter(nat)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                  nationalityFilter === nat
                    ? "bg-white/15 text-white border border-white/20"
                    : "text-[#9DAEC4] hover:text-white"
                )}
              >
                {nat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Players Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredPlayers.map((player) => {
          const activeFormat = selectedFormat || 'T20';
          const playerState = getArenaPlayerState(player.id, activeFormat);
          const rating = playerState ? playerState.currentRating : getPlayerRating(player, activeFormat);
          const formStatus = getPlayerForm(player, activeFormat, playerState);
          const assignedFranchise = franchises.find(f => f.squad.includes(player.id));

          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -4 }}
              onClick={() => setViewedPlayer(player.id)}
              className="glass-card rounded-2xl overflow-hidden border border-white/10 hover:border-cyan-400/60 transition-all cursor-pointer group shadow-lg hover:shadow-cyan-500/10"
            >
              {/* Player Image / Jersey Container */}
              <div className="relative aspect-[3/4] bg-gradient-to-b from-[#152C4D] to-[#071426] overflow-hidden">
                <JerseyPlayerImage
                  player={player}
                  franchiseId={assignedFranchise?.id}
                  className="w-full h-full group-hover:scale-105 transition-transform duration-500 origin-bottom"
                  imageClassName="w-full h-full"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#071426] via-[#071426]/75 to-transparent" />

                {/* Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-black text-white flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 text-[#F5B82E] fill-[#F5B82E]" />
                    {rating}
                  </span>
                </div>

                <div className="absolute top-2 right-2">
                  {player.nationality === 'Overseas' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/30 border border-blue-400/40 text-[9px] font-bold text-blue-200 flex items-center gap-1">
                      <Globe className="w-2.5 h-2.5" /> OS
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/30 border border-emerald-400/40 text-[9px] font-bold text-emerald-200">
                      IND
                    </span>
                  )}
                </div>

                {/* Player Bottom Info */}
                <div className="absolute bottom-2 left-2.5 right-2.5 z-10">
                  <div className="text-[9px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1">
                    {player.role}
                  </div>
                  <div className="text-xs font-black text-white truncate leading-tight group-hover:text-blue-300 transition-colors">
                    {player.name}
                  </div>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="p-2.5 bg-[#071426]/90 border-t border-white/5 flex items-center justify-between text-[10px] text-[#9DAEC4]">
                <span>Base: ₹{(player.basePrice / 10000000).toFixed(1)}Cr</span>
                {assignedFranchise ? (
                  <span className="font-bold text-white px-1.5 py-0.5 rounded bg-white/5">
                    {assignedFranchise.shortName}
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold">Free Agent</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
