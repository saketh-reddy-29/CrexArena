import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Globe } from 'lucide-react';
import { Player } from '../types/common';
import JerseyPlayerImage from './JerseyPlayerImage';

import { getFormatSpecificProfile } from '../lib/ratingEngine';
import { useGameStore, ArenaFormat } from '../stores/useGameStore';
import { cn } from '../lib/utils';

const ProgressBar = ({ label, value, colorClass = "text-cyan-400" }: { label: string, value: number, colorClass?: string }) => {
  const blocks = 20;
  const filled = Math.round((value / 100) * blocks);
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="w-28 sm:w-32 text-white/80 font-medium">{label}</span>
      <div className={`flex-1 font-mono tracking-tighter text-sm ${colorClass}`}>
        {'█'.repeat(filled)}<span className="opacity-30">{'░'.repeat(blocks - filled)}</span>
      </div>
      <span className="w-8 text-right font-black text-white">{value}</span>
    </div>
  );
};

interface PlayerProfileModalProps {
  player: Player | null;
  franchiseId?: string;
  onClose: () => void;
}

export default function PlayerProfileModal({ player, franchiseId, onClose }: PlayerProfileModalProps) {
  const { selectedFormat } = useGameStore();
  const [activeFormat, setActiveFormat] = React.useState<ArenaFormat>(selectedFormat || 'IPL');

  if (!player) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90vw] max-w-[400px] max-h-[90vh] flex flex-col"
      >
        <div className="bg-[#0a0a0a] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative flex flex-col max-h-[90vh]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative h-[200px] sm:h-[280px] shrink-0 bg-gradient-to-b from-[#1a2333] to-[#0a0a0a]">
            <JerseyPlayerImage
              player={player}
              franchiseId={franchiseId}
              className="w-full h-full object-contain pt-4"
              imageClassName="w-full h-full object-contain"
            />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10" />
          </div>

          <div className="px-5 sm:px-6 pb-5 sm:pb-6 relative z-20 -mt-8 flex flex-col gap-3 sm:gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-md" />
                <span className="text-xs font-black text-amber-400">{player.rating}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {player.nationality === 'Indian' ? '🇮🇳 IND' : '🌐 OVS'}
                </span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 backdrop-blur-md shadow-xl">
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {player.role}
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none mb-1">{player.name}</h2>
              <div className="text-cyan-400 font-bold tracking-widest text-[10px] sm:text-[11px] uppercase mt-1">
                Base Price: ₹{(player.basePrice / 10000000).toFixed(2)} Cr
              </div>
            </div>

            {/* Format Tabs */}
            <div className="flex items-center gap-1 bg-[#111827] p-1 rounded-xl border border-white/5 shrink-0">
              {(['TEST', 'ODI', 'T20', 'IPL'] as ArenaFormat[]).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setActiveFormat(fmt)}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                    activeFormat === fmt ? "bg-white text-black" : "text-white/40 hover:text-white/80"
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="bg-[#111827] rounded-xl p-3 sm:p-5 border border-white/10 shadow-inner flex flex-col gap-3 sm:gap-4 shrink-0">
              {(() => {
                const details = getFormatSpecificProfile(player, activeFormat);
                return (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Batting</span>
                      </div>
                      <ProgressBar label="Technique" value={details.batting.technique} />
                      <ProgressBar label="Consistency" value={details.batting.consistency} />
                      <ProgressBar label="Timing" value={details.batting.timing} />
                      <ProgressBar label="Power" value={details.batting.power} />
                      <ProgressBar label="Strike Rotation" value={details.batting.strikeRotation} />
                      <ProgressBar label="Against Pace" value={details.batting.againstPace} />
                      <ProgressBar label="Against Spin" value={details.batting.againstSpin} />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Mental</span>
                      </div>
                      <ProgressBar label="Concentration" value={details.mental.concentration} colorClass="text-purple-400" />
                      <ProgressBar label="Temperament" value={details.mental.temperament} colorClass="text-purple-400" />
                      <ProgressBar label="Aggression" value={details.mental.aggression} colorClass="text-purple-400" />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Fielding</span>
                      </div>
                      <ProgressBar label="Fielding" value={details.fielding.fielding} colorClass="text-green-400" />
                      <ProgressBar label="Catching" value={details.fielding.catching} colorClass="text-green-400" />
                    </div>

                    <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Form</span>
                      </div>
                      <ProgressBar label="Current Form" value={details.form.currentForm} colorClass="text-amber-400" />
                      <ProgressBar label="Fitness" value={details.form.fitness} colorClass="text-amber-400" />
                      <ProgressBar label="Confidence" value={details.form.confidence} colorClass="text-amber-400" />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
