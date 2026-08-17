import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toggleFavoriteAPI, submitRating } from '@/lib/api';
import { isRatingAggregate, type RatingAggregate } from '@/lib/ratings';
import {
  createThemeStorage,
  DEFAULT_THEME,
  synchronizeTheme,
  THEME_STORAGE_KEY,
  THEME_STORAGE_VERSION,
} from '@/lib/theme-bootstrap.mjs';

interface UserStore {
  favorites: number[];
  ratings: Record<number, number>;
  theme: 'dark' | 'light' | 'cyberpunk';
  /** The regular theme to return to when leaving cyberpunk mode. */
  baseTheme: 'dark' | 'light';
  isLoggedIn: boolean;
  pendingMigration: boolean;
  /** Tool id whose latest favorite sync failed; UI shows an inline notice. */
  favoriteSyncError: number | null;

  toggleFavorite: (toolId: number) => void;
  isFavorite: (toolId: number) => boolean;
  clearFavoriteSyncError: (toolId?: number) => void;
  setRating: (toolId: number, score: number, tags?: string[], comment?: string) => Promise<RatingAggregate | null>;
  getRating: (toolId: number) => number;
  toggleTheme: () => void;
  toggleCyberpunk: () => void;
  login: () => void;
  logout: () => void;
  migrateFromLocalStorage: () => void;
}

/** The durable slice of UserStore that survives to localStorage. */
type PersistedUserState = Pick<
  UserStore,
  'favorites' | 'ratings' | 'theme' | 'isLoggedIn'
>;

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      ratings: {},
      theme: DEFAULT_THEME,
      baseTheme: 'dark',
      isLoggedIn: false,
      pendingMigration: false,
      favoriteSyncError: null,

      toggleFavorite: (toolId) => {
        const { favorites, isLoggedIn } = get();
        const isAdding = !favorites.includes(toolId);
        const updated = isAdding
          ? [...favorites, toolId]
          : favorites.filter(id => id !== toolId);
        set({ favorites: updated, favoriteSyncError: null });

        // Optimistic update: roll back and surface an error if the server
        // rejects the change, so the star the user saw never lies silently.
        if (isLoggedIn) {
          toggleFavoriteAPI(toolId, isAdding ? 'add' : 'remove').catch(() => {
            const current = get().favorites;
            const rolledBack = isAdding
              ? current.filter(id => id !== toolId)
              : current.includes(toolId) ? current : [...current, toolId];
            set({ favorites: rolledBack, favoriteSyncError: toolId });
          });
        }
      },

      isFavorite: (toolId) => get().favorites.includes(toolId),

      clearFavoriteSyncError: (toolId) => {
        const current = get().favoriteSyncError;
        if (current === null) return;
        if (toolId === undefined || current === toolId) set({ favoriteSyncError: null });
      },

      setRating: async (toolId, score, tags, comment) => {
        const result = await submitRating(toolId, score, tags, comment);
        if (
          !result ||
          typeof result !== 'object' ||
          (result as { ok?: unknown }).ok !== true ||
          !isRatingAggregate(result) ||
          result.rating_count === 0
        ) return null;
        set({ ratings: { ...get().ratings, [toolId]: score } });
        return { avg_rating: result.avg_rating, rating_count: result.rating_count };
      },

      getRating: (toolId) => get().ratings[toolId] ?? 0,

      toggleTheme: () => {
        const { theme, baseTheme } = get();
        // The button always does exactly what its label says. From cyberpunk
        // the label announces the regular theme opposite to baseTheme (e.g.
        // entered from dark -> "切换到亮色主题"), so the click leaves
        // cyberpunk and lands on that announced theme.
        const next = theme === 'cyberpunk'
          ? (baseTheme === 'dark' ? 'light' : 'dark')
          : theme === 'dark' ? 'light' : 'dark';
        set({ theme: next, baseTheme: next });
        synchronizeTheme(next);
      },

      toggleCyberpunk: () => {
        const { theme, baseTheme } = get();
        if (theme === 'cyberpunk') {
          set({ theme: baseTheme });
          synchronizeTheme(baseTheme);
        } else {
          set({ theme: 'cyberpunk', baseTheme: theme });
          synchronizeTheme('cyberpunk');
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
      name: THEME_STORAGE_KEY,
      // Storage passes the whole envelope through (see theme-bootstrap.mjs);
      // transient flags landing in localStorage is harmless — on rehydrate a
      // stale sync-error notice clears on the next favorite interaction.
      storage: createThemeStorage<UserStore>(() => window.localStorage),
      version: THEME_STORAGE_VERSION,
      // D-06: Add localStorage capacity monitoring
      onRehydrateStorage: () => {
        return (state) => {
          if (typeof window !== 'undefined' && state) {
            synchronizeTheme(state.theme);
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
