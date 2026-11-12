import React from 'react';
import { useGameStore, GameState, ArenaTab } from '../stores/useGameStore';
import { ArrowLeft } from 'lucide-react';
import ArenaDashboard from './ArenaDashboard';
import ScheduleTab from './league/ScheduleTab';
import SeriesTab from './league/SeriesTab';
import LeaderboardTab from './league/LeaderboardTab';
import QualificationTab from './league/QualificationTab';
import SquadPlanner from './SquadPlanner';
import AuctionRoom from './AuctionRoom';
import PlayerStatsView from './stats/PlayerStatsView';
import TeamStatsView from './stats/TeamStatsView';
import TopMatchesCarousel from './TopMatchesCarousel';
import GlobalNavBar from './common/GlobalNavBar';
import FieldSetupDashboard from './FieldSetupDashboard';
import MatchRecoveryBanner from './common/MatchRecoveryBanner';
import { cn } from '../lib/utils';

export default function ArenaHub() {
  const { 
    selectedFormat, 
    activeTab, 
    setActiveTab, 
    setGameState,
    franchises,
    selectedFranchiseId,
    liveMatchState,
  } = useGameStore();

  const team = franchises.find(f => f.id === selectedFranchiseId);

  // Derive live context from persisted match state for FieldSetupDashboard
  const liveCtx = React.useMemo(() => {
    const ls = liveMatchState ?? {};
    return {
      isSpinner:        ls.currentBowlerIsSpin    ?? false,
      isLeftHander:     ls.strikerIsLeftHand       ?? false,
      wickets:          ls.wickets                  ?? 0,
      partnershipRuns:  ls.partnershipRuns          ?? 0,
      batterId:         ls.strikerId                ?? undefined,
      batterStyle:      ls.strikerStyle              ?? undefined,
      highRequiredRate: ls.requiredRate && ls.currentRunRate
                          ? ls.requiredRate > ls.currentRunRate + 2
                          : false,
      bowlerName:       ls.currentBowlerName        ?? undefined,
      batterName:       ls.strikerName              ?? undefined,
    };
  }, [liveMatchState]);
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
      tabs.push({ id: 'TABLE', label: 'WTC TABLE' });
    } else {
      tabs.push({ id: 'SERIES', label: 'SERIES' });
      tabs.push({ id: 'SQUAD', label: 'SQUAD' });
      tabs.push({ id: 'MATCHES', label: 'MATCHES' });
      tabs.push({ id: 'TABLE', label: 'TABLE' });
      tabs.push({ id: 'PLAYOFFS', label: 'PLAYOFFS' });
    }

    tabs.push({ id: 'PLAYER_STATS', label: 'PLAYER STATS' });
    tabs.push({ id: 'TEAM_STATS', label: 'TEAM STATS' });
    tabs.push({ id: 'FIELD_SETUP', label: '🏏 FIELD SETUP' });

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
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <ScheduleTab franchises={franchises} />
          </div>
        );
      case 'SERIES':
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <SeriesTab franchises={franchises} />
          </div>
        );
      case 'PLAYOFFS':
        return <QualificationTab />;
      case 'TABLE':
        return (
          <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            <LeaderboardTab franchises={franchises} />
          </div>
        );
      case 'PLAYER_STATS':
        return <PlayerStatsView />;
      case 'TEAM_STATS':
        return <TeamStatsView />;
      case 'FIELD_SETUP':
        return (
          <FieldSetupDashboard
            currentFormat={selectedFormat as 'T20' | 'ODI' | 'TEST' | 'IPL'}
            teamA={team?.shortName ?? team?.name ?? 'Team A'}
            teamB={String((liveMatchState as any)?.opposingTeamName ?? 'Opponent')}
            currentOver={Number((liveMatchState as any)?.overs ?? 0)}
            currentBall={Number((liveMatchState as any)?.balls ?? 0)}
            fieldSettled={Boolean((liveMatchState as any)?.fieldSettled)}
            liveContext={liveCtx}
          />
        );
      default:
        return <ArenaDashboard />;
    }
  };

  if (!team) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#071426] text-[#F6F8FC] font-sans overflow-hidden">
      
      {/* Global Navigation Bar */}
      <GlobalNavBar />

      {/* Top Header */}
      <header className="bg-[#0D1C32] border-b border-white/10 shrink-0 shadow-lg z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            
            {/* Context & Back */}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setGameState(GameState.LANDING)}
                className="w-8 h-8 rounded-full bg-[#10233D] border border-white/10 flex items-center justify-center hover:bg-[#152C4D] transition-colors shrink-0 text-[#9DAEC4] hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#258BFF] bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                    {selectedFormat} 2026
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">LIVE ARENA</span>
                </div>
                <h1 className="text-base font-black tracking-tight text-[#F6F8FC]">{team.name}</h1>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0 hide-scrollbar-sm">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide rounded-full whitespace-nowrap transition-all duration-200 shrink-0",
                      isActive 
                        ? "bg-[#258BFF] text-white shadow-md shadow-blue-500/20" 
                        : "text-[#9DAEC4] hover:text-white bg-[#10233D] hover:bg-[#152C4D] border border-white/5"
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

      {/* Top Matches Carousel */}
      <TopMatchesCarousel />

      {/* Match Recovery Banner for in-progress games */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 w-full">
        <MatchRecoveryBanner />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {renderContent()}
      </div>

    </div>
  );
}

