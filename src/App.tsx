/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import LandingPage from './components/LandingPage';

import AuctionRoom from './components/AuctionRoom';
import LiveMatchCenter from './components/LiveMatchCenter';
import LeagueView from './components/LeagueView';
import SquadPlanner from './components/SquadPlanner';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import PreMatch from './components/PreMatch';
import QuickMatchSetup from './components/QuickMatchSetup';
import TeamSelection from './components/TeamSelection';
import BoardSelection from './components/BoardSelection';
import ArenaDashboard from './components/ArenaDashboard';
import PlayingXIBuilder from './components/PlayingXIBuilder';
import { useGameStore, GameState } from './stores/useGameStore';

export default function App() {
  const gameState = useGameStore((state) => state.gameState);

  return (
    <main className="min-h-screen bg-zinc-950">
      {gameState === GameState.LANDING && <LandingPage />}
      {gameState === GameState.TEAM_SELECTION && <TeamSelection />}
      {gameState === GameState.BOARD_SELECTION && <BoardSelection />}
      {gameState === GameState.ARENA_DASHBOARD && <ArenaDashboard />}
      {gameState === GameState.PLAYING_XI_BUILDER && <PlayingXIBuilder />}

      {(gameState === GameState.AUCTION || false) && (
        <div className={gameState !== GameState.AUCTION ? 'hidden' : ''}>
          <AuctionRoom />
        </div>
      )}
      {gameState === GameState.LEAGUE && <LeagueView />}
      {false && <SquadPlanner />}
      
      
      
      {gameState === GameState.PRE_MATCH && <PreMatch />}
      {gameState === GameState.MATCH_SIMULATION && <LiveMatchCenter />}

      {![
        GameState.LANDING,
        GameState.TEAM_SELECTION,
        GameState.BOARD_SELECTION,
        GameState.ARENA_DASHBOARD,
        GameState.PLAYING_XI_BUILDER,
        GameState.AUCTION,
        GameState.LEAGUE,
        
        
        
        
        GameState.PRE_MATCH,
        GameState.MATCH_SIMULATION,
      ].includes(gameState) && (
        <div className="flex min-h-screen items-center justify-center text-white">
          <div className="text-center">
            <h1 className="mb-4 font-serif text-4xl italic text-zinc-200">Work in Progress</h1>
            <p className="mb-8 text-zinc-500">This section of the simulator is being rendered.</p>
            <button
              onClick={() => useGameStore.getState().setGameState(GameState.LANDING)}
              className="rounded-full bg-white px-8 py-3 font-bold text-zinc-950"
            >
              Back to Pavilion
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
