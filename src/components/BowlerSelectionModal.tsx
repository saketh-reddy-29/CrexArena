import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Shield, Zap, X, AlertCircle } from 'lucide-react';
import { Player } from '../types/common';
import { cn } from '../lib/utils';
import { isEligibleBowler, canBowlerBowlAnotherOver } from '../engine/rules/bowlerEligibility';

export interface BowlerStatsSummary {
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface BowlerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bowlingSquad: Player[];
  currentBowlerId: string | null;
  lastOverBowlerId?: string | null;
  bowlerStatsMap?: Record<string, BowlerStatsSummary>;
  onSelectBowler: (bowlerId: string) => void;
  format?: 'TEST' | 'ODI' | 'T20';
  bowlingTeamName?: string;
}

export const BowlerSelectionModal: React.FC<BowlerSelectionModalProps> = ({
  isOpen,
  onClose,
  bowlingSquad,
  currentBowlerId,
  lastOverBowlerId,
  bowlerStatsMap = {},
  onSelectBowler,
  format = 'TEST',
  bowlingTeamName = 'Bowling Team',
}) => {
  if (!isOpen) return null;

  // Filter strictly eligible bowlers
  const eligibleBowlers = bowlingSquad.filter((p) => isEligibleBowler(p));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none"
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-6 py-4 bg-zinc-900/60">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Tactical Bowling Change
                </span>
              </div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Select Bowler — {bowlingTeamName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subtitle / Rules Note */}
          <div className="px-6 py-2.5 bg-zinc-900/30 border-b border-zinc-800/40 text-xs text-zinc-400 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>
              Choose an eligible specialist or all-rounder. {format === 'ODI' ? 'Maximum 10 overs per bowler in ODI.' : 'Bowler cannot bowl consecutive overs.'}
            </span>
          </div>

          {/* Bowlers List */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 max-h-[55vh] custom-scrollbar">
            {eligibleBowlers.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm">
                No eligible bowlers found in squad.
              </div>
            ) : (
              eligibleBowlers.map((bowler) => {
                const isCurrent = bowler.id === currentBowlerId;
                const isLastOver = bowler.id === lastOverBowlerId;
                const stats = bowlerStatsMap[bowler.id];
                const oversBowled = stats?.overs || 0;
                const maxOversReached = format === 'ODI' && !canBowlerBowlAnotherOver(bowler, oversBowled, 'ODI');
                const isPace = !bowler.bowlingStyle?.toLowerCase().includes('spin');

                return (
                  <div
                    key={bowler.id}
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3",
                      isCurrent
                        ? "bg-amber-500/10 border-amber-500/40 shadow-inner"
                        : maxOversReached
                        ? "bg-zinc-900/30 border-zinc-800/40 opacity-50"
                        : "bg-zinc-900/70 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border",
                        isPace ? "bg-rose-950/60 border-rose-500/30 text-rose-300" : "bg-sky-950/60 border-sky-500/30 text-sky-300"
                      )}>
                        {bowler.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white truncate">{bowler.name}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Active
                            </span>
                          )}
                          {isLastOver && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-800 text-zinc-400">
                              Last Over
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                          <span className="text-zinc-300 font-medium">{bowler.bowlingStyle || 'Right-arm Pace'}</span>
                          <span>•</span>
                          <span>Rating: <strong className="text-white">{bowler.bowlingRating || bowler.rating || 80}</strong></span>
                          {format === 'ODI' && (
                            <>
                              <span>•</span>
                              <span className={oversBowled >= 10 ? "text-rose-400 font-bold" : "text-zinc-400"}>
                                {oversBowled}/10 ov
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Match Figures */}
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-zinc-200">
                          {stats ? `${stats.overs}-${stats.maidens}-${stats.runs}-${stats.wickets}` : '0-0-0-0'}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          Econ: {stats ? stats.economy.toFixed(2) : '0.00'}
                        </div>
                      </div>

                      {/* Select Action Button */}
                      <button
                        onClick={() => {
                          if (maxOversReached) return;
                          onSelectBowler(bowler.id);
                          onClose();
                        }}
                        disabled={isCurrent || maxOversReached}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all",
                          isCurrent
                            ? "bg-zinc-800 text-zinc-500 cursor-default"
                            : maxOversReached
                            ? "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                            : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md hover:scale-105 active:scale-95"
                        )}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{isCurrent ? 'Bowling' : maxOversReached ? 'Limit' : 'Select'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 bg-zinc-900/50 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Eligible Squad Bowlers: {eligibleBowlers.length}</span>
            <button
              onClick={onClose}
              className="px-3.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200"
            >
              Done
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
export default BowlerSelectionModal;
