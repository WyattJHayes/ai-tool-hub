export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'ai-tool-hub-user';
export const THEME_STORAGE_VERSION = 0;

export const THEMES = ['dark', 'light', 'cyberpunk'];

export function createSafeStorage(storageSource) {
  const storage = () => {
    try {
      return typeof storageSource === 'function' ? storageSource() : storageSource;
    } catch {
      return null;
    }
  };

  return {
    getItem(key) {
      try {
        return storage()?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage()?.setItem(key, value);
      } catch {
        // Theme persistence is optional when browser storage is unavailable.
      }
    },
    removeItem(key) {
      try {
        storage()?.removeItem(key);
      } catch {
        // Theme persistence is optional when browser storage is unavailable.
      }
    },
  };
}

export function resolveStoredTheme(raw, fallback) {
  return parseStoredThemeEnvelope(raw)?.state?.theme || fallback;
}

export function parseStoredThemeEnvelope(raw) {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    const theme = parsed?.state?.theme;
    return parsed?.version === THEME_STORAGE_VERSION
      && (theme === 'light' || theme === 'dark' || theme === 'cyberpunk')
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function createThemeStorage(storageSource) {
  const rawStorage = createSafeStorage(storageSource);
  return {
    getItem(name) {
      return parseStoredThemeEnvelope(rawStorage.getItem(name));
    },
    setItem(name, value) {
      try {
        rawStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Theme persistence is optional when a state cannot be serialized.
      }
    },
    removeItem(name) {
      rawStorage.removeItem(name);
    },
  };
}

// Inlined in synchronizeTheme (not a module ref): this function is serialized
// verbatim into the pre-paint bootstrap script, so it must be self-contained.
export function synchronizeTheme(theme, documentRef = typeof document === 'undefined' ? null : document) {
  if (!documentRef) return;
  const themeColorMeta = { dark: '#080B0E', light: '#F3F6F8', cyberpunk: '#06060B' };
  const isDark = theme === 'dark';
  const color = themeColorMeta[theme] ?? themeColorMeta.dark;
  const root = documentRef.documentElement;
  root.classList.toggle('dark', isDark);
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme === 'cyberpunk' ? 'dark' : theme;
  documentRef.querySelectorAll?.('meta[name="theme-color"]').forEach((meta) => {
    meta.content = color;
  });
}

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const THEME_STORAGE_VERSION = ${THEME_STORAGE_VERSION};
  const createSafeStorage = ${createSafeStorage.toString()};
  const parseStoredThemeEnvelope = ${parseStoredThemeEnvelope.toString()};
  const synchronizeTheme = ${synchronizeTheme.toString()};
  let storageSource = null;
  try {
    storageSource = window.localStorage;
  } catch {
    storageSource = null;
  }
  const stored = createSafeStorage(storageSource).getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  const parsed = parseStoredThemeEnvelope(stored);
  const theme = parsed?.state?.theme || ${JSON.stringify(DEFAULT_THEME)};
  synchronizeTheme(theme, document);
})();`;
