import React, { useState } from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { 
  Users, Shield, Star, Globe, ArrowRight, ChevronRight, 
  DollarSign, Trophy, Search, CheckCircle2 
} from 'lucide-react';
import { resolveTeamLogoUrl } from '../lib/teamLogos';
import { getPlayerImage } from '../lib/playerImages';
import JerseyPlayerImage from './JerseyPlayerImage';
import { cn } from '../lib/utils';
import { Player } from '../types/common';

export default function TeamsView() {
  const { 
    franchises, 
    players, 
    selectedFranchiseId, 
    selectFranchise, 
    setGameState, 
    setActiveTab, 
    setViewedPlayer 
  } = useGameStore();

  const [selectedTeamId, setSelectedTeamId] = useState<string>(selectedFranchiseId || franchises[0]?.id || '1');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper'>('ALL');

  const activeTeam = franchises.find(f => f.id === selectedTeamId) || franchises[0];
  const isUserTeam = activeTeam?.id === selectedFranchiseId;

  // Retrieve players in this squad
  const squadPlayers = React.useMemo(() => {
    if (!activeTeam) return [];
    return activeTeam.squad
      .map(id => players.find(p => p.id === id))
      .filter((p): p is Player => Boolean(p))
      .filter(p => roleFilter === 'ALL' || p.role === roleFilter);
  }, [activeTeam, players, roleFilter]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Competitor Directory & Squads
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-[#258BFF]" />
            Franchises & Squad Management
          </h1>
        </div>
      </div>

      {/* Main Studio View: Teams Sidebar (4 cols) & Squad Roster (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Teams List (4 cols) */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-xs font-black text-[#9DAEC4] uppercase tracking-wider mb-2 px-1">
            Participating Teams ({franchises.length})
          </div>

          <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
            {franchises.map(team => {
              const isSelected = team.id === selectedTeamId;
              const isUser = team.id === selectedFranchiseId;

              return (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                    isSelected
                      ? "border-[#258BFF] bg-gradient-to-r from-[#10233D] to-[#152C4D] shadow-lg shadow-blue-500/10"
                      : "border-white/5 bg-[#071426]/70 hover:border-white/20 hover:bg-[#10233D]/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center p-1.5 border border-white/10 shrink-0 bg-[#071426]">
                      <img
                        src={resolveTeamLogoUrl(team.shortName, team.logo)}
                        alt={team.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">
                          {team.name}
                        </span>
                        {isUser && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-black border border-blue-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#9DAEC4] flex items-center gap-2 mt-0.5">
                        <span>Squad: {team.squad.length}/25</span>
                        <span>•</span>
                        <span>Overseas: {team.overseasCount}/8</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-[#F5B82E]">
                      ₹{(team.purse / 10000000).toFixed(1)} Cr
                    </div>
                    <div className="text-[9px] text-[#9DAEC4]">Purse</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Team Squad Details (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {activeTeam && (
            <>
              {/* Team Profile Banner */}
              <div 
                className="glass-card rounded-3xl p-6 border border-white/10 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${activeTeam.color}25 0%, #0D1C32 60%, #071426 100%)`
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-[#071426]/80 p-2.5 border border-white/10 shadow-xl">
                      <img
                        src={resolveTeamLogoUrl(activeTeam.shortName, activeTeam.logo)}
                        alt={activeTeam.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black text-white tracking-tight">{activeTeam.name}</h2>
                        {isUserTeam && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                            USER CONTROLLED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#9DAEC4] mt-1 font-medium">
                        Strategy: <span className="font-bold text-white">{activeTeam.strategy || 'Balanced'}</span> • 
                        Purse Remaining: <span className="font-bold text-[#F5B82E]">₹{(activeTeam.purse / 10000000).toFixed(2)} Cr</span>
                      </p>
                    </div>
                  </div>

                  {isUserTeam && (
                    <button
                      onClick={() => setGameState(GameState.PLAYING_XI_BUILDER)}
                      className="px-5 py-2.5 rounded-xl bg-[#258BFF] hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider btn-glow transition-all active:scale-95 cursor-pointer shadow-lg"
                    >
                      Configure Playing XI
                    </button>
                  )}
                </div>
              </div>

              {/* Squad Role Filters */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide text-xs">
                  {(['ALL', 'Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'] as const).map(role => (
                    <button
                      key={role}
                      onClick={() => setRoleFilter(role)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl font-bold uppercase transition-all shrink-0",
                        roleFilter === role
                          ? "bg-[#258BFF] text-white shadow-sm"
                          : "bg-white/5 text-[#9DAEC4] hover:text-white"
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-[#9DAEC4] font-bold">
                  {squadPlayers.length} Players
                </div>
              </div>

              {/* Squad Players Grid with Real Player Images */}
              {squadPlayers.length === 0 ? (
                <div className="glass-card rounded-2xl p-12 text-center text-[#9DAEC4] italic">
                  No players found in this category for {activeTeam.name}.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {squadPlayers.map(player => (
                    <div
                      key={player.id}
                      onClick={() => setViewedPlayer(player.id)}
                      className="glass-card rounded-2xl overflow-hidden border border-white/10 hover:border-cyan-400/60 transition-all cursor-pointer group hover:shadow-xl hover:-translate-y-1"
                    >
                      {/* Player Image / Jersey */}
                      <div className="relative aspect-[4/5] bg-gradient-to-b from-[#152C4D] to-[#071426] overflow-hidden">
                        <JerseyPlayerImage
                          player={player}
                          franchiseId={activeTeam.id}
                          className="w-full h-full group-hover:scale-105 transition-transform duration-500 origin-bottom"
                          imageClassName="w-full h-full"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#071426] via-[#071426]/70 to-transparent" />

                        {/* Badges */}
                        <div className="absolute top-2 left-2 flex items-center gap-1">
                          <span className="px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-black text-white flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 text-[#F5B82E] fill-[#F5B82E]" />
                            {player.rating}
                          </span>
                        </div>

                        {player.nationality === 'Overseas' && (
                          <div className="absolute top-2 right-2">
                            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/30 border border-blue-400/40 text-[9px] font-bold text-blue-200 flex items-center gap-1">
                              <Globe className="w-2.5 h-2.5" /> OS
                            </span>
                          </div>
                        )}

                        <div className="absolute bottom-2 left-2.5 right-2.5">
                          <div className="text-[9px] font-black text-cyan-400 uppercase tracking-widest leading-none mb-1">
                            {player.role}
                          </div>
                          <div className="text-xs font-black text-white truncate leading-tight group-hover:text-blue-300 transition-colors">
                            {player.name}
                          </div>
                        </div>
                      </div>

                      {/* Stats snippet */}
                      <div className="p-2.5 bg-[#071426]/90 border-t border-white/5 flex items-center justify-between text-[10px] text-[#9DAEC4]">
                        <span>Form: {player.form ?? 85}</span>
                        <span className="font-bold text-white">₹{(player.basePrice / 10000000).toFixed(1)}Cr</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
