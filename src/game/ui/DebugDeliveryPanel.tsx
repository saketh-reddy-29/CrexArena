import React, { useState } from 'react';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';

export interface DebugDeliveryData {
  format?: string;
  innings?: number;
  over?: number;
  ball?: number;
  batterName?: string;
  bowlerName?: string;
  bowlerRole?: string;
  bowlingPlan?: string;
  shot?: string;
  targetZone?: string;
  wicketProbability?: number;
  finalRoll?: number;
  result?: string;
  ballState?: string;
  actionState?: string;
  score?: string;
  nextState?: string;
}

export const DebugDeliveryPanel: React.FC<{ data: DebugDeliveryData }> = ({ data }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 select-text font-mono text-[10px]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 rounded-t-lg border border-zinc-700/80 backdrop-blur shadow-xl transition-colors ml-auto"
      >
        <Bug className="w-3 h-3 text-amber-400" />
        <span className="font-bold uppercase tracking-wider text-[9px]">ENGINE DEBUG</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </button>

      {isOpen && (
        <div className="bg-zinc-950/95 border border-zinc-700/80 rounded-b-lg rounded-tl-lg p-3 shadow-2xl w-80 text-zinc-300 backdrop-blur-md max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-b border-zinc-800 pb-2 mb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Format</span>
              <span className="font-bold text-amber-400">{data.format || 'T20'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Innings / Over</span>
              <span className="font-bold text-white">Inn {data.innings || 1} • {data.over || 0}.{data.ball || 0}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Batter</span>
              <span className="font-bold text-emerald-400 truncate block">{data.batterName || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowler</span>
              <span className="font-bold text-cyan-400 truncate block">{data.bowlerName || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowler Role</span>
              <span className="font-bold text-purple-400">{data.bowlerRole || 'BOWLER'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Bowling Plan</span>
              <span className="font-bold text-blue-300 truncate block">{data.bowlingPlan || 'GOOD_LENGTH'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 border-b border-zinc-800 pb-2 mb-2">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Shot Played</span>
              <span className="font-bold text-white truncate block">{data.shot || 'FORWARD_DEFENCE'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Target Zone</span>
              <span className="font-bold text-teal-300 truncate block">{data.targetZone || 'COVER'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Wicket Prob</span>
              <span className="font-bold text-rose-400">
                {typeof data.wicketProbability === 'number' ? (data.wicketProbability * 100).toFixed(2) + '%' : '2.40%'}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Roll / Result</span>
              <span className="font-bold text-yellow-400">{data.result || 'DOT'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Ball State</span>
              <span className="font-bold text-cyan-300">{data.ballState || 'REST'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Action State</span>
              <span className="font-bold text-indigo-300">{data.actionState || 'READY'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Current Score</span>
              <span className="font-bold text-white">{data.score || '0/0'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[8px] uppercase">Next State</span>
              <span className="font-bold text-zinc-400">{data.nextState || 'NEXT_DELIVERY'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
