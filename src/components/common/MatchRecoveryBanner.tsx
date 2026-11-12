import React, { useState, useEffect } from 'react';
import { Play, ShieldCheck, Clock, Radio, Users, CheckCircle2, WifiOff, AlertTriangle, Trash2 } from 'lucide-react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { matchRecoveryStorage } from '../../engine/storage/MatchRecoveryStorage';
import { MatchCheckpoint, MatchSaveStatus } from '../../types/matchRecovery';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';

export default function MatchRecoveryBanner() {
  const { 
    activeMatchCheckpoint, 
    setCurrentMatch, 
    setGameState, 
    clearMatchCheckpointAction,
    franchises 
  } = useGameStore();

  const [checkpoint, setCheckpoint] = useState<MatchCheckpoint | null>(activeMatchCheckpoint);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [storageStatus, setStorageStatus] = useState<MatchSaveStatus>('ALL PROGRESS SAVED');

  useEffect(() => {
    let isMounted = true;
    async function loadLatest() {
      if (activeMatchCheckpoint && !activeMatchCheckpoint.isMatchOver) {
        setCheckpoint(activeMatchCheckpoint);
      } else {
        const latest = await matchRecoveryStorage.getLatestUnfinishedMatch();
        if (isMounted && latest && !latest.isMatchOver && !latest.resultSubmitted) {
          setCheckpoint(latest);
        }
      }
    }
    loadLatest();

    const unsub = matchRecoveryStorage.onStatusChange((status) => {
      if (isMounted) setStorageStatus(status);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [activeMatchCheckpoint]);

  if (!checkpoint || checkpoint.isMatchOver || checkpoint.resultSubmitted) {
    return null;
  }

  const team1 = franchises.find(f => f.id === checkpoint.team1Id);
  const team2 = franchises.find(f => f.id === checkpoint.team2Id);
  const t1Logo = resolveTeamLogoUrl(checkpoint.team1ShortName || team1?.shortName, team1?.logo);
  const t2Logo = resolveTeamLogoUrl(checkpoint.team2ShortName || team2?.shortName, team2?.logo);

  const handleResume = () => {
    setCurrentMatch(checkpoint.matchId);
    setGameState(GameState.MATCH_SIMULATION);
  };

  const handleDiscard = async () => {
    if (window.confirm('Are you sure you want to discard this match? Unsaved progress will be lost.')) {
      await clearMatchCheckpointAction(checkpoint.matchId);
      setCheckpoint(null);
      setShowStatusModal(false);
    }
  };

  const savedTimeFormatted = checkpoint.savedAt 
    ? new Date(checkpoint.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Recently';

  return (
    <>
      <div className="w-full mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#10233D] via-[#0E2849] to-[#0A3326] border-2 border-[#F5B82E]/50 shadow-[0_0_30px_rgba(245,184,46,0.15)] relative overflow-hidden">
        {/* Glowing Stadium Accent Light */}
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#13A875]/15 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Badge & Match Details */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[11px] font-black uppercase tracking-wider animate-pulse">
                <Radio className="w-3.5 h-3.5" />
                MATCH IN PROGRESS — CONTINUE PLAYING
              </span>

              <span className="px-2 py-0.5 rounded-md bg-white/10 text-[#F5B82E] text-[10px] font-black uppercase tracking-wider">
                {checkpoint.format || 'T20'} · Innings {checkpoint.inningNo}
              </span>

              <span className="text-[11px] text-[#9DAEC4] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#13A875]" />
                Saved at {savedTimeFormatted}
              </span>
            </div>

            {/* Teams & Score */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 pt-1">
              <div className="flex items-center gap-2 font-black text-base sm:text-lg text-white">
                <img src={t1Logo} alt={checkpoint.team1ShortName} className="w-6 h-6 object-contain" />
                <span>{checkpoint.team1ShortName || checkpoint.team1Name}</span>
                <span className="text-white/40 text-xs font-normal">vs</span>
                <span>{checkpoint.team2ShortName || checkpoint.team2Name}</span>
                <img src={t2Logo} alt={checkpoint.team2ShortName} className="w-6 h-6 object-contain" />
              </div>

              {/* Large Score Callout */}
              <div className="px-3 py-1 rounded-xl bg-black/40 border border-white/10 flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-black text-[#F5B82E]">
                  {checkpoint.currentRuns}/{checkpoint.currentWickets}
                </span>
                <span className="text-xs font-bold text-[#9DAEC4]">
                  ({checkpoint.oversFormatted} ov)
                </span>
                {Boolean(checkpoint.matchTarget) && (
                  <span className="text-[11px] font-bold text-emerald-400">
                    Target: {checkpoint.matchTarget}
                  </span>
                )}
              </div>
            </div>

            {/* On-Field Summary (Batters & Bowler) */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-[#9DAEC4] pt-0.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="font-bold text-white">Batting:</span>
                <span>
                  {checkpoint.strikerName || 'Striker'} ({checkpoint.strikerRuns ?? 0}* / {checkpoint.strikerBalls ?? 0})
                  {checkpoint.nonStrikerName ? ` & ${checkpoint.nonStrikerName} (${checkpoint.nonStrikerRuns ?? 0} / ${checkpoint.nonStrikerBalls ?? 0})` : ''}
                </span>
              </div>

              {Boolean(checkpoint.bowlerName) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-white/30">•</span>
                  <span className="font-bold text-white">Bowling:</span>
                  <span>
                    {checkpoint.bowlerName} ({checkpoint.bowlerWickets ?? 0}/{checkpoint.bowlerRuns ?? 0} in {checkpoint.bowlerOvers ?? '0.0'} ov)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-start lg:self-center shrink-0">
            <button
              onClick={() => setShowStatusModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/90 text-xs font-bold transition-all flex items-center gap-2 hover:border-white/30 cursor-pointer"
              title="View Checkpoint & Recovery Status"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>SAVE STATUS</span>
            </button>

            <button
              onClick={handleResume}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#258BFF] to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(37,139,255,0.4)] flex items-center gap-2 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>RESUME MATCH</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#071426] border border-white/15 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="font-black text-white text-base">Match Recovery Status</h3>
              </div>
              <button 
                onClick={() => setShowStatusModal(false)}
                className="text-white/60 hover:text-white text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-[#9DAEC4]">Autosave Protection</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Continuous After Every Delivery
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-[#9DAEC4]">Current Save Status</span>
                <span className="font-bold text-[#F5B82E]">
                  {storageStatus}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-[#9DAEC4]">Storage Mechanism</span>
                <span className="font-mono text-white/80">IndexedDB + Local Backup + DB</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-[#9DAEC4]">Last Committed Delivery</span>
                <span className="font-mono text-white/80 truncate max-w-[180px]">
                  {checkpoint.lastCompletedDeliveryId || checkpoint.lastCommittedDeliveryId || 'Verified'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-[#9DAEC4]">Score At Checkpoint</span>
                <span className="font-bold text-white">
                  {checkpoint.currentRuns}/{checkpoint.currentWickets} ({checkpoint.oversFormatted} ov)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                onClick={handleDiscard}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Discard Match
              </button>

              <button
                onClick={() => {
                  setShowStatusModal(false);
                  handleResume();
                }}
                className="px-4 py-2 rounded-xl bg-[#258BFF] text-white font-black text-xs uppercase cursor-pointer hover:bg-blue-600 transition-colors"
              >
                Resume Now
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
