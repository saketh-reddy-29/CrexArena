import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INITIAL_PLAYER_POOL } from '../data/players';
import { Shield, Globe, ArrowLeft, Trash2, Zap, Users, Search, Plus, Lock, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import JerseyPlayerImage from './JerseyPlayerImage';

export default function SquadPlanner() {
  const { franchises, selectedFranchiseId, players, goBack, addToSquad, removeFromSquad, addToShortlist, removeFromShortlist, setGameState, setActiveTab, setViewedPlayer } = useGameStore();
  const [playingXI, setPlayingXI] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'name'>('default');
  const [viewTab, setViewTab] = useState<'squad' | 'scout'>('squad');

  const franchise = franchises.find(f => f.id === selectedFranchiseId);

  if (!franchise) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-4">
        <Shield className="w-16 h-16 text-zinc-800 mb-4" />
        <h2 className="text-xl font-bold mb-2">No Franchise Selected</h2>
        <p className="text-zinc-500 mb-6 text-center text-sm max-w-sm">You must select a franchise or start a career before accessing the Squad Planner.</p>
        <button onClick={() => goBack()} className="px-6 py-2 bg-white text-zinc-950 rounded-lg font-bold hover:bg-zinc-200 transition-colors">
          Go Back
        </button>
      </div>
    );
  }

  const squadPlayers = franchise.squad.map(id => players.find(p => p.id === id)).filter(Boolean);
  
  const filteredAvailablePlayers = players.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || player.role === roleFilter;
    const notInSquad = !franchise.squad.includes(player.id);
    return matchesSearch && matchesRole && notInSquad;
  }).sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  }).slice(0, 50); // Limit for performance

  const formatPrice = (price: number) => {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    return `₹${price >= 100000 ? (price / 100000).toFixed(0) + ' L' : price}`;
  };

  const generateBestXI = () => {
    let selectedIds: string[] = [];
    let overseasCount = 0;

    const sorted = [...squadPlayers].sort((a, b) => (b?.rating || 0) - (a?.rating || 0));

    for (const player of sorted) {
        if (!player) continue;
        if (selectedIds.length >= 11) break;

        if (player.nationality === 'Overseas') {
            if (overseasCount < 4) {
                selectedIds.push(player.id);
                overseasCount++;
            }
        } else {
            selectedIds.push(player.id);
        }
    }

    setPlayingXI(selectedIds);
  };

  const overseasInXI = squadPlayers.filter(p => playingXI.includes(p!.id) && p!.nationality === 'Overseas').length;
  const battersInXI = squadPlayers.filter(p => playingXI.includes(p!.id) && p!.role === 'Batsman').length;
  const bowlersInXI = squadPlayers.filter(p => playingXI.includes(p!.id) && p!.role === 'Bowler').length;

  return (
    <div className="flex flex-col h-full font-sans">
      {/* Tab bar */}
      <div className="border-b border-white/[.06] px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex gap-0">
          {(['squad', 'scout'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setViewTab(tab)}
              className={cn(
                "px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all",
                viewTab === tab ? "border-white text-white" : "border-transparent text-white/30 hover:text-white/60"
              )}
            >
              {tab === 'squad' ? 'Squad' : 'Scout'}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 py-4 sm:px-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:gap-6">
            {/* Main content */}
            <div className="lg:col-span-8">
              <AnimatePresence mode="wait">
                {viewTab === 'squad' ? (
                  <motion.div 
                    key="squad-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Playing XI */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold">Playing XI</h3>
                          <span className="text-[10px] text-white font-bold">{playingXI.length}/11</span>
                        </div>
                        {playingXI.length === 0 && (
                          <button 
                            onClick={generateBestXI}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-zinc-950 hover:bg-zinc-200 rounded-lg text-[10px] font-bold active:scale-95 transition-all"
                          >
                            <Zap className="w-3 h-3" /> Auto Best XI
                          </button>
                        )}
                      </div>
                      
                      {playingXI.length > 0 ? (
                        <div className="space-y-2">
                          {playingXI.map((id, idx) => {
                            const player = squadPlayers.find(p => p?.id === id);
                            if (!player) return null;
                            return (
                              <motion.div 
                                layout key={id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
                              >
                                <span className="w-5 text-center text-[10px] font-bold text-white/20">{idx + 1}</span>
                                <div 
                                  className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 cursor-pointer"
                                  onClick={() => setViewedPlayer(player.id)}
                                >
                                  <JerseyPlayerImage 
                                    player={player}
                                    franchiseId={selectedFranchiseId}
                                    className="w-full h-full bg-zinc-800"
                                    imageClassName="w-full h-full"
                                  />
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewedPlayer(player.id)}>
                                  <div className="text-xs font-semibold truncate hover:text-cyan-400 transition-colors">{player.name}</div>
                                  <div className="flex items-center gap-2 text-[9px] text-white/30">
                                    <span>{player.role}</span>
                                    {player.nationality === 'Overseas' && <Globe className="w-2.5 h-2.5 text-zinc-400" />}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-white/30">{player.rating}</span>
                                <button 
                                  onClick={() => setPlayingXI(playingXI.filter(x => x !== id))}
                                  className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
                          <Users className="w-8 h-8 mx-auto mb-2 text-white/10" />
                          <p className="text-[10px] text-white/20 font-bold">No players selected</p>
                        </div>
                      )}
                    </div>

                    {/* Full Roster */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-bold">Full Roster</h3>
                        <span className="text-[10px] text-white/30 font-bold">{squadPlayers.length}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {squadPlayers.map((player) => (
                          <div 
                            key={player!.id}
                            className={cn(
                              "flex items-center gap-3 p-2.5 rounded-xl border transition-all",
                              playingXI.includes(player!.id) 
                                ? "bg-white/5 border-zinc-500/30 opacity-40" 
                                : "bg-zinc-900 border-zinc-800"
                            )}
                          >
                            <div 
                              className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 cursor-pointer"
                              onClick={() => setSelectedPlayerProfile(player!.id)}
                            >
                              <JerseyPlayerImage 
                                player={player}
                                franchiseId={selectedFranchiseId}
                                className="w-full h-full bg-zinc-800"
                                imageClassName="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedPlayerProfile(player!.id)}>
                              <div className="text-xs font-semibold truncate hover:text-cyan-400 transition-colors">{player!.name}</div>
                              <div className="flex items-center gap-2 text-[9px] text-white/30">
                                <span>{player!.role}</span>
                                <span>·</span>
                                <span>{player!.rating}</span>
                                {player!.nationality === 'Overseas' && <Globe className="w-2.5 h-2.5 text-zinc-400" />}
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              {!playingXI.includes(player!.id) && playingXI.length < 11 && (
                                <button 
                                  onClick={() => setPlayingXI([...playingXI, player!.id])}
                                  className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button 
                                onClick={() => {
                                  removeFromSquad(selectedFranchiseId!, player!.id);
                                  setPlayingXI(prev => prev.filter(x => x !== player!.id));
                                }}
                                className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="scout-tab"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Search & Filter */}
                    <div className="premium-card p-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                        <input 
                          type="text" 
                          placeholder="Search player..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg outline-none pl-9 pr-3 py-2 text-xs"
                        />
                      </div>
                      <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-3 text-[10px] font-bold outline-none uppercase text-white/70"
                      >
                        <option value="default">Default Sort</option>
                        <option value="rating">By Rating (High to Low)</option>
                        <option value="name">By Name (A-Z)</option>
                      </select>
                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                        {['All', 'Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'].map(role => (
                          <button 
                            key={role}
                            onClick={() => setRoleFilter(role)}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase transition-all shrink-0",
                              roleFilter === role ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                            )}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {filteredAvailablePlayers.map((player) => {
                        const isSold = franchises.some(f => f.squad.includes(player.id));
                        const isShortlisted = franchise.shortlist?.includes(player.id);
                        return (
                          <div 
                            key={player.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
                          >
                            <div 
                              className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 cursor-pointer"
                              onClick={() => setViewedPlayer(player.id)}
                            >
                              <JerseyPlayerImage 
                                player={player}
                                franchiseId={franchises.find(f => f.squad.includes(player.id))?.id || null}
                                className="w-full h-full bg-zinc-800 opacity-60"
                                imageClassName="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewedPlayer(player.id)}>
                              <div className="text-xs font-semibold truncate hover:text-cyan-400 transition-colors">{player.name}</div>
                              <div className="flex items-center gap-2 text-[9px] text-white/30">
                                <span>{player.role}</span>
                                <span>·</span>
                                <span>{player.rating}</span>
                                <span>·</span>
                                <span>{player.nationality}</span>
                              </div>
                            </div>
                            <button 
                              disabled={isSold}
                              onClick={() => isShortlisted ? removeFromShortlist(selectedFranchiseId!, player.id) : addToShortlist(selectedFranchiseId!, player.id)}
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                isSold 
                                  ? "bg-zinc-900 border border-zinc-800 text-zinc-700 cursor-not-allowed"
                                  : isShortlisted
                                    ? "bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50"
                                    : "bg-white/5 border border-zinc-600 text-white hover:bg-white hover:text-zinc-950"
                              )}
                            >
                              {isSold ? <Lock className="w-4 h-4" /> : isShortlisted ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sidebar - Stats */}
            <div className="lg:col-span-4">
              <div className="premium-card p-4 lg:sticky lg:top-20 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold">Squad Analysis</h3>
                </div>
                
                {/* Overseas */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1.5">
                    <span className="text-white/40">Overseas in XI</span>
                    <span className={overseasInXI > 4 ? 'text-red-400' : 'text-zinc-400'}>{overseasInXI} / 4</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-500", overseasInXI > 4 ? 'bg-red-500' : 'bg-zinc-400')} 
                      style={{ width: `${Math.min(100, (overseasInXI / 4) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Role breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-[9px] text-white/30 font-bold mb-0.5">Batters</div>
                    <div className="text-lg font-bold text-zinc-300">{battersInXI}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-[9px] text-white/30 font-bold mb-0.5">Bowlers</div>
                    <div className="text-lg font-bold text-zinc-300">{bowlersInXI}</div>
                  </div>
                </div>

                <button 
                  disabled={playingXI.length < 11 || overseasInXI > 4}
                  onClick={() => setActiveTab('MATCHES')}
                  className="w-full py-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-30 shadow-md"
                >
                  Confirm Squad
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
