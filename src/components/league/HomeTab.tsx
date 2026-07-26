import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Users, Calendar } from 'lucide-react';
import { Franchise } from '../../stores/useGameStore';

interface HomeTabProps {
  franchises: Franchise[];
}

export default function HomeTab({ franchises }: HomeTabProps) {
  return (
    <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="premium-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Trophy className="w-5 h-5 text-cyan-300" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-white/30 uppercase">Season</div>
                    <div className="text-sm font-bold">IPL 2024</div>
                </div>
            </div>
            <div className="premium-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-white/30 uppercase">Teams</div>
                    <div className="text-sm font-bold">{franchises.length} Franchises</div>
                </div>
            </div>
            <div className="premium-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                    <div className="text-[10px] font-bold text-white/30 uppercase">Format</div>
                    <div className="text-sm font-bold">T20</div>
                </div>
            </div>
        </div>

        <div className="premium-card p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Latest Update</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2 leading-tight">Auction Complete — League Phase Begins!</h2>
            <p className="text-sm text-white/40 leading-relaxed">All squads are finalized. Navigate to the Schedule tab to start playing matches day by day.</p>
        </div>
    </div>
  );
}
