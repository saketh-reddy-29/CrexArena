import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  ShieldAlert, 
  Target, 
  Activity, 
  Flame, 
  UserCheck 
} from 'lucide-react';
import { Player } from '../types/common';
import { ArenaFormat } from '../engine/models/ArenaState';
import { getPlayerImage, handlePlayerImageError } from '../lib/playerImages';
import { MatchEngine } from '../lib/matchEngine';
import { cn } from '../lib/utils';

export interface PlayerSelectionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'OPENERS' | 'BATTER' | 'BOWLER';
  teamName: string;
  squad: Player[];
  format: ArenaFormat;
  currentScore?: {
    batters?: Record<string, any>;
    bowlers?: Record<string, any>;
    balls?: number;
  };
  currentStrikerId?: string | null;
  currentNonStrikerId?: string | null;
  lastOverBowlerId?: string | null;
  aiRecommendedPlayerId?: string | null;
  aiReasoning?: string | null;
  onConfirmOpeners?: (strikerId: string, nonStrikerId: string) => void;
  onConfirmBatter?: (batterId: string) => void;
  onConfirmBowler?: (bowlerId: string) => void;
}

export default function PlayerSelectionDrawer({
  isOpen,
  onClose,
  mode,
  teamName,
  squad,
  format,
  currentScore,
  currentStrikerId,
  currentNonStrikerId,
  lastOverBowlerId,
  aiRecommendedPlayerId,
  aiReasoning,
  onConfirmOpeners,
  onConfirmBatter,
  onConfirmBowler,
}: PlayerSelectionDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'BATSMAN' | 'ALL_ROUNDER' | 'BOWLER' | 'WICKETKEEPER'>('ALL');
  
  // Selection states
  const [selectedStrikerId, setSelectedStrikerId] = useState<string | null>(currentStrikerId || squad[0]?.id || null);
  const [selectedNonStrikerId, setSelectedNonStrikerId] = useState<string | null>(currentNonStrikerId || squad[1]?.id || null);
  const [selectedSinglePlayerId, setSelectedSinglePlayerId] = useState<string | null>(
    aiRecommendedPlayerId || (mode === 'BOWLER' ? null : null)
  );

  // Reset or initialize on open
  React.useEffect(() => {
    if (isOpen) {
      if (mode === 'OPENERS') {
        setSelectedStrikerId(currentStrikerId || squad[0]?.id || null);
        setSelectedNonStrikerId(currentNonStrikerId || squad[1]?.id || null);
      } else if (mode === 'BOWLER') {
        setSelectedSinglePlayerId(aiRecommendedPlayerId || null);
      } else if (mode === 'BATTER') {
        setSelectedSinglePlayerId(aiRecommendedPlayerId || null);
      }
    }
  }, [isOpen, mode, currentStrikerId, currentNonStrikerId, aiRecommendedPlayerId, squad]);

  const maxOversPerBowler = MatchEngine.getMaxOversPerBowler(format);

  // Player eligibility check
  const getPlayerEligibility = (player: Player): { isEligible: boolean; reason?: string } => {
    const bStats = currentScore?.batters?.[player.id];
    const bowlStats = currentScore?.bowlers?.[player.id];
    const ballsBowled = bowlStats?.balls || 0;
    const oversBowled = Math.floor(ballsBowled / 6);

    if (mode === 'OPENERS') {
      return { isEligible: true };
    }

    if (mode === 'BATTER') {
      // Must not be already out
      if (bStats?.out) {
        return { isEligible: false, reason: 'Already Dismissed (Out)' };
      }
      // Must not already be at the crease
      if (player.id === currentStrikerId || player.id === currentNonStrikerId) {
        return { isEligible: false, reason: 'Already at Crease' };
      }
      return { isEligible: true };
    }

    if (mode === 'BOWLER') {
      // Rule: cannot bowl consecutive overs
      if (lastOverBowlerId && player.id === lastOverBowlerId) {
        return { isEligible: false, reason: 'Cannot bowl consecutive overs' };
      }
      // Rule: Max overs check in limited overs
      if (format !== 'TEST' && oversBowled >= maxOversPerBowler) {
        return { isEligible: false, reason: `Max ${maxOversPerBowler} overs limit reached` };
      }
      // Rule: Pure batter or pure keeper without bowling attributes
      const role = player.role?.toLowerCase() || '';
      const isPureBatter = role === 'batsman' && (player.stats?.bowling || 0) < 40;
      const isPureKeeper = (role === 'wicketkeeper' || role === 'wk') && (player.stats?.bowling || 0) < 35;
      if (isPureBatter) {
        return { isEligible: false, reason: 'Specialist Batsman (Ineligible to bowl)' };
      }
      if (isPureKeeper) {
        return { isEligible: false, reason: 'Specialist Wicketkeeper (Ineligible to bowl)' };
      }
      return { isEligible: true };
    }

    return { isEligible: true };
  };

  // Filtered squad list
  const filteredSquad = useMemo(() => {
    return squad.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (roleFilter === 'ALL') return true;
      const role = p.role?.toUpperCase().replace(/[- ]/g, '_') || '';
      if (roleFilter === 'BATSMAN') return role.includes('BAT');
      if (roleFilter === 'ALL_ROUNDER') return role.includes('ALL');
      if (roleFilter === 'BOWLER') return role.includes('BOWL');
      if (roleFilter === 'WICKETKEEPER') return role.includes('KEEPER') || role.includes('WK');
      return true;
    });
  }, [squad, searchQuery, roleFilter]);

  const handleConfirm = () => {
    if (mode === 'OPENERS') {
      if (selectedStrikerId && selectedNonStrikerId && selectedStrikerId !== selectedNonStrikerId) {
        onConfirmOpeners?.(selectedStrikerId, selectedNonStrikerId);
        onClose();
      }
    } else if (mode === 'BATTER') {
      if (selectedSinglePlayerId) {
        onConfirmBatter?.(selectedSinglePlayerId);
        onClose();
      }
    } else if (mode === 'BOWLER') {
      if (selectedSinglePlayerId) {
        onConfirmBowler?.(selectedSinglePlayerId);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl bg-[#090d1a] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/10 flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                  {mode === 'OPENERS' ? 'Innings Opening Setup' : mode === 'BATTER' ? 'Incoming Batter Selection' : 'Bowler Selection'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{teamName}</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                {mode === 'OPENERS' 
                  ? 'Select Opening Batter Pair' 
                  : mode === 'BATTER' 
                  ? 'Choose Next Batter to Enter Crease' 
                  : 'Assign Next Bowler for the Over'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* AI Recommendation Banner (if available) */}
          {aiRecommendedPlayerId && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-200">
                    AI Captain Recommends:{' '}
                    <span className="text-white font-black">
                      {squad.find(p => p.id === aiRecommendedPlayerId)?.name}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      if (mode === 'OPENERS') {
                        setSelectedStrikerId(aiRecommendedPlayerId);
                      } else {
                        setSelectedSinglePlayerId(aiRecommendedPlayerId);
                      }
                    }}
                    className="text-[10px] font-black text-purple-300 hover:text-white bg-purple-900/50 hover:bg-purple-800/80 px-2 py-0.5 rounded border border-purple-500/40 transition-colors"
                  >
                    Quick Select
                  </button>
                </div>
                {aiReasoning && (
                  <p className="text-[11px] text-purple-300/80 leading-relaxed">
                    {aiReasoning}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Search & Role Filter Tabs */}
          <div className="px-5 pt-3 pb-2 space-y-2 border-b border-white/5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search player name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] font-bold">
              {(['ALL', 'BATSMAN', 'ALL_ROUNDER', 'BOWLER', 'WICKETKEEPER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all whitespace-nowrap",
                    roleFilter === r
                      ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                      : "bg-white/[0.03] text-slate-400 hover:text-white border border-white/5"
                  )}
                >
                  {r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Players List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2 max-h-[46vh]">
            {filteredSquad.map((player) => {
              const { isEligible, reason } = getPlayerEligibility(player);
              const bLine = currentScore?.batters?.[player.id];
              const bowlLine = currentScore?.bowlers?.[player.id];
              const oversBowled = bowlLine?.balls ? Math.floor(bowlLine.balls / 6) : 0;
              const ballsRemainder = bowlLine?.balls ? bowlLine.balls % 6 : 0;
              const isAiRec = player.id === aiRecommendedPlayerId;

              // Selection checks
              const isStrikerSelected = selectedStrikerId === player.id;
              const isNonStrikerSelected = selectedNonStrikerId === player.id;
              const isSingleSelected = selectedSinglePlayerId === player.id;

              return (
                <div
                  key={player.id}
                  onClick={() => {
                    if (!isEligible) return;
                    if (mode === 'OPENERS') {
                      if (!selectedStrikerId || selectedStrikerId === player.id) {
                        setSelectedStrikerId(player.id);
                      } else if (selectedNonStrikerId === player.id) {
                        setSelectedNonStrikerId(null);
                      } else {
                        setSelectedNonStrikerId(player.id);
                      }
                    } else {
                      setSelectedSinglePlayerId(player.id);
                    }
                  }}
                  className={cn(
                    "p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
                    !isEligible
                      ? "bg-red-950/10 border-red-500/20 opacity-60 cursor-not-allowed"
                      : isSingleSelected || isStrikerSelected || isNonStrikerSelected
                      ? "bg-cyan-950/40 border-cyan-400 shadow-md shadow-cyan-500/10 cursor-pointer"
                      : "bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04] cursor-pointer"
                  )}
                >
                  {/* Left: Avatar & Meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={getPlayerImage(player)}
                        onError={(e) => handlePlayerImageError(e, player.name)}
                        className="w-10 h-10 rounded-full object-cover object-top border border-white/10"
                        alt={player.name}
                      />
                      {isAiRec && (
                        <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-0.5 shadow">
                          <Sparkles className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white truncate max-w-[140px] sm:max-w-[200px]">
                          {player.name}
                        </span>
                        {isAiRec && (
                          <span className="text-[9px] font-black text-purple-300 bg-purple-950 px-1.5 py-0.2 rounded border border-purple-500/40">
                            AI REC
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-bold text-slate-300">{player.role}</span>
                        <span>•</span>
                        <span>{player.bowlingStyle || (player as any).battingHand || 'RHB'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Performance or Reason */}
                  <div className="text-right shrink-0">
                    {!isEligible ? (
                      <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 justify-end">
                        <ShieldAlert className="w-3 h-3" />
                        {reason}
                      </span>
                    ) : mode === 'BOWLER' ? (
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-white tabular-nums">
                          {oversBowled}.{ballsRemainder} ov {format !== 'TEST' && `(${maxOversPerBowler - oversBowled} left)`}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {bowlLine ? `${bowlLine.wickets} wkt • ${bowlLine.runs} runs` : 'Yet to bowl'}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-white tabular-nums">
                          {bLine ? `${bLine.runs} runs (${bLine.balls}b)` : 'Yet to bat'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Bat Rating: <span className="text-cyan-300 font-bold">{player.stats?.batting || 70}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Selection Indicators */}
                  <div className="shrink-0 flex items-center gap-1.5">
                    {mode === 'OPENERS' ? (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={!isEligible}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStrikerId(player.id);
                            if (selectedNonStrikerId === player.id) setSelectedNonStrikerId(null);
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase transition-all",
                            isStrikerSelected
                              ? "bg-cyan-500 text-slate-950 font-black shadow"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          )}
                        >
                          Striker
                        </button>
                        <button
                          disabled={!isEligible}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNonStrikerId(player.id);
                            if (selectedStrikerId === player.id) setSelectedStrikerId(null);
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase transition-all",
                            isNonStrikerSelected
                              ? "bg-amber-500 text-slate-950 font-black shadow"
                              : "bg-white/5 text-slate-400 hover:text-white"
                          )}
                        >
                          Non-Striker
                        </button>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                          isSingleSelected
                            ? "bg-cyan-500 border-cyan-400 text-slate-950 font-black"
                            : "border-white/20 bg-white/5 text-transparent"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Action Bar */}
          <div className="px-5 py-3 border-t border-white/10 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              {mode === 'OPENERS' ? (
                <span>
                  Striker:{' '}
                  <span className="text-cyan-300 font-bold">
                    {squad.find(p => p.id === selectedStrikerId)?.name || 'Not selected'}
                  </span>
                  {' '}• Non-Striker:{' '}
                  <span className="text-amber-300 font-bold">
                    {squad.find(p => p.id === selectedNonStrikerId)?.name || 'Not selected'}
                  </span>
                </span>
              ) : (
                <span>
                  Selected:{' '}
                  <span className="text-cyan-300 font-black">
                    {squad.find(p => p.id === selectedSinglePlayerId)?.name || 'None'}
                  </span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-bold border border-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={
                  mode === 'OPENERS' 
                    ? !selectedStrikerId || !selectedNonStrikerId || selectedStrikerId === selectedNonStrikerId
                    : !selectedSinglePlayerId
                }
                className={cn(
                  "px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg transition-all",
                  (mode === 'OPENERS' ? selectedStrikerId && selectedNonStrikerId && selectedStrikerId !== selectedNonStrikerId : selectedSinglePlayerId)
                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                )}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirm Selection
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
