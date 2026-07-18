import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toggleFavoriteAPI, submitRating } from '@/lib/api';

interface UserStore {
  favorites: number[];
  ratings: Record<number, number>;
  theme: 'dark' | 'light';
  isLoggedIn: boolean;
  pendingMigration: boolean;

  toggleFavorite: (toolId: number) => void;
  isFavorite: (toolId: number) => boolean;
  setRating: (toolId: number, score: number, tags?: string[], comment?: string) => Promise<boolean>;
  getRating: (toolId: number) => number;
  toggleTheme: () => void;
  login: () => void;
  logout: () => void;
  migrateFromLocalStorage: () => void;
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      ratings: {},
      theme: 'light',
      isLoggedIn: false,
      pendingMigration: false,

      toggleFavorite: (toolId) => {
        const { favorites, isLoggedIn } = get();
        const isAdding = !favorites.includes(toolId);
        const updated = isAdding
          ? [...favorites, toolId]
          : favorites.filter(id => id !== toolId);
        set({ favorites: updated });

        // Fire-and-forget API call
        if (isLoggedIn) {
          toggleFavoriteAPI(toolId, isAdding ? 'add' : 'remove').catch(() => {});
        }
      },

      isFavorite: (toolId) => get().favorites.includes(toolId),

      setRating: async (toolId, score, tags, comment) => {
        const result = await submitRating(toolId, score, tags, comment);
        if (!result.ok) return false;
        set({ ratings: { ...get().ratings, [toolId]: score } });
        return true;
      },

      getRating: (toolId) => get().ratings[toolId] ?? 0,

      toggleTheme: () => {
        const newTheme = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme });
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('dark', newTheme === 'dark');
        }
      },

      login: () => {
        set({ isLoggedIn: true });
      },

      logout: () => {
        set({ isLoggedIn: false });
      },

      // D-06: Detect localStorage data and prepare for cloud merge
      migrateFromLocalStorage: () => {
        const { favorites, ratings, isLoggedIn } = get();
        if (!isLoggedIn) return;
        const hasLocalData = favorites.length > 0 || Object.keys(ratings).length > 0;
        if (hasLocalData) {
          set({ pendingMigration: true });
        }
      },
    }),
    {
      name: 'ai-tool-hub-user',
      // D-06: Add localStorage capacity monitoring
      onRehydrateStorage: () => {
        return (state) => {
          if (typeof window !== 'undefined' && state) {
            try {
              const used = new Blob([JSON.stringify(localStorage)]).size;
              const maxBytes = 5 * 1024 * 1024; // 5MB typical limit
              if (used > maxBytes * 0.8) {
                console.warn(`localStorage usage at ${(used / maxBytes * 100).toFixed(1)}% (${(used / 1024).toFixed(0)}KB / ${(maxBytes / 1024).toFixed(0)}KB)`);
              }
            } catch { /* ignore */ }
          }
        };
      },
    }
  )
);
