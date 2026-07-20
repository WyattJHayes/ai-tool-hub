export type Theme = 'dark' | 'light';

export const DEFAULT_THEME: Theme;
export const THEME_STORAGE_KEY: 'ai-tool-hub-user';
export const THEME_STORAGE_VERSION: 0;
export const THEME_BOOTSTRAP_SCRIPT: string;
export interface SafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
export function createSafeStorage(storageSource?: Storage | (() => Storage | null | undefined) | null): SafeStorage;
export function resolveStoredTheme(raw: string | null, fallback: Theme): Theme;
export function synchronizeTheme(theme: Theme, documentRef?: Document | null): void;
