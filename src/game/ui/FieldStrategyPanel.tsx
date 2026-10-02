import React from 'react';

export interface FieldStrategyPanelProps {
  bowlerName: string;
  bowlingPlan: string;
  fieldStrategy: string;
  deepFieldersCount: number;
  maxDeepAllowed: number;
  onClose?: () => void;
}

export const FieldStrategyPanel: React.FC<FieldStrategyPanelProps> = ({
  bowlerName,
  bowlingPlan,
  fieldStrategy,
  deepFieldersCount,
  maxDeepAllowed,
  onClose,
}) => {
  return (
    <div className="absolute top-12 right-3 z-30 w-56 bg-zinc-950/85 backdrop-blur-md border border-white/10 rounded-xl p-2.5 shadow-2xl text-zinc-100 text-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
        <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">
          Bowler Strategy
        </span>
        {onClose && (
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xs">
            ✕
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-[9px] text-zinc-400 uppercase">Bowler</span>
          <div className="font-bold text-white truncate text-[11px]">{bowlerName}</div>
        </div>

        <div className="flex items-center justify-between bg-white/5 p-1.5 rounded-lg">
          <div>
            <span className="text-[9px] text-zinc-400 uppercase">Plan</span>
            <div className="font-bold text-amber-300 text-[10px]">{bowlingPlan}</div>
          </div>
          <div className="text-right">
            <span className="text-[9px] text-zinc-400 uppercase">Field</span>
            <div className="font-bold text-emerald-400 text-[10px]">{fieldStrategy}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[10px] text-zinc-300 pt-1 border-t border-white/5">
          <span>Boundary Riders:</span>
          <span className="font-bold text-white tabular-nums">
            {deepFieldersCount} / {maxDeepAllowed} Deep
          </span>
        </div>
      </div>
    </div>
  );
};
