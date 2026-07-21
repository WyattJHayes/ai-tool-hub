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
export interface ThemeStorageValue<State> {
  state: State;
  version?: number;
}
export interface ThemeStorage<State> {
  getItem(name: string): ThemeStorageValue<State> | null;
  setItem(name: string, value: ThemeStorageValue<State>): void;
  removeItem(name: string): void;
}
export function createSafeStorage(storageSource?: Storage | (() => Storage | null | undefined) | null): SafeStorage;
export function createThemeStorage<State = unknown>(storageSource?: Storage | (() => Storage | null | undefined) | null): ThemeStorage<State>;
export function parseStoredThemeEnvelope(raw: string | null): ThemeStorageValue<{ theme: Theme }> | null;
export function resolveStoredTheme(raw: string | null, fallback: Theme): Theme;
export function synchronizeTheme(theme: Theme, documentRef?: Document | null): void;
