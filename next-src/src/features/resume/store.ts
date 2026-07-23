'use client';

import { create } from 'zustand';
import { persist, type PersistStorage, type StateStorage, type StorageValue } from 'zustand/middleware';
import { useSyncExternalStore } from 'react';
import { createEmptyResume, normalizeResumeDocument } from './schema';
import type {
  ResumeChange,
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
  ResumeSectionKey,
} from './types';

export const RESUME_STORAGE_KEY = 'weihub-resume-v1';
export const RESUME_STORAGE_BACKUP_KEY = 'weihub-resume-v1-recovery-v1';

export type ResumeStorageIssueCode =
  | 'malformed'
  | 'unsupported'
  | 'normalization-failed'
  | 'read-failed'
  | 'write-failed'
  | 'remove-failed';

export interface ResumeStorageIssue {
  code: ResumeStorageIssueCode;
  blocking: boolean;
  recoverable: boolean;
}

interface ResumeStorageOptions {
  normalize?: (input: unknown) => ResumeDocumentV1;
  onIssue?: (issue: ResumeStorageIssue | null) => void;
}

export interface ResumePersistStorage extends PersistStorage<Pick<ResumeStore, 'document'>> {
  getIssue(): ResumeStorageIssue | null;
  getRecoveryItem(): Promise<string | null>;
  resolve(): Promise<void>;
}

type RepeatableSectionKey = 'experience' | 'projects' | 'education';
type CollectionSectionKey = RepeatableSectionKey | 'skills' | 'certificates';
type RepeatableItem = ResumeExperience | ResumeProject | ResumeEducation;

interface ResumeStore {
  document: ResumeDocumentV1;
  undoStack: ResumeDocumentV1[];
  changeUndoStack: ResumeChange[][];
  stagedImport: ResumeDocumentV1 | null;
  changes: ResumeChange[];
  backup: ResumeDocumentV1 | null;
  saveState: (document: ResumeDocumentV1) => void;
  undo: () => void;
  stageImport: (input: unknown) => void;
  acceptStagedImport: () => void;
  discardStagedImport: () => void;
  reorderItems: (section: RepeatableSectionKey, fromIndex: number, toIndex: number) => void;
  duplicateItem: (section: RepeatableSectionKey, itemId: string) => void;
  deleteItem: (section: RepeatableSectionKey, itemId: string) => void;
  setChanges: (changes: ResumeChange[]) => void;
  acceptChange: (changeId: string) => ResumeChangeAcceptanceResult;
  acceptAllChanges: () => ResumeChangeAcceptanceResult;
  rejectChange: (changeId: string) => void;
  resetDocument: () => void;
  exportBackup: () => string | null;
}

const serverStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export function createResumeStorage(
  storageSource: StateStorage | (() => StateStorage),
  options: ResumeStorageOptions = {},
): ResumePersistStorage {
  const getStorage = typeof storageSource === 'function'
    ? storageSource
    : () => storageSource;
  const normalize = options.normalize ?? normalizeResumeDocument;
  let issue: ResumeStorageIssue | null = null;
  let blocked = false;
  let lastPrimaryRaw: string | null = null;

  const report = (nextIssue: ResumeStorageIssue | null) => {
    issue = nextIssue;
    options.onIssue?.(nextIssue);
  };

  const fail = (code: ResumeStorageIssueCode, blocking: boolean, recoverable: boolean) => {
    blocked = blocking;
    report({ code, blocking, recoverable });
  };

  const preserve = (
    serialized: string,
    code: Extract<ResumeStorageIssueCode, 'malformed' | 'unsupported' | 'normalization-failed'>,
  ): StorageValue<Pick<ResumeStore, 'document'>> | null | Promise<null> => {
    blocked = true;
    lastPrimaryRaw = serialized;
    const finish = () => {
      report({ code, blocking: true, recoverable: true });
      return null;
    };
    try {
      const stored = getStorage().setItem(RESUME_STORAGE_BACKUP_KEY, serialized);
      return stored instanceof Promise ? stored.then(finish, finish) : finish();
    } catch {
      return finish();
    }
  };

  const parse = (
    serialized: string | null,
  ): StorageValue<Pick<ResumeStore, 'document'>> | null | Promise<null> => {
    if (serialized === null) {
      lastPrimaryRaw = null;
      blocked = false;
      if (issue?.blocking) report(null);
      return null;
    }
    lastPrimaryRaw = serialized;
    let value: unknown;
    try {
      value = JSON.parse(serialized);
    } catch {
      return preserve(serialized, 'malformed');
    }
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, 'state')) {
      return preserve(serialized, 'malformed');
    }
    const state = (value as { state?: unknown }).state;
    if (!state || typeof state !== 'object' || !Object.hasOwn(state, 'document')) {
      return preserve(serialized, 'malformed');
    }
    const document = (state as { document?: unknown }).document;
    let normalized: ResumeDocumentV1;
    try {
      normalized = normalize(document);
    } catch {
      const version = document && typeof document === 'object'
        ? (document as { schemaVersion?: unknown }).schemaVersion
        : undefined;
      return preserve(serialized, typeof version === 'number' && version > 1 ? 'unsupported' : 'normalization-failed');
    }
    blocked = false;
    if (issue?.blocking) report(null);
    return {
      state: { document: normalized },
      version: typeof (value as { version?: unknown }).version === 'number'
        ? (value as { version: number }).version
        : 0,
    };
  };

  return {
    getItem: (name) => {
      try {
        const value = getStorage().getItem(name);
        return value instanceof Promise
          ? value.then(parse, () => {
            fail('read-failed', true, false);
            return null;
          })
          : parse(value);
      } catch {
        fail('read-failed', true, false);
        return null;
      }
    },
    setItem: (name, value) => {
      if (name === RESUME_STORAGE_KEY && blocked) {
        throw new Error('Resume persistence is blocked until storage recovery is resolved.');
      }
      const serialized = JSON.stringify(value);
      const finish = () => {
        if (name === RESUME_STORAGE_KEY) lastPrimaryRaw = serialized;
        if (issue?.code === 'write-failed') report(null);
      };
      const reject = () => {
        fail('write-failed', false, lastPrimaryRaw !== null);
        throw new Error('Resume persistence failed.');
      };
      try {
        const result = getStorage().setItem(name, serialized);
        return result instanceof Promise ? result.then(finish, reject) : finish();
      } catch {
        return reject();
      }
    },
    removeItem: (name) => {
      const finish = () => {
        if (name === RESUME_STORAGE_KEY) lastPrimaryRaw = null;
        if (issue?.code === 'remove-failed') report(null);
      };
      const reject = () => {
        fail('remove-failed', true, lastPrimaryRaw !== null);
        throw new Error('Resume persistence removal failed.');
      };
      try {
        const result = getStorage().removeItem(name);
        return result instanceof Promise ? result.then(finish, reject) : finish();
      } catch {
        return reject();
      }
    },
    getIssue: () => issue,
    async getRecoveryItem() {
      let primaryReadFailed = false;
      try {
        const primary = await getStorage().getItem(RESUME_STORAGE_KEY);
        if (primary !== null) return primary;
      } catch {
        primaryReadFailed = true;
      }
      try {
        const backup = await getStorage().getItem(RESUME_STORAGE_BACKUP_KEY);
        if (primaryReadFailed) {
          fail('read-failed', true, backup !== null);
        }
        return backup;
      } catch {
        fail('read-failed', true, false);
        return null;
      }
    },
    async resolve() {
      let primary: string | null;
      try {
        primary = await getStorage().getItem(RESUME_STORAGE_KEY);
      } catch {
        fail('read-failed', true, false);
        throw new Error('Resume persistence read failed.');
      }
      if (primary !== null) {
        try {
          await getStorage().setItem(RESUME_STORAGE_BACKUP_KEY, primary);
        } catch {
          fail('write-failed', true, true);
          throw new Error('Resume recovery backup failed.');
        }
      }
      try {
        await getStorage().removeItem(RESUME_STORAGE_KEY);
      } catch {
        fail('remove-failed', true, primary !== null);
        throw new Error('Resume persistence removal failed.');
      }
      lastPrimaryRaw = null;
      blocked = false;
      report(null);
    },
  };
}

let browserStorageIssue: ResumeStorageIssue | null = null;
const storageIssueListeners = new Set<() => void>();

function publishBrowserStorageIssue(issue: ResumeStorageIssue | null) {
  browserStorageIssue = issue;
  for (const listener of storageIssueListeners) listener();
}

export function useResumeStorageIssue(): ResumeStorageIssue | null {
  return useSyncExternalStore(
    listener => {
      storageIssueListeners.add(listener);
      return () => storageIssueListeners.delete(listener);
    },
    () => browserStorageIssue,
    () => null,
  );
}

const browserStorage = createResumeStorage(
  () => typeof window === 'undefined' ? serverStorage : window.localStorage,
  { onIssue: publishBrowserStorageIssue },
);

function cloneDocument(document: ResumeDocumentV1): ResumeDocumentV1 {
  return normalizeResumeDocument(document);
}

function withTimestamp(document: ResumeDocumentV1): ResumeDocumentV1 {
  return { ...document, updatedAt: new Date().toISOString() };
}

function pushUndo(undoStack: ResumeDocumentV1[], document: ResumeDocumentV1): ResumeDocumentV1[] {
  return [...undoStack, cloneDocument(document)].slice(-20);
}

function cloneChanges(changes: ResumeChange[]): ResumeChange[] {
  return changes.map(change => ({ ...change }));
}

function pushChangeUndo(undoStack: ResumeChange[][], changes: ResumeChange[]): ResumeChange[][] {
  return [...undoStack, cloneChanges(changes)].slice(-20);
}

function itemsFor(document: ResumeDocumentV1, section: RepeatableSectionKey): RepeatableItem[] {
  return document[section];
}

function replaceItems(
  document: ResumeDocumentV1,
  section: RepeatableSectionKey,
  items: RepeatableItem[],
): ResumeDocumentV1 {
  return { ...document, [section]: items } as ResumeDocumentV1;
}

function createUniqueItemId(document: ResumeDocumentV1): string {
  const ids = new Set([
    document.id,
    document.profile.id,
    ...document.experience.map(item => item.id),
    ...document.projects.map(item => item.id),
    ...document.education.map(item => item.id),
  ]);
  let id = globalThis.crypto.randomUUID();
  while (ids.has(id)) id = globalThis.crypto.randomUUID();
  return id;
}

interface ChangeApplication {
  document: ResumeDocumentV1;
  status: 'applied' | 'conflict' | 'invalid';
}

export type ResumeChangeAcceptanceResult = 'accepted' | 'conflict' | 'missing';

function applyChange(document: ResumeDocumentV1, change: ResumeChange): ChangeApplication {
  if (change.section === 'summary' && change.field === 'summary') {
    if (document.summary !== change.before) return { document, status: 'conflict' };
    return { document: { ...document, summary: change.after }, status: 'applied' };
  }
  if (change.section === 'target' && change.field === 'target') {
    if (document.target !== change.before) return { document, status: 'conflict' };
    return { document: { ...document, target: change.after }, status: 'applied' };
  }
  if (change.section === 'profile' && isProfileField(change.field)) {
    if (document.profile[change.field] !== change.before) return { document, status: 'conflict' };
    return {
      document: { ...document, profile: { ...document.profile, [change.field]: change.after } },
      status: 'applied',
    };
  }
  if (change.field === 'items' && isCollectionSection(change.section)) {
    if (JSON.stringify(document[change.section]) !== change.before) return { document, status: 'conflict' };
    try {
      const items: unknown = JSON.parse(change.after);
      if (!Array.isArray(items)) return { document, status: 'invalid' };
      return {
        document: normalizeResumeDocument({ ...document, [change.section]: items }),
        status: 'applied',
      };
    } catch {
      return { document, status: 'invalid' };
    }
  }
  if (isRepeatableSection(change.section) && change.itemId && isItemField(change.section, change.field)) {
    const currentItems = itemsFor(document, change.section);
    const currentItem = currentItems.find(item => item.id === change.itemId);
    if (!currentItem) return { document, status: 'conflict' };
    if ((currentItem as unknown as Record<string, string>)[change.field] !== change.before) {
      return { document, status: 'conflict' };
    }
    const items = currentItems.map(item => (
      item.id === change.itemId ? { ...item, [change.field]: change.after } : item
    ));
    return { document: replaceItems(document, change.section, items), status: 'applied' };
  }
  return { document, status: 'invalid' };
}

function isCollectionSection(section: ResumeSectionKey): section is CollectionSectionKey {
  return isRepeatableSection(section) || section === 'skills' || section === 'certificates';
}

function isRepeatableSection(section: ResumeSectionKey): section is RepeatableSectionKey {
  return section === 'experience' || section === 'projects' || section === 'education';
}

function isProfileField(field: string): field is keyof Omit<ResumeDocumentV1['profile'], 'id'> {
  return ['fullName', 'phone', 'email', 'location', 'title'].includes(field);
}

function isItemField(section: RepeatableSectionKey, field: string): boolean {
  const fields = section === 'education'
    ? ['school', 'major', 'degree', 'startDate', 'endDate']
    : section === 'experience'
      ? ['company', 'role', 'startDate', 'endDate', 'description']
      : ['name', 'role', 'startDate', 'endDate', 'description'];
  return fields.includes(field);
}

export const useResumeStore = create<ResumeStore>()(persist(
  (set, get) => ({
    document: createEmptyResume(),
    undoStack: [],
    changeUndoStack: [],
    stagedImport: null,
    changes: [],
    backup: null,

    saveState: (document) => set(state => ({
      document: withTimestamp(normalizeResumeDocument(document)),
      undoStack: pushUndo(state.undoStack, state.document),
      changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
    })),

    undo: () => set(state => {
      const previous = state.undoStack.at(-1);
      const previousChanges = state.changeUndoStack.at(-1);
      return previous ? {
        document: cloneDocument(previous),
        undoStack: state.undoStack.slice(0, -1),
        changes: previousChanges ? cloneChanges(previousChanges) : state.changes,
        changeUndoStack: state.changeUndoStack.slice(0, -1),
      } : {};
    }),

    stageImport: (input) => set({ stagedImport: normalizeResumeDocument(input) }),

    acceptStagedImport: () => set(state => {
      if (!state.stagedImport) return {};
      return {
        document: withTimestamp(cloneDocument(state.stagedImport)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
        stagedImport: null,
      };
    }),

    discardStagedImport: () => set({ stagedImport: null }),

    reorderItems: (section, fromIndex, toIndex) => set(state => {
      const items = [...itemsFor(state.document, section)];
      if (
        fromIndex < 0 || fromIndex >= items.length ||
        toIndex < 0 || toIndex >= items.length ||
        fromIndex === toIndex
      ) return {};
      const [item] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, item);
      return {
        document: withTimestamp(replaceItems(state.document, section, items)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
      };
    }),

    duplicateItem: (section, itemId) => set(state => {
      const items = itemsFor(state.document, section);
      const index = items.findIndex(item => item.id === itemId);
      if (index < 0) return {};
      const copy = { ...items[index], id: createUniqueItemId(state.document) };
      const nextItems = [...items.slice(0, index + 1), copy, ...items.slice(index + 1)];
      return {
        document: withTimestamp(replaceItems(state.document, section, nextItems)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
      };
    }),

    deleteItem: (section, itemId) => set(state => {
      const items = itemsFor(state.document, section);
      const nextItems = items.filter(item => item.id !== itemId);
      if (nextItems.length === items.length) return {};
      return {
        document: withTimestamp(replaceItems(state.document, section, nextItems)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
      };
    }),

    setChanges: (changes) => set({ changes: changes.map(change => ({ ...change, accepted: Boolean(change.accepted) })) }),

    acceptChange: (changeId) => {
      let outcome: ResumeChangeAcceptanceResult = 'missing';
      set(state => {
        const change = state.changes.find(candidate => candidate.id === changeId && !candidate.accepted);
        if (!change) return {};
        const result = applyChange(state.document, change);
        if (result.status !== 'applied') {
          outcome = 'conflict';
          return { changes: [] };
        }
        outcome = 'accepted';
        return {
          document: withTimestamp(normalizeResumeDocument(result.document)),
          undoStack: pushUndo(state.undoStack, state.document),
          changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
          changes: state.changes.map(candidate => candidate.id === changeId ? { ...candidate, accepted: true } : candidate),
        };
      });
      return outcome;
    },

    acceptAllChanges: () => {
      let outcome: ResumeChangeAcceptanceResult = 'missing';
      set(state => {
        const pending = state.changes.filter(change => !change.accepted);
        if (!pending.length) return {};
        let document = state.document;
        for (const change of pending) {
          const result = applyChange(document, change);
          if (result.status !== 'applied') {
            outcome = 'conflict';
            return { changes: [] };
          }
          document = result.document;
        }
        outcome = 'accepted';
        return {
          document: withTimestamp(normalizeResumeDocument(document)),
          undoStack: pushUndo(state.undoStack, state.document),
          changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
          changes: state.changes.map(change => ({ ...change, accepted: true })),
        };
      });
      return outcome;
    },

    rejectChange: (changeId) => set(state => ({
      changes: state.changes.filter(change => change.id !== changeId),
    })),

    resetDocument: () => set(state => ({
      document: createEmptyResume(),
      undoStack: pushUndo(state.undoStack, state.document),
      changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
      stagedImport: null,
      changes: [],
      backup: cloneDocument(state.document),
    })),

    exportBackup: () => {
      const backup = get().backup;
      return backup ? JSON.stringify(backup) : null;
    },
  }),
  {
    name: RESUME_STORAGE_KEY,
    storage: browserStorage,
    partialize: state => ({ document: state.document }),
    merge: (persistedState, currentState) => {
      const document = (persistedState as { document?: unknown } | undefined)?.document;
      return document === undefined
        ? currentState
        : { ...currentState, document: normalizeResumeDocument(document) };
    },
  },
));

export async function getResumeStorageRecoveryItem(): Promise<string | null> {
  return browserStorage.getRecoveryItem();
}

export async function retryResumeStoragePersistence(): Promise<boolean> {
  const currentIssue = browserStorage.getIssue();
  try {
    if (currentIssue?.blocking) {
      await useResumeStore.persist.rehydrate();
    } else {
      useResumeStore.setState({ document: cloneDocument(useResumeStore.getState().document) });
    }
  } catch {
    return false;
  }
  return browserStorage.getIssue() === null;
}

export async function resolveResumeStorageWithEmptyDocument(): Promise<boolean> {
  try {
    await browserStorage.resolve();
    useResumeStore.setState({
      document: createEmptyResume(),
      undoStack: [],
      changeUndoStack: [],
      stagedImport: null,
      changes: [],
      backup: null,
    });
  } catch {
    return false;
  }
  return browserStorage.getIssue() === null;
}
