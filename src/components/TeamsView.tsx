import React from 'react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { ArrowLeft, Users } from 'lucide-react';

export default function TeamsView() {
  const { franchises, setGameState } = useGameStore();

  return (
    <div className="min-h-screen bg-[#080c15] text-white font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#080c15]/90 backdrop-blur-md border-b border-white/[.06] px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <button 
            onClick={() => setGameState(GameState.LANDING)}
            className="w-9 h-9 rounded-lg bg-white/5 border border-white/[.06] flex items-center justify-center hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold flex-1">Franchises</h1>
          <div className="text-[10px] text-white/30 font-bold">{franchises.length} Teams</div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 sm:px-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {franchises.map((team) => (
            <div 
              key={team.id}
              className="premium-card p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border border-white/[.06]" style={{ backgroundColor: team.color }}>
                {team.shortName}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold truncate">{team.name}</h2>
                <div className="flex items-center gap-3 text-[10px] text-white/30 font-medium mt-0.5">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {team.squad.length}/25</span>
                  <span>Overseas {team.overseasCount}/8</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-cyan-300">₹{(team.purse / 10000000).toFixed(0)}Cr</div>
                <div className="text-[9px] text-white/25">Purse</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
