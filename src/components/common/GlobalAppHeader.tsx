import React, { useState } from 'react';
import { 
  Home, Radio, Play, Trophy, Calendar, Video, Users, User, Gavel, 
  BarChart3, Award, BookmarkCheck, Save, Settings, ChevronRight, Sparkles,
  Shield, Bell, ExternalLink, Zap
} from 'lucide-react';
import { useGameStore, GameState, ArenaTab } from '../../stores/useGameStore';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import { cn } from '../../lib/utils';
import SettingsModal from './SettingsModal';
import GoogleAccountModal from '../auth/GoogleAccountModal';

export type NavItemKey =
  | 'home'
  | 'career'
  | 'play_now'
  | 'tournaments'
  | 'fixtures'
  | 'live_matches'
  | 'teams'
  | 'players'
  | 'auction'
  | 'statistics'
  | 'records'
  | 'achievements'
  | 'save_load'
  | 'settings';

export default function GlobalAppHeader() {
  const { 
    gameState, 
    setGameState, 
    activeTab, 
    setActiveTab,
    selectedFormat, 
    selectedFranchiseId, 
    franchises,
    fixtures,
    currentMatchId,
    liveMatchState,
    authUser,
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const team = franchises.find(f => f.id === selectedFranchiseId);

  // Check if there is an active live match
  const isMatchLive = Boolean(liveMatchState && currentMatchId);

  // Active navigation determination
  const getActiveNavKey = (): NavItemKey => {
    if (gameState === GameState.LANDING) return 'home';
    if (gameState === GameState.PRE_MATCH) return 'play_now';
    if (gameState === GameState.MATCH_SIMULATION) return 'live_matches';
    if (gameState === GameState.AUCTION) return 'auction';
    if (gameState === GameState.PLAYERS) return 'players';
    if (gameState === GameState.TEAMS) return 'teams';
    if (gameState === GameState.STATISTICS) return 'statistics';
    if (gameState === GameState.RECORDS) return 'records';
    if (gameState === GameState.ACHIEVEMENTS) return 'achievements';
    if (gameState === GameState.SETTINGS) return 'settings';
    if (gameState === GameState.FIXTURES) return 'fixtures';

    if (gameState === GameState.ARENA_HUB) {
      if (activeTab === 'AUCTION') return 'auction';
      if (activeTab === 'MATCHES') return 'fixtures';
      if (activeTab === 'PLAYER_STATS' || activeTab === 'TEAM_STATS') return 'statistics';
      return 'career';
    }

    return 'home';
  };

  const activeKey = getActiveNavKey();

  const handleNavClick = (key: NavItemKey) => {
    setMobileMenuOpen(false);

    switch (key) {
      case 'home':
        setGameState(GameState.LANDING);
        break;
      case 'career':
        setGameState(GameState.ARENA_HUB);
        setActiveTab('OVERVIEW');
        break;
      case 'play_now':
        // Find next scheduled user match
        const nextMatch = fixtures.find(
          f => (f.team1Id === selectedFranchiseId || f.team2Id === selectedFranchiseId) &&
               f.status !== 'COMPLETED'
        );
        if (nextMatch) {
          useGameStore.getState().setCurrentMatch(nextMatch.id);
          setGameState(GameState.PRE_MATCH);
        } else {
          setGameState(GameState.ARENA_HUB);
          setActiveTab('MATCHES');
        }
        break;
      case 'tournaments':
        setGameState(GameState.LANDING);
        break;
      case 'fixtures':
        setGameState(GameState.FIXTURES);
        setActiveTab('MATCHES');
        break;
      case 'live_matches':
        if (currentMatchId) {
          setGameState(GameState.MATCH_SIMULATION);
        } else {
          setGameState(GameState.FIXTURES);
          setActiveTab('MATCHES');
        }
        break;
      case 'teams':
        setGameState(GameState.TEAMS);
        break;
      case 'players':
        setGameState(GameState.PLAYERS);
        break;
      case 'auction':
        setGameState(GameState.AUCTION);
        setActiveTab('AUCTION');
        break;
      case 'statistics':
        setGameState(GameState.STATISTICS);
        break;
      case 'records':
        setGameState(GameState.RECORDS);
        break;
      case 'achievements':
        setGameState(GameState.ACHIEVEMENTS);
        break;
      case 'save_load':
        setShowSettings(true);
        break;
      case 'settings':
        setShowSettings(true);
        break;
    }
  };

  const primaryNavItems: { key: NavItemKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'career', label: 'Career', icon: Radio },
    { key: 'play_now', label: 'Play Now', icon: Play },
    { key: 'tournaments', label: 'Tournaments', icon: Trophy },
    { key: 'fixtures', label: 'Fixtures', icon: Calendar },
    { key: 'live_matches', label: 'Live Matches', icon: Video },
    { key: 'teams', label: 'Teams', icon: Shield },
    { key: 'players', label: 'Players', icon: User },
    { key: 'auction', label: 'Auction', icon: Gavel },
    { key: 'statistics', label: 'Stats', icon: BarChart3 },
    { key: 'records', label: 'Records', icon: BookmarkCheck },
    { key: 'achievements', label: 'Trophies', icon: Award },
    { key: 'save_load', label: 'Save & Load', icon: Save },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showGoogleModal && <GoogleAccountModal onClose={() => setShowGoogleModal(false)} />}

      <header className="sticky top-0 z-50 bg-[#071426]/95 backdrop-blur-md border-b border-white/10 shadow-xl">
        {/* Top Brand & Career Bar */}
        <div className="max-w-[1720px] mx-auto px-4 py-2.5 flex items-center justify-between border-b border-white/5">
          {/* Logo & App Title */}
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#258BFF] via-[#13A875] to-[#F5B82E] p-0.5 shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#071426] rounded-[10px] flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#F5B82E]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
                  CRICKET ARENA
                </span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-[#258BFF] text-[10px] font-black border border-blue-500/30">
                  PRO
                </span>
              </div>
              <div className="text-[10px] text-[#9DAEC4] font-medium tracking-wide">
                AAA Sports Simulation & Management
              </div>
            </div>
          </div>

          {/* Current Active Career Status Badge */}
          <div className="hidden md:flex items-center gap-3">
            {team ? (
              <div 
                onClick={() => handleNavClick('career')}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#10233D] border border-white/10 cursor-pointer hover:border-blue-500/50 transition-all shadow-sm"
              >
                <img 
                  src={resolveTeamLogoUrl(team.shortName, team.logo)} 
                  alt={team.name}
                  className="w-5 h-5 object-contain"
                />
                <div className="text-left">
                  <div className="text-[10px] text-[#9DAEC4] uppercase font-bold leading-none">
                    {selectedFormat || 'IPL 2026'} Career
                  </div>
                  <div className="text-xs font-black text-white leading-tight">
                    {team.name}
                  </div>
                </div>
                <div className="ml-2 pl-2 border-l border-white/10 text-right">
                  <div className="text-[9px] text-[#9DAEC4] leading-none">Purse</div>
                  <div className="text-xs font-black text-[#F5B82E]">
                    ₹{(team.purse / 10000000).toFixed(1)}Cr
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-[#9DAEC4] font-medium">
                No Career Selected
              </div>
            )}

            {isMatchLive && (
              <button
                onClick={() => handleNavClick('live_matches')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-black uppercase tracking-wider animate-pulse hover:bg-red-500/30 transition-all"
              >
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span>MATCH IN PROGRESS</span>
              </button>
            )}
          </div>

          {/* User Profile & Global Controls */}
          <div className="flex items-center gap-2.5">
            {authUser ? (
              <button
                onClick={() => setShowGoogleModal(true)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs text-white transition-all"
              >
                <img
                  src={authUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${authUser.name}`}
                  alt={authUser.name}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="font-bold hidden sm:inline max-w-[100px] truncate">{authUser.name}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowGoogleModal(true)}
                className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#9DAEC4] font-bold transition-all"
              >
                Sign In
              </button>
            )}

            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#9DAEC4] hover:text-white transition-all"
              title="Settings & Cloud Save"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 14 Primary Navigation Items Carousel / Bar */}
        <nav className="max-w-[1720px] mx-auto px-2 sm:px-4 overflow-x-auto scrollbar-hide py-1.5">
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-max">
            {primaryNavItems.map(item => {
              const Icon = item.icon;
              const isActive = activeKey === item.key;

              return (
                <button
                  key={item.key}
                  onClick={() => handleNavClick(item.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black tracking-wide uppercase transition-all shrink-0",
                    isActive
                      ? "bg-gradient-to-r from-[#258BFF] to-[#13A875] text-white shadow-md shadow-blue-500/20"
                      : "text-[#9DAEC4] hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", isActive ? "text-white" : "text-[#9DAEC4]")} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </header>
    </>
  );
}
