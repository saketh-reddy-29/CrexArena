import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ArenaProfile } from '../engine/models/ArenaState';
import { FormatType } from '../engine/rules/RulesEngine';

interface ArenaStore {
  arenas: ArenaProfile[];
  activeArenaId: string | null;
  
  createArena: (name: string, format: FormatType, userTeamId: string) => void;
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
          userId: 'local_user', // Since there is no auth yet
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
      },

      loadArena: (id) => {
        set({ activeArenaId: id });
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
