import React, { useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

export interface DebugDeliveryData {
  format?: string;
  day?: number;
  session?: number | string;
  innings?: number;
  over?: number;
  ball?: number;
  strikerName?: string;
  nonStrikerName?: string;
  bowlerName?: string;
  bowlerRole?: string;
  bowlerAnimation?: string;
  currentPlayerAnimation?: string;
  deliveryState?: string;
  ballState?: string;
  ballPosition?: { x: number; y: number; z: number } | string;
  ballTarget?: { x: number; y: number; z: number } | string;
  trajectoryProgress?: number;
  batterAction?: string;
  fieldingAction?: string;
  deliveryResult?: string;
  score?: string;
  scoreUpdated?: boolean;
  deliveryComplete?: boolean;
  // Legacy alias support
  batterName?: string;
  bowlingPlan?: string;
  shot?: string;
  targetZone?: string;
  wicketProbability?: number;
  result?: string;
  actionState?: string;
}

export const DebugDeliveryPanel: React.FC<{ data: DebugDeliveryData }> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  const formatCoord = (coord?: { x: number; y: number; z: number } | string) => {
    if (!coord) return '(0.0, 0.0, 0.0)';
    if (typeof coord === 'string') return coord;
    return `(${coord.x.toFixed(2)}, ${coord.y.toFixed(2)}, ${coord.z.toFixed(2)})`;
  };

  const striker = data.strikerName || data.batterName || 'Unknown';
  const nonStriker = data.nonStrikerName || 'Non-Striker';
  const bowler = data.bowlerName || 'Unknown';
  const bowlerRole = data.bowlerRole || 'BOWLER';
  const bowlerAnim = data.bowlerAnimation || 'RUN_UP';
  const playerAnim = data.currentPlayerAnimation || data.actionState || 'BATTING_READY';
  const deliveryState = data.deliveryState || data.actionState || 'READY';
  const ballState = data.ballState || 'REST';
  const ballPos = formatCoord(data.ballPosition);
  const ballTarget = formatCoord(data.ballTarget || data.targetZone);
  const progress = typeof data.trajectoryProgress === 'number' ? (data.trajectoryProgress * 100).toFixed(1) + '%' : '0.0%';
  const batterAction = data.batterAction || data.shot || 'FORWARD_DEFENCE';
  const fieldingAction = data.fieldingAction || data.targetZone || 'FIELD_READY';
  const result = data.deliveryResult || data.result || 'DOT';
  const score = data.score || '0/0';
  const scoreUpdated = data.scoreUpdated ? 'YES' : 'NO';
  const deliveryComplete = data.deliveryComplete ? 'YES' : 'NO';

  return (
    <div className="fixed bottom-4 right-4 z-50 select-text font-mono text-[10px]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 rounded-t-lg border border-zinc-700/80 backdrop-blur shadow-xl transition-colors ml-auto"
      >
        <Bug className="w-3 h-3 text-amber-400" />
        <span className="font-bold uppercase tracking-wider text-[9px]">DELIVERY DEBUG HUD</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="bg-zinc-950/95 border border-zinc-700/80 rounded-b-lg rounded-tl-lg p-3 shadow-2xl w-88 text-zinc-300 backdrop-blur-md max-h-[85vh] overflow-y-auto space-y-2">
          {/* Match & Game Timing */}
          <div className="grid grid-cols-3 gap-1.5 border-b border-zinc-800 pb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Format</span>
              <span className="font-bold text-amber-400">{data.format || 'TEST'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Day / Sess</span>
              <span className="font-bold text-white">D{data.day || 1} • S{data.session || 1}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Inn / Over</span>
              <span className="font-bold text-cyan-400">Inn {data.innings || 1} • {data.over || 0}.{data.ball || 0}</span>
            </div>
          </div>

          {/* Active Participants */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-zinc-800 pb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Striker</span>
              <span className="font-bold text-emerald-400 truncate block">{striker}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Non-Striker</span>
              <span className="font-bold text-emerald-300/70 truncate block">{nonStriker}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowler</span>
              <span className="font-bold text-cyan-400 truncate block">{bowler}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowler Role</span>
              <span className="font-bold text-purple-400">{bowlerRole}</span>
            </div>
          </div>

          {/* Animations & State */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-zinc-800 pb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowler Animation</span>
              <span className="font-bold text-amber-300 truncate block">{bowlerAnim}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Player Animation</span>
              <span className="font-bold text-indigo-300 truncate block">{playerAnim}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Delivery State</span>
              <span className="font-bold text-sky-400">{deliveryState}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Ball State</span>
              <span className="font-bold text-teal-300">{ballState}</span>
            </div>
          </div>

          {/* Ball Coordinates & Trajectory */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-zinc-800 pb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Ball Position</span>
              <span className="font-mono text-zinc-300 text-[9px] block truncate">{ballPos}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Ball Target</span>
              <span className="font-mono text-zinc-300 text-[9px] block truncate">{ballTarget}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Trajectory Prog</span>
              <span className="font-bold text-lime-400">{progress}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Batter Action</span>
              <span className="font-bold text-yellow-300 truncate block">{batterAction}</span>
            </div>
          </div>

          {/* Actions & Result */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-zinc-800 pb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Fielding Action</span>
              <span className="font-bold text-orange-300 truncate block">{fieldingAction}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Delivery Result</span>
              <span className="font-bold text-rose-400">{result}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Score</span>
              <span className="font-bold text-white">{score}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Score Updated</span>
              <span className={scoreUpdated === 'YES' ? 'font-bold text-emerald-400' : 'font-bold text-zinc-500'}>
                {scoreUpdated}
              </span>
            </div>
          </div>

          {/* Completion Status */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-zinc-500 text-[8px] uppercase font-bold">Delivery Complete</span>
            <span className={deliveryComplete === 'YES' ? 'px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold' : 'px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold'}>
              {deliveryComplete}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
