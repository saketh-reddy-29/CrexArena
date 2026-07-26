import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import { Franchise, useGameStore } from '../../stores/useGameStore';
import { getPlayerImage, handlePlayerImageError } from '../../lib/playerImages';
import JerseyPlayerImage from '../JerseyPlayerImage';
import { cn } from '../../lib/utils';

interface TeamsTabProps {
  franchises: Franchise[];
}

export default function TeamsTab({ franchises }: TeamsTabProps) {
  const players = useGameStore((state) => state.players);
  const [expandedTeamId, setExpandedTeamId] = React.useState<string | null>(null);

  return (
    <div className="space-y-3">
      {franchises.map(team => {
        const isExpanded = expandedTeamId === team.id;
        const squadPlayers = team.squad
            .map((id) => players.find((player) => player.id === id))
            .filter(Boolean);

        return (
            <div key={team.id} className="premium-card overflow-hidden">
                {/* Team header row */}
                <button
                    onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                    className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-white/[.02] transition-colors"
                >
                    <img src={team.logo} alt={team.shortName} className="w-10 h-10 object-contain shrink-0 drop-shadow" />
                    <div className="flex-1 min-w-0 text-left">
                        <h3 className="text-sm font-bold truncate">{team.name}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-white/30 font-medium">
                            <span>{team.squad.length}/25 players</span>
                            <span>•</span>
                            <span className="text-cyan-300">₹{(team.purse / 10000000).toFixed(1)} Cr</span>
                        </div>
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-white/30 transition-transform shrink-0", isExpanded && "rotate-180")} />
                </button>

                {/* Expandable squad list */}
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="border-t border-white/[.06] bg-[#080c15]/50"
                    >
                        {squadPlayers.length > 0 ? (
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {squadPlayers.map((player) => (
                                    <div key={player!.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[.02] border border-white/[.04]">
                                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-[#0f1629] border border-white/[.06] shrink-0">
                                            <JerseyPlayerImage 
                                              player={player || null}
                                              franchiseId={team.id}
                                              className="w-full h-full bg-zinc-800"
                                              imageClassName="w-full h-full"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 text-xs font-semibold truncate">
                                                {player!.name}
                                                {team.captainId === player!.id && <span className="text-[8px] font-black text-amber-500 bg-amber-500/20 px-1 rounded">C</span>}
                                            </div>
                                            <div className="text-[9px] text-white/30 font-medium">{player!.role} • {player!.rating}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-xs text-white/20 font-bold">No players assigned</div>
                        )}
                    </motion.div>
                )}
            </div>
        );
      })}
    </div>
  );
}
