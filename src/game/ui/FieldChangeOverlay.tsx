import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface FieldChangeOverlayProps {
  isVisible: boolean;
  bowlerName: string;
  bowlingPlan: string;
  strategyName: string;
  changes?: string[];
}

export const FieldChangeOverlay: React.FC<FieldChangeOverlayProps> = ({
  isVisible,
  bowlerName,
  bowlingPlan,
  strategyName,
  changes = [],
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="absolute top-12 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm bg-zinc-950/90 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.8)] text-zinc-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                Tactical Field Setting
              </span>
            </div>
            <span className="text-[9px] font-bold text-zinc-400 uppercase bg-white/5 px-2 py-0.5 rounded">
              {strategyName}
            </span>
          </div>

          {/* Bowler & Plan */}
          <div className="flex items-center justify-between text-xs mb-2 bg-white/5 rounded-lg p-2">
            <div>
              <div className="text-[9px] text-zinc-400 uppercase">Bowler</div>
              <div className="font-bold text-white text-[12px] truncate">{bowlerName}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-zinc-400 uppercase">Plan</div>
              <div className="font-bold text-amber-300 text-[11px]">{bowlingPlan}</div>
            </div>
          </div>

          {/* Field Changes List */}
          {changes.length > 0 && (
            <div className="space-y-1 mb-2 max-h-20 overflow-y-auto custom-scrollbar">
              {changes.slice(0, 3).map((change, i) => (
                <div key={i} className="text-[10px] text-zinc-300 flex items-center gap-1.5">
                  <span className="text-amber-400 text-[11px]">↳</span>
                  <span className="truncate">{change}</span>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] text-zinc-400">
            <span>Fielders repositioning...</span>
            <span className="text-emerald-400 font-bold">Field Ready</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
