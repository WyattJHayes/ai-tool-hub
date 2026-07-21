'use client';

import { create } from 'zustand';
import { persist, type PersistStorage, type StateStorage, type StorageValue } from 'zustand/middleware';
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

type RepeatableSectionKey = 'experience' | 'projects' | 'education';
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
  acceptChange: (changeId: string) => void;
  acceptAllChanges: () => void;
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
  storage: StateStorage,
): PersistStorage<Pick<ResumeStore, 'document'>> {
  const parse = (serialized: string | null): StorageValue<Pick<ResumeStore, 'document'>> | null => {
    if (serialized === null) return null;
    try {
      const value: unknown = JSON.parse(serialized);
      if (value !== null && typeof value === 'object' && Object.hasOwn(value, 'state')) {
        return value as StorageValue<Pick<ResumeStore, 'document'>>;
      }
    } catch {
      // A malformed local document must not prevent the user from opening a fresh resume.
    }
    void storage.removeItem(RESUME_STORAGE_KEY);
    return null;
  };

  return {
    getItem: (name) => {
      const value = storage.getItem(name);
      return value instanceof Promise ? value.then(parse) : parse(value);
    },
    setItem: (name, value) => storage.setItem(name, JSON.stringify(value)),
    removeItem: (name) => storage.removeItem(name),
  };
}

const browserStorage = createResumeStorage(
  typeof window === 'undefined' ? serverStorage : window.localStorage,
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
  applied: boolean;
}

function applyChange(document: ResumeDocumentV1, change: ResumeChange): ChangeApplication {
  if (change.section === 'summary' && change.field === 'summary') {
    return { document: { ...document, summary: change.after }, applied: true };
  }
  if (change.section === 'target' && change.field === 'target') {
    return { document: { ...document, target: change.after }, applied: true };
  }
  if (change.section === 'profile' && isProfileField(change.field)) {
    return {
      document: { ...document, profile: { ...document.profile, [change.field]: change.after } },
      applied: true,
    };
  }
  if (isRepeatableSection(change.section) && change.itemId && isItemField(change.section, change.field)) {
    const currentItems = itemsFor(document, change.section);
    if (!currentItems.some(item => item.id === change.itemId)) return { document, applied: false };
    const items = currentItems.map(item => (
      item.id === change.itemId ? { ...item, [change.field]: change.after } : item
    ));
    return { document: replaceItems(document, change.section, items), applied: true };
  }
  return { document, applied: false };
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

    acceptChange: (changeId) => set(state => {
      const change = state.changes.find(candidate => candidate.id === changeId && !candidate.accepted);
      if (!change) return {};
      const result = applyChange(state.document, change);
      if (!result.applied) return {};
      return {
        document: withTimestamp(normalizeResumeDocument(result.document)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
        changes: state.changes.map(candidate => candidate.id === changeId ? { ...candidate, accepted: true } : candidate),
      };
    }),

    acceptAllChanges: () => set(state => {
      const pending = state.changes.filter(change => !change.accepted);
      if (!pending.length) return {};
      let document = state.document;
      const acceptedChangeIds = new Set<string>();
      for (const change of pending) {
        const result = applyChange(document, change);
        if (!result.applied) continue;
        document = result.document;
        acceptedChangeIds.add(change.id);
      }
      if (!acceptedChangeIds.size) return {};
      return {
        document: withTimestamp(normalizeResumeDocument(document)),
        undoStack: pushUndo(state.undoStack, state.document),
        changeUndoStack: pushChangeUndo(state.changeUndoStack, state.changes),
        changes: state.changes.map(change => (
          acceptedChangeIds.has(change.id) ? { ...change, accepted: true } : change
        )),
      };
    }),

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
