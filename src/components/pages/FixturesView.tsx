import React, { useState } from 'react';
import { 
  Calendar, Trophy, Play, CheckCircle2, FastForward, Lock, 
  Eye, Radio, AlertCircle, Filter, ChevronRight 
} from 'lucide-react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import ScheduleTab from '../league/ScheduleTab';
import { cn } from '../../lib/utils';

export default function FixturesView() {
  const { 
    franchises, 
    selectedFranchiseId, 
    selectedFormat, 
    fixtures,
    setGameState 
  } = useGameStore();

  const userTeam = franchises.find(f => f.id === selectedFranchiseId);

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-widest text-[#F5B82E] uppercase">
              Official Tournament Fixture Calendar
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-7 h-7 text-[#258BFF]" />
            Fixtures & Match Schedules
          </h1>
        </div>

        {userTeam && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#10233D] border border-white/10 text-xs">
            <img 
              src={resolveTeamLogoUrl(userTeam.shortName, userTeam.logo)} 
              alt={userTeam.name}
              className="w-5 h-5 object-contain"
            />
            <span className="text-[#9DAEC4]">Your Campaign:</span>
            <span className="font-black text-white">{userTeam.name}</span>
          </div>
        )}
      </div>

      {/* Embedded Schedule Tab with Full Gated Validation */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <ScheduleTab franchises={franchises} />
      </div>
    </div>
  );
}
