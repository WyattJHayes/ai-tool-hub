export const DEFAULT_THEME = 'dark';
export const THEME_STORAGE_KEY = 'ai-tool-hub-user';

export function resolveStoredTheme(raw, fallback) {
  try {
    const theme = raw ? JSON.parse(raw)?.state?.theme : null;
    return theme === 'light' || theme === 'dark' ? theme : fallback;
  } catch {
    return fallback;
  }
}

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const resolveStoredTheme = ${resolveStoredTheme.toString()};
  let stored = null;
  try {
    stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  } catch {
    stored = null;
  }
  const theme = resolveStoredTheme(
    stored,
    ${JSON.stringify(DEFAULT_THEME)},
  );
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
})();`;
