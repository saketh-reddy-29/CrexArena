import React, { useState } from 'react';
import { useGameStore, GameState } from '../../stores/useGameStore';
import { cn } from '../../lib/utils';
import { 
  Trophy, 
  Calendar, 
  Users, 
  BarChart3, 
  Target, 
  Settings, 
  Home, 
  Radio, 
  ChevronRight 
} from 'lucide-react';
import { resolveTeamLogoUrl } from '../../lib/teamLogos';
import SettingsModal from './SettingsModal';
import GoogleLoginButton from '../auth/GoogleLoginButton';
import GoogleAccountModal from '../auth/GoogleAccountModal';

interface GlobalNavBarProps {
  currentView?: string;
}

export default function GlobalNavBar({ currentView }: GlobalNavBarProps) {
  const { 
    gameState, 
    setGameState, 
    activeTab, 
    setActiveTab, 
    selectedFormat, 
    selectedFranchiseId, 
    franchises,
    authUser,
  } = useGameStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  const team = franchises.find(f => f.id === selectedFranchiseId);

  const navItems = [
    {
      id: 'HOME',
      label: 'Pavilion',
      icon: Home,
      action: () => setGameState(GameState.LANDING),
      isActive: gameState === GameState.LANDING,
    },
    {
      id: 'CAREER',
      label: 'Hub',
      icon: Radio,
      action: () => {
        setGameState(GameState.ARENA_HUB);
        setActiveTab('OVERVIEW');
      },
      isActive: gameState === GameState.ARENA_HUB && activeTab === 'OVERVIEW',
    },
    {
      id: 'SQUAD',
      label: 'Playing XI',
      icon: Users,
      action: () => {
        setGameState(GameState.PLAYING_XI_BUILDER);
      },
      isActive: gameState === GameState.PLAYING_XI_BUILDER,
    },
    {
      id: 'FIXTURES',
      label: 'Fixtures',
      icon: Calendar,
      action: () => {
        setGameState(GameState.ARENA_HUB);
        setActiveTab('MATCHES');
      },
      isActive: gameState === GameState.ARENA_HUB && activeTab === 'MATCHES',
    },
    {
      id: 'TABLE',
      label: 'Standings',
      icon: BarChart3,
      action: () => {
        setGameState(GameState.ARENA_HUB);
        setActiveTab('TABLE');
      },
      isActive: gameState === GameState.ARENA_HUB && activeTab === 'TABLE',
    },
    {
      id: 'PLAYOFFS',
      label: 'Playoff Odds',
      icon: Target,
      action: () => {
        setGameState(GameState.ARENA_HUB);
        setActiveTab('PLAYOFFS');
      },
      isActive: gameState === GameState.ARENA_HUB && activeTab === 'PLAYOFFS',
    },
    {
      id: 'RECORDS',
      label: 'Player Caps',
      icon: Trophy,
      action: () => {
        setGameState(GameState.ARENA_HUB);
        setActiveTab('PLAYER_STATS');
      },
      isActive: gameState === GameState.ARENA_HUB && activeTab === 'PLAYER_STATS',
    },
  ];

  return (
    <>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showGoogleModal && <GoogleAccountModal onClose={() => setShowGoogleModal(false)} />}

      <nav className="bg-white border-b border-slate-200/90 shadow-2xs sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center justify-between gap-3">
            
            {/* Left: Brand & Format */}
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={() => setGameState(GameState.LANDING)}
                className="flex items-center gap-2 group text-left"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xs group-hover:scale-105 transition-transform">
                  CA
                </div>
                <div>
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-xs font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
                      CRICKET ARENA
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                    {selectedFormat || 'IPL'} 2026
                  </span>
                </div>
              </button>
            </div>

            {/* Middle: Navigation Links */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
              {navItems.map(item => {
                const Icon = item.icon;
                const active = item.isActive;

                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap",
                      active
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right: Team Emblem, Google Profile & Settings */}
            <div className="flex items-center gap-2 shrink-0">
              {team && (
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                  <img 
                    src={resolveTeamLogoUrl(team.shortName)} 
                    alt={team.shortName} 
                    className="w-5 h-5 object-contain" 
                  />
                  <span className="text-xs font-bold text-slate-800">{team.shortName}</span>
                </div>
              )}

              {/* Google Profile or Sign In to Save Pill */}
              {authUser ? (
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(true)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold transition-all shadow-2xs group cursor-pointer"
                  title={`Google Account: ${authUser.email} (Cloud Sync Active)`}
                >
                  <div className="relative">
                    {authUser.picture ? (
                      <img 
                        src={authUser.picture} 
                        alt={authUser.name} 
                        className="w-6 h-6 rounded-full object-cover border border-emerald-400" 
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center border border-emerald-400">
                        {authUser.name[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                  </div>
                  <span className="max-w-[85px] truncate text-slate-800 font-bold hidden md:inline">{authUser.name}</span>
                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200 hidden sm:inline">Saved</span>
                </button>
              ) : (
                <GoogleLoginButton
                  onClick={() => setShowGoogleModal(true)}
                  size="sm"
                  variant="pill"
                  text="Save with Google"
                  className="hidden sm:inline-flex"
                />
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Settings & Persistence"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      </nav>
    </>
  );
}
