import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ArenaProfile, ArenaFormat } from '../engine/models/ArenaState';
import { FormatType } from '../engine/rules/RulesEngine';
import { useGameStore } from './useGameStore';

interface ArenaStore {
  arenas: ArenaProfile[];
  activeArenaId: string | null;
  
  createArena: (name: string, format: FormatType, userTeamId: string) => ArenaProfile;
  loadArena: (id: string) => void;
  deleteArena: (id: string) => void;
  getActiveArena: () => ArenaProfile | undefined;
}

export const useArenaStore = create<ArenaStore>()(
  persist(
    (set, get) => ({
      arenas: [],
      activeArenaId: null,

      createArena: (name, format, userTeamId) => {
        const newArena: ArenaProfile = {
          id: `arena_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          userId: 'local_user',
          name,
          format,
          seasonId: `season_${new Date().getFullYear()}`,
          userTeamId,
          status: format === 'IPL' ? 'AUCTION' : 'DRAFT',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          arenas: [...state.arenas, newArena],
          activeArenaId: newArena.id,
        }));

        // Initialize fresh isolated player states in gameStore
        const gameStore = useGameStore.getState();
        gameStore.setArenaId(newArena.id);
        gameStore.setFormat(format as ArenaFormat);
        gameStore.initializeArenaPlayerStates(newArena.id, format as ArenaFormat);

        return newArena;
      },

      loadArena: (id) => {
        const arena = get().arenas.find(a => a.id === id);
        if (arena) {
          set({ activeArenaId: id });
          const gameStore = useGameStore.getState();
          gameStore.setArenaId(arena.id);
          gameStore.setFormat(arena.format as ArenaFormat);
        }
      },

      deleteArena: (id) => {
        set((state) => ({
          arenas: state.arenas.filter((a) => a.id !== id),
          activeArenaId: state.activeArenaId === id ? null : state.activeArenaId,
        }));
      },

      getActiveArena: () => {
        const { arenas, activeArenaId } = get();
        return arenas.find((a) => a.id === activeArenaId);
      },
    }),
    {
      name: 'crex-arena-saves',
    }
  )
);
