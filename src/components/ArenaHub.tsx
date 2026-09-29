import React from 'react';
import { useGameStore, GameState, ArenaTab } from '../stores/useGameStore';
import { ArrowLeft } from 'lucide-react';
import ArenaDashboard from './ArenaDashboard';
import ScheduleTab from './league/ScheduleTab';
import LeaderboardTab from './league/LeaderboardTab';
import SquadPlanner from './SquadPlanner';
import AuctionRoom from './AuctionRoom';
import PlayerStatsView from './stats/PlayerStatsView';
import TeamStatsView from './stats/TeamStatsView';
import { cn } from '../lib/utils';

export default function ArenaHub() {
  const { 
    selectedFormat, 
    activeTab, 
    setActiveTab, 
    setGameState,
    franchises,
    selectedFranchiseId,
    viewedPlayerId,
    setViewedPlayer,
    players
  } = useGameStore();

  const team = franchises.find(f => f.id === selectedFranchiseId);
  const isIPL = selectedFormat === 'IPL';
  const isTest = selectedFormat === 'TEST';

  // Determine available tabs based on format
  const getTabs = (): { id: ArenaTab; label: string }[] => {
    const tabs: { id: ArenaTab; label: string }[] = [
      { id: 'OVERVIEW', label: 'OVERVIEW' }
    ];

    if (isIPL) {
      tabs.push({ id: 'AUCTION', label: 'AUCTION' });
      tabs.push({ id: 'SQUAD', label: 'SQUAD' });
      tabs.push({ id: 'MATCHES', label: 'MATCHES' });
      tabs.push({ id: 'TABLE', label: 'TABLE' });
      tabs.push({ id: 'PLAYOFFS', label: 'PLAYOFFS' });
    } else if (isTest) {
      tabs.push({ id: 'SERIES', label: 'SERIES' });
      tabs.push({ id: 'SQUAD', label: 'SQUAD' });
      tabs.push({ id: 'MATCHES', label: 'MATCHES' });
    } else {
      tabs.push({ id: 'SQUAD', label: 'SQUAD' });
      tabs.push({ id: 'MATCHES', label: 'MATCHES' });
      tabs.push({ id: 'TABLE', label: 'TABLE' });
    }

    tabs.push({ id: 'PLAYER_STATS', label: 'PLAYER STATS' });
    tabs.push({ id: 'TEAM_STATS', label: 'TEAM STATS' });

    return tabs;
  };

  const tabs = getTabs();

  // If the current tab isn't valid for the format, fallback to OVERVIEW
  React.useEffect(() => {
    if (!tabs.find(t => t.id === activeTab)) {
      setActiveTab('OVERVIEW');
    }
  }, [activeTab, tabs, setActiveTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'OVERVIEW':
        return <ArenaDashboard />;
      case 'SQUAD':
        return <SquadPlanner />;
      case 'AUCTION':
        return <AuctionRoom />;
      case 'MATCHES':
      case 'SERIES':
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ScheduleTab franchises={franchises} />
          </div>
        );
      case 'TABLE':
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <LeaderboardTab franchises={franchises} />
          </div>
        );
      case 'PLAYOFFS':
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ScheduleTab franchises={franchises} />
          </div>
        );
      case 'PLAYER_STATS':
        return <PlayerStatsView />;
      case 'TEAM_STATS':
        return <TeamStatsView />;
      default:
        return <ArenaDashboard />;
    }
  };

  if (!team) return null;

  const viewedPlayer = players.find(p => p.id === viewedPlayerId) || null;
  const viewedPlayerFranchise = viewedPlayer ? franchises.find(f => f.squad.includes(viewedPlayer.id))?.id : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      
      {/* Top Header */}
      <header className="bg-zinc-950 border-b border-zinc-800 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Context & Back */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setGameState(GameState.LANDING)}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 transition-colors shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-zinc-400" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {selectedFormat} 2026
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">LIVE</span>
                </div>
                <h1 className="text-lg font-black tracking-tight">{team.name}</h1>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-2 sm:pb-0 hide-scrollbar-sm">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full whitespace-nowrap transition-all duration-200 shrink-0",
                      isActive 
                        ? "bg-white text-zinc-950" 
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {renderContent()}
      </div>

    </div>
  );
}
