import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Flame, Shield, Trophy } from 'lucide-react';
import { ArenaFormat } from '../engine/models/ArenaState';
import { cn } from '../lib/utils';

export interface TVScoreboardBatter {
  name: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  isStriker?: boolean;
}

export interface TVScoreboardBowler {
  name: string;
  overs: number;
  maidens?: number;
  runs: number;
  wickets: number;
  economy?: number;
}

export interface TVScoreboardProps {
  battingTeamName: string;
  bowlingTeamName: string;
  battingTeamShortName?: string;
  teamLogo?: string;
  teamAccentColor?: string;
  score?: number;
  wickets?: number;
  overs?: number;
  balls?: number;
  totalOvers?: number;
  target?: number | null;
  currentRunRate?: number;
  requiredRunRate?: number | null;
  striker?: TVScoreboardBatter | null;
  nonStriker?: TVScoreboardBatter | null;
  bowler?: TVScoreboardBowler | null;
  recentBalls?: string[];
  partnership?: { runs: number; balls: number };
  format: ArenaFormat;
  innings?: number;
  day?: number;
  session?: number;
  lead?: number | null;
  trail?: number | null;
  activeEventBadge?: string | null;
  isFreeHit?: boolean;
  className?: string;
}

/**
 * Modern TV Broadcast Live Scoreboard Overlay
 * Sits flush and compact at the bottom of the 3D visualizer without obstructing field action.
 */
export default function TVScoreboard({
  battingTeamName,
  bowlingTeamName,
  battingTeamShortName,
  teamLogo,
  teamAccentColor = '#2563EB',
  score = 0,
  wickets = 0,
  overs = 0,
  balls = 0,
  totalOvers = 20,
  target = null,
  currentRunRate,
  requiredRunRate = null,
  striker,
  nonStriker,
  bowler,
  recentBalls = [],
  partnership,
  format,
  innings = 1,
  day = 1,
  session = 1,
  lead = null,
  trail = null,
  activeEventBadge = null,
  isFreeHit = false,
  className,
}: TVScoreboardProps) {
  const isTest = format === 'Test';

  // Format overs string (e.g. 17.3)
  const oversStr = useMemo(() => {
    const fullOvers = Math.floor(balls / 6);
    const remainderBalls = balls % 6;
    return `${fullOvers}.${remainderBalls}`;
  }, [balls, overs]);

  // Compute CRR if not directly provided
  const crr = useMemo(() => {
    if (typeof currentRunRate === 'number' && !isNaN(currentRunRate)) return currentRunRate.toFixed(2);
    if (balls === 0) return '0.00';
    return ((score / balls) * 6).toFixed(2);
  }, [currentRunRate, score, balls]);

  // Compute RRR if target is active
  const rrr = useMemo(() => {
    if (isTest || !target || target <= 0) return null;
    if (typeof requiredRunRate === 'number' && !isNaN(requiredRunRate)) return requiredRunRate.toFixed(2);
    const remainingRuns = target - score;
    const remainingBalls = (totalOvers * 6) - balls;
    if (remainingBalls <= 0) return '0.00';
    return Math.max(0, (remainingRuns / remainingBalls) * 6).toFixed(2);
  }, [isTest, target, score, totalOvers, balls, requiredRunRate]);

  const runsNeeded = target && target > score ? target - score : null;
  const ballsRemaining = totalOvers ? Math.max(0, (totalOvers * 6) - balls) : null;

  // Shorten player names for TV broadcast strip (e.g. "V. Kohli")
  const formatName = (fullName?: string) => {
    if (!fullName) return 'Batter';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
  };

  const shortTeamName = battingTeamShortName || battingTeamName.slice(0, 3).toUpperCase();

  return (
    <div className={cn(
      "w-full bg-[#050c1e]/90 backdrop-blur-md border-t border-white/10 text-white select-none z-30 shadow-2xl relative transition-all",
      className
    )}>
      {/* ── Active Event Micro-Badge (Broadcast Ribbon) ── */}
      <AnimatePresence>
        {(activeEventBadge || isFreeHit) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute -top-7 right-4 z-40 flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-gradient-to-r from-amber-500 to-red-500 text-black font-black text-[10px] uppercase tracking-widest shadow-lg border border-amber-300"
          >
            {activeEventBadge === 'SIX' ? <SparklesIcon className="w-3 h-3 animate-spin" /> : <Flame className="w-3 h-3 animate-pulse" />}
            <span>{activeEventBadge || (isFreeHit ? 'FREE HIT' : '')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar: Match Score & Game Equation ── */}
      <div className="flex items-center justify-between px-3 py-1 bg-gradient-to-r from-black/60 via-slate-900/40 to-black/60 border-b border-white/5 flex-wrap gap-1 text-[11px]">
        {/* Left: Team & Score */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-4 rounded-sm shadow-sm"
              style={{ backgroundColor: teamAccentColor }}
            />
            {teamLogo && (
              <img src={teamLogo} alt={shortTeamName} className="w-4 h-4 object-contain rounded-full bg-white/10 p-0.5" />
            )}
            <span className="font-black text-xs tracking-wider uppercase text-white/95">{shortTeamName}</span>
          </div>

          <div className="flex items-baseline gap-1">
            <motion.span 
              key={score}
              initial={{ scale: 1.15, color: '#FDE047' }}
              animate={{ scale: 1, color: '#FFFFFF' }}
              className="font-black text-base text-white tracking-tight"
            >
              {score}/{wickets}
            </motion.span>
            <span className="text-[10px] font-bold text-white/60">({oversStr} ov)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-bold text-cyan-300">
            <span>CRR</span>
            <span className="text-white font-black">{crr}</span>
          </div>
        </div>

        {/* Right: Equation / Target / Test Match Status */}
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/80">
          {isTest ? (
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-red-950/60 border border-red-500/30 text-red-300 font-bold text-[9px]">
                DAY {day} • SESS {session}
              </span>
              {lead !== null && lead > 0 && <span className="text-emerald-400 font-black">Lead {lead}</span>}
              {trail !== null && trail > 0 && <span className="text-amber-400 font-black">Trail {trail}</span>}
            </div>
          ) : target && target > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-white/60">Target <strong className="text-white font-black">{target}</strong></span>
              {runsNeeded !== null && ballsRemaining !== null && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black">
                  Need {runsNeeded} off {ballsRemaining}b
                </span>
              )}
              {rrr && (
                <span className="hidden sm:inline text-cyan-300">REQ <strong className="text-white font-black">{rrr}</strong></span>
              )}
            </div>
          ) : (
            <span className="text-white/50 text-[9px]">1st Innings • Max {totalOvers} ov</span>
          )}
        </div>
      </div>

      {/* ── Main Broadcast Strip: Batters (Left) & Bowler + Over Log (Right) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-3 py-1.5 text-[10px]">
        {/* Left: Active Batters */}
        <div className="flex items-center justify-between sm:justify-start sm:gap-6 bg-white/[0.02] sm:bg-transparent rounded-lg p-1 sm:p-0">
          {/* Striker */}
          <div className="flex items-center gap-1.5 min-w-[130px]">
            <span className="text-amber-400 font-black text-xs animate-pulse">▶</span>
            <div className="flex flex-col">
              <span className="font-bold text-white truncate max-w-[95px]">{formatName(striker?.name)}</span>
              <div className="flex items-center gap-1 text-[9px] text-white/60 font-mono">
                <span className="text-amber-300 font-black">{striker?.runs ?? 0}*</span>
                <span>({striker?.balls ?? 0})</span>
                {typeof striker?.strikeRate === 'number' && (
                  <span className="hidden sm:inline text-white/40">SR {(striker.strikeRate).toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex items-center gap-1.5 min-w-[120px] opacity-85">
            <span className="text-white/30 text-xs">•</span>
            <div className="flex flex-col">
              <span className="font-bold text-white/90 truncate max-w-[95px]">{formatName(nonStriker?.name)}</span>
              <div className="flex items-center gap-1 text-[9px] text-white/60 font-mono">
                <span className="text-white font-bold">{nonStriker?.runs ?? 0}*</span>
                <span>({nonStriker?.balls ?? 0})</span>
                {typeof nonStriker?.strikeRate === 'number' && (
                  <span className="hidden sm:inline text-white/40">SR {(nonStriker.strikeRate).toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>

          {partnership && partnership.runs > 0 && (
            <div className="hidden lg:flex flex-col text-[9px] text-white/50 border-l border-white/10 pl-3">
              <span>P'ship</span>
              <span className="text-white font-bold">{partnership.runs} ({partnership.balls}b)</span>
            </div>
          )}
        </div>

        {/* Right: Current Bowler & Recent 6 Balls */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
          {/* Bowler Figures */}
          <div className="flex items-center gap-1.5">
            <span className="text-cyan-400 text-xs">🎯</span>
            <div className="flex flex-col">
              <span className="font-bold text-cyan-300 truncate max-w-[100px]">{formatName(bowler?.name)}</span>
              <div className="flex items-center gap-1 text-[9px] text-white/60 font-mono">
                <span className="text-white font-bold">{bowler?.wickets ?? 0}-{bowler?.runs ?? 0}</span>
                <span>({typeof bowler?.overs === 'number' ? bowler.overs : '0.0'})</span>
                {typeof bowler?.economy === 'number' && (
                  <span className="hidden sm:inline text-white/40">Econ {bowler.economy.toFixed(2)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Recent 6 Balls Over Tracker */}
          <div className="flex items-center gap-1 pl-2 border-l border-white/10">
            <span className="hidden sm:inline text-[9px] uppercase font-bold text-white/40 mr-0.5">Over:</span>
            {recentBalls && recentBalls.length > 0 ? (
              recentBalls.slice(-6).map((ball, idx) => {
                const bStr = String(ball).toUpperCase();
                const isWkt = bStr.includes('W');
                const isSix = bStr === '6';
                const isFour = bStr === '4';
                const isDot = bStr === '0' || bStr === '·' || bStr === '.';

                return (
                  <span
                    key={idx}
                    className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] transition-all shadow-sm",
                      isWkt && "bg-red-600 text-white animate-bounce",
                      isSix && "bg-purple-600 text-white font-black",
                      isFour && "bg-blue-600 text-white font-black",
                      isDot && "bg-zinc-800 text-zinc-400",
                      !isWkt && !isSix && !isFour && !isDot && "bg-white/20 text-white"
                    )}
                  >
                    {bStr}
                  </span>
                );
              })
            ) : (
              [0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="w-5 h-5 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-[9px] text-white/20 font-bold">
                  ·
                </span>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}
