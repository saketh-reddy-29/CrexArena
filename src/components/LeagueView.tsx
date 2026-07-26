import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore, GameState } from '../stores/useGameStore';
import { Trophy, TrendingUp, Users, Target, ArrowLeft, Home, Calendar, LayoutGrid, BarChart3, ChevronRight, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';

import HomeTab from './league/HomeTab';
import TeamsTab from './league/TeamsTab';
import ScheduleTab from './league/ScheduleTab';
import LeaderboardTab from './league/LeaderboardTab';
import StatsTab from './league/StatsTab';

export default function LeagueView() {
  const { franchises, setGameState, fixtures, generateSeasonFixtures, resetGame } = useGameStore();
  const [activeTab, setActiveTab ] = React.useState<'home' | 'teams' | 'schedule' | 'leaderboard' | 'stats'>('home');

  React.useEffect(() => {
    if (fixtures.length === 0) {
        generateSeasonFixtures();
    }
  }, [fixtures.length, generateSeasonFixtures]);

  const tabs = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'teams', label: 'Teams', icon: LayoutGrid },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'leaderboard', label: 'Table', icon: Trophy },
    { id: 'stats', label: 'Stats', icon: BarChart3 },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col font-sans relative overflow-hidden">
      {/* Ambient effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-15%] right-[-10%] w-[40%] h-[40%] rounded-full bg-zinc-500/[.03] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[35%] h-[35%] rounded-full bg-zinc-500/[.02] blur-[80px]" />
      </div>
      {/* Header */}
      <header className="sticky top-0 z-[100] bg-zinc-950/80 backdrop-blur-xl border-b border-white/[.06]">
        <div className="px-4 py-3 flex items-center gap-3 sm:px-6">
            <button 
                onClick={() => {
                  if (window.confirm("Are you sure you want to quit this career? All progress will be lost.")) {
                    resetGame();
                  }
                }}
                className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors shrink-0"
                title="Quit Career"
            >
                <LogOut className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Season 2024</div>
                <h1 className="text-lg font-bold tracking-tight truncate">Premier League</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-semibold text-zinc-300">Live</span>
            </div>
        </div>

        {/* Tab bar */}
        <nav className="flex items-center gap-0 overflow-x-auto scrollbar-hide border-t border-white/[.04]">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                        "flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-all whitespace-nowrap border-b-2 shrink-0",
                        activeTab === tab.id 
                        ? "text-zinc-100 border-white bg-white/5" 
                        : "text-white/35 border-transparent hover:text-white/60"
                    )}
                >
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                </button>
            ))}
        </nav>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 scrollbar-hide">
        <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                >
                    {activeTab === 'home' && <HomeTab franchises={franchises} />}
                    {activeTab === 'teams' && <TeamsTab franchises={franchises} />}
                    {activeTab === 'schedule' && <ScheduleTab franchises={franchises} />}
                    {activeTab === 'leaderboard' && <LeaderboardTab franchises={franchises} />}
                    {activeTab === 'stats' && <StatsTab />}
                </motion.div>
            </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
