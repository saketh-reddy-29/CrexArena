import React from 'react';
import LandingPage from './components/LandingPage';
import AuctionRoom from './components/AuctionRoom';
import LiveMatchCenter from './components/LiveMatchCenter';
import LeagueView from './components/LeagueView';
import SquadPlanner from './components/SquadPlanner';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import PreMatch from './components/PreMatch';
import MatchResultView from './components/MatchResultView';
import QuickMatchSetup from './components/QuickMatchSetup';
import TeamSelection from './components/TeamSelection';
import BoardSelection from './components/BoardSelection';
import ArenaHub from './components/ArenaHub';
import PlayingXIBuilder from './components/PlayingXIBuilder';
import PlayerProfileModal from './components/PlayerProfileModal';
import GlobalAppHeader from './components/common/GlobalAppHeader';
import StatisticsView from './components/pages/StatisticsView';
import RecordsView from './components/pages/RecordsView';
import AchievementsView from './components/pages/AchievementsView';
import FixturesView from './components/pages/FixturesView';
import { useGameStore, GameState } from './stores/useGameStore';

export default function App() {
  const { gameState, viewedPlayerId, setViewedPlayer, players, franchises } = useGameStore();
  
  const viewedPlayer = viewedPlayerId ? players.find(p => p.id === viewedPlayerId) : null;
  const viewedPlayerFranchise = viewedPlayer ? franchises.find(f => f.squad.includes(viewedPlayer.id))?.id : undefined;

  // Decide whether the global app header should be shown (always except full-screen live match)
  const isFullScreenMatch = gameState === GameState.MATCH_SIMULATION;

  return (
    <div className="min-h-screen bg-[#071426] text-[#F6F8FC] font-sans bg-stadium-pattern flex flex-col selection:bg-[#258BFF] selection:text-white">
      {/* Global Player Profile Modal */}
      {viewedPlayer && (
        <PlayerProfileModal 
          player={viewedPlayer} 
          franchiseId={viewedPlayerFranchise} 
          onClose={() => setViewedPlayer(null)} 
        />
      )}

      {/* Persistent Global Application Header */}
      {!isFullScreenMatch && <GlobalAppHeader />}

      {/* Main Responsive Application Shell */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-4 sm:px-6 py-6">
        {gameState === GameState.LANDING && <LandingPage />}
        {gameState === GameState.TEAM_SELECTION && <TeamSelection />}
        {gameState === GameState.BOARD_SELECTION && <BoardSelection />}
        {gameState === GameState.ARENA_HUB && <ArenaHub />}
        {gameState === GameState.PLAYING_XI_BUILDER && <PlayingXIBuilder />}
        {gameState === GameState.PRE_MATCH && <PreMatch />}
        {gameState === GameState.MATCH_SIMULATION && <LiveMatchCenter />}
        {gameState === GameState.MATCH_RESULT && <MatchResultView />}
        {gameState === GameState.AUCTION && <AuctionRoom />}
        {gameState === GameState.PLAYERS && <PlayersView />}
        {gameState === GameState.TEAMS && <TeamsView />}
        {gameState === GameState.STATISTICS && <StatisticsView />}
        {gameState === GameState.RECORDS && <RecordsView />}
        {gameState === GameState.ACHIEVEMENTS && <AchievementsView />}
        {gameState === GameState.FIXTURES && <FixturesView />}

        {/* Fallback View */}
        {![
          GameState.LANDING,
          GameState.TEAM_SELECTION,
          GameState.BOARD_SELECTION,
          GameState.ARENA_HUB,
          GameState.PLAYING_XI_BUILDER,
          GameState.PRE_MATCH,
          GameState.MATCH_SIMULATION,
          GameState.MATCH_RESULT,
          GameState.AUCTION,
          GameState.PLAYERS,
          GameState.TEAMS,
          GameState.STATISTICS,
          GameState.RECORDS,
          GameState.ACHIEVEMENTS,
          GameState.FIXTURES,
        ].includes(gameState) && (
          <div className="flex min-h-[60vh] items-center justify-center text-white">
            <div className="text-center p-8 rounded-3xl bg-[#10233D] border border-white/10 max-w-md">
              <h1 className="mb-2 text-2xl font-black text-white">Cricket Arena Pavilion</h1>
              <p className="mb-6 text-xs text-[#9DAEC4]">Return to the main tournament hub to continue your career.</p>
              <button
                onClick={() => useGameStore.getState().setGameState(GameState.LANDING)}
                className="rounded-xl bg-[#258BFF] px-6 py-2.5 font-bold text-xs uppercase tracking-wider text-white"
              >
                Back to Pavilion
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
