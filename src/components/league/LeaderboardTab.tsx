import React from 'react';
import { motion } from 'framer-motion';
import { Franchise, useGameStore } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';

interface LeaderboardTabProps {
  franchises: Franchise[];
}

export default function LeaderboardTab({ franchises }: LeaderboardTabProps) {
  const { standings } = useGameStore();
  
  const sortedStandings = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  
  return (
    <div className="space-y-4">
        {/* Points table */}
        <div className="premium-card overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[auto_1fr_repeat(5,minmax(32px,48px))] gap-2 px-3 py-2.5 bg-white/[.03] border-b border-white/[.06] text-[9px] font-bold text-white/30 uppercase tracking-wider sm:px-4 sm:gap-3">
                <span className="w-6 text-center">#</span>
                <span>Team</span>
                <span className="text-center">P</span>
                <span className="text-center">W</span>
                <span className="text-center">L</span>
                <span className="text-center">Pts</span>
                <span className="text-center">NRR</span>
            </div>

            {/* Rows */}
            {sortedStandings.map((s, idx) => {
                const team = franchises.find(f => f.id === s.teamId)!;
                return (
                    <div key={team.id} className={cn(
                        "grid grid-cols-[auto_1fr_repeat(5,minmax(32px,48px))] gap-2 px-3 py-2.5 items-center border-b border-white/[.04] hover:bg-white/[.02] transition-colors sm:px-4 sm:gap-3",
                        idx < 4 && "bg-cyan-500/[.02]"
                    )}>
                        <span className={cn(
                            "w-6 text-center text-xs font-bold",
                            idx < 4 ? "text-cyan-300" : "text-white/25"
                        )}>{idx + 1}</span>
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img src={team.logo} alt={team.shortName} className="w-7 h-7 shrink-0 object-contain drop-shadow" />
                            <span className="text-xs font-semibold truncate">{team.name}</span>
                        </div>
                        <span className="text-center text-xs text-white/50 font-medium">{s.played}</span>
                        <span className="text-center text-xs text-cyan-300 font-bold">{s.won}</span>
                        <span className="text-center text-xs text-red-400/60 font-medium">{s.lost}</span>
                        <span className="text-center text-sm font-bold">{s.points}</span>
                        <span className={cn(
                            "text-center text-[11px] font-semibold",
                            s.nrr >= 0 ? "text-cyan-300/70" : "text-red-400/60"
                        )}>
                            {s.nrr > 0 ? '+' : ''}{s.nrr.toFixed(3)}
                        </span>
                    </div>
                );
            })}
        </div>

        <div className="flex items-center gap-2 px-1 text-[10px] text-white/20">
            <div className="w-3 h-3 rounded bg-cyan-500/10 border border-cyan-500/20" />
            <span>Top 4 qualify for playoffs</span>
        </div>
    </div>
  );
}
