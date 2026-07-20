export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme;
export const THEME_STORAGE_KEY: 'ai-tool-hub-user';
export const THEME_BOOTSTRAP_SCRIPT: string;
export function resolveStoredTheme(raw: string | null, fallback: Theme): Theme;
