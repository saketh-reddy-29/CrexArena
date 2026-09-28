import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Shield } from 'lucide-react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { INTL_TEAMS_DATA } from '../data/intlPlayers';
import { getIntlTeamLogoUrl } from '../data/crexIntlTeams';
import { MatchFormat } from '../types/match';

export default function QuickMatchSetup() {
  const { setupQuickMatch, setGameState } = useGameStore();
  const [team1Id, setTeam1Id] = useState<string>('IND');
  const [team2Id, setTeam2Id] = useState<string>('AUS');
  const [format, setFormat] = useState<MatchFormat>(MatchFormat.T20);

  const handleStart = () => {
    if (team1Id && team2Id && team1Id !== team2Id) {
      setupQuickMatch(team1Id, team2Id, format);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-['Outfit'] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => setGameState(GameState.LANDING)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        <div className="bg-white rounded-3xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
            <h1 className="text-3xl font-black text-[#1A2938]">International Match</h1>
            <p className="text-zinc-500 mt-2">Setup a custom ODI or T20I match between two nations.</p>
          </div>

          <div className="p-8 space-y-10">
            {/* Format Selection */}
            <div>
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Select Format</h3>
              <div className="flex gap-4">
                <button
                  onClick={() => setFormat(MatchFormat.T20)}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                    format === MatchFormat.T20 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
                  }`}
                >
                  <div className="text-xl font-black mb-1">T20I</div>
                  <div className="text-sm font-medium">20 Overs</div>
                </button>
                <button
                  onClick={() => setFormat(MatchFormat.ODI)}
                  className={`flex-1 p-4 rounded-2xl border-2 transition-all ${
                    format === MatchFormat.ODI 
                      ? 'border-blue-600 bg-blue-50 text-blue-700' 
                      : 'border-zinc-200 hover:border-zinc-300 text-zinc-600'
                  }`}
                >
                  <div className="text-xl font-black mb-1">ODI</div>
                  <div className="text-sm font-medium">50 Overs</div>
                </button>
              </div>
            </div>

            {/* Team Selection */}
            <div className="grid md:grid-cols-2 gap-8 relative">
              {/* VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#1A2938] text-white flex items-center justify-center font-black text-sm shadow-xl z-10 hidden md:flex">
                VS
              </div>

              {/* Team 1 */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Home Team</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {INTL_TEAMS_DATA.map(team => (
                    <button
                      key={team.id}
                      onClick={() => setTeam1Id(team.id)}
                      disabled={team2Id === team.id}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        team1Id === team.id
                          ? 'border-blue-500 bg-blue-50'
                          : team2Id === team.id
                          ? 'border-zinc-100 opacity-50 cursor-not-allowed'
                          : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="w-10 h-10 flex items-center justify-center">
                        <img src={getIntlTeamLogoUrl(team.shortName) || ''} alt={team.name} className="w-8 h-8 object-contain" />
                      </div>
                      <span className="text-[10px] font-bold text-center leading-tight">{team.shortName}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Away Team</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {INTL_TEAMS_DATA.map(team => (
                    <button
                      key={team.id}
                      onClick={() => setTeam2Id(team.id)}
                      disabled={team1Id === team.id}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                        team2Id === team.id
                          ? 'border-red-500 bg-red-50'
                          : team1Id === team.id
                          ? 'border-zinc-100 opacity-50 cursor-not-allowed'
                          : 'border-zinc-200 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="w-10 h-10 flex items-center justify-center">
                        <img src={getIntlTeamLogoUrl(team.shortName) || ''} alt={team.name} className="w-8 h-8 object-contain" />
                      </div>
                      <span className="text-[10px] font-bold text-center leading-tight">{team.shortName}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-100 flex justify-end">
              <button
                onClick={handleStart}
                disabled={!team1Id || !team2Id || team1Id === team2Id}
                className="flex items-center gap-2 px-8 py-4 bg-[#1A2938] hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                <Play className="w-5 h-5 fill-current" />
                Proceed to Toss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
