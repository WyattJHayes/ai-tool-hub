import type { ExtractedResumeText } from './importer';
import type {
  ResumeChange,
  ResumeDocumentV1,
  ResumeEducation,
  ResumeExperience,
  ResumeProject,
} from './types';

export type ResumeImportMode = 'merge' | 'replace';
export type ResumeSaveState = 'unsaved' | 'saving' | 'saved' | 'error';

export interface ResumeImportPreview {
  extracted: ExtractedResumeText;
  document: ResumeDocumentV1;
}

export interface ImportDialogState {
  preview: ResumeImportPreview | null;
  busy: boolean;
  error: string;
}

export type ImportDialogAction =
  | { type: 'start' }
  | { type: 'ready'; preview: ResumeImportPreview }
  | { type: 'failure'; error: string }
  | { type: 'set-busy'; busy: boolean }
  | { type: 'reset' };

export const initialImportDialogState: ImportDialogState = {
  preview: null,
  busy: false,
  error: '',
};

export function reduceImportDialogState(
  state: ImportDialogState,
  action: ImportDialogAction,
): ImportDialogState {
  switch (action.type) {
    case 'start':
      return { preview: null, busy: true, error: '' };
    case 'ready':
      return { preview: action.preview, busy: false, error: '' };
    case 'failure':
      return { ...state, busy: false, error: action.error };
    case 'set-busy':
      return { ...state, busy: action.busy };
    case 'reset':
      return initialImportDialogState;
  }
}

function uniqueText(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function contentKey(item: ResumeExperience | ResumeProject | ResumeEducation): string {
  return Object.entries(item)
    .filter(([key]) => key !== 'id')
    .map(([, value]) => value.trim())
    .join('\u0000');
}

function uniqueItems<T extends ResumeExperience | ResumeProject | ResumeEducation>(values: T[]): T[] {
  const keys = new Set<string>();
  return values.filter(value => {
    const key = contentKey(value);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function buildResumeImportCandidate(
  mode: ResumeImportMode,
  current: ResumeDocumentV1,
  imported: ResumeDocumentV1,
): ResumeDocumentV1 {
  if (mode === 'replace') return imported;

  return {
    ...current,
    name: current.name === 'Untitled resume' ? imported.name : current.name,
    profile: {
      ...current.profile,
      fullName: current.profile.fullName || imported.profile.fullName,
      phone: current.profile.phone || imported.profile.phone,
      email: current.profile.email || imported.profile.email,
      location: current.profile.location || imported.profile.location,
      title: current.profile.title || imported.profile.title,
    },
    target: current.target || imported.target,
    summary: current.summary || imported.summary,
    experience: uniqueItems([...current.experience, ...imported.experience]),
    projects: uniqueItems([...current.projects, ...imported.projects]),
    education: uniqueItems([...current.education, ...imported.education]),
    skills: uniqueText([...current.skills, ...imported.skills]),
    certificates: uniqueText([...current.certificates, ...imported.certificates]),
  };
}

export interface ResumeImportTransactionState {
  document: ResumeDocumentV1;
  undoStack: ResumeDocumentV1[];
  changeUndoStack: ResumeChange[][];
  stagedImport: ResumeDocumentV1 | null;
  changes: ResumeChange[];
  backup: ResumeDocumentV1 | null;
}

export interface ResumeImportTransactionAdapter {
  getState: () => ResumeImportTransactionState;
  stageImport: (candidate: ResumeDocumentV1) => void;
  acceptStagedImport: () => void;
  restoreState: (snapshot: ResumeImportTransactionState) => void;
}

export type ResumeImportTransactionResult =
  | { ok: true }
  | { ok: false; error: unknown };

function cloneTransactionState(state: ResumeImportTransactionState): ResumeImportTransactionState {
  return structuredClone({
    document: state.document,
    undoStack: state.undoStack,
    changeUndoStack: state.changeUndoStack,
    stagedImport: state.stagedImport,
    changes: state.changes,
    backup: state.backup,
  });
}

export function commitResumeImport(
  mode: ResumeImportMode,
  current: ResumeDocumentV1,
  imported: ResumeDocumentV1,
  adapter: ResumeImportTransactionAdapter,
): ResumeImportTransactionResult {
  const snapshot = cloneTransactionState(adapter.getState());

  try {
    const candidate = buildResumeImportCandidate(mode, current, imported);
    adapter.stageImport(candidate);
    adapter.acceptStagedImport();
    return { ok: true };
  } catch (error) {
    try {
      adapter.restoreState({ ...snapshot, stagedImport: null });
    } catch {
      // Zustand mutates memory before persistence; restoration can succeed in memory and still throw.
    }
    return { ok: false, error };
  }
}

function hasText(value: string): boolean {
  return Boolean(value.trim());
}

export function isResumeExperiencePopulated(item: ResumeExperience): boolean {
  return [item.company, item.role, item.startDate, item.endDate, item.description].some(hasText);
}

export function isResumeProjectPopulated(item: ResumeProject): boolean {
  return [item.name, item.role, item.startDate, item.endDate, item.description].some(hasText);
}

export function isResumeEducationPopulated(item: ResumeEducation): boolean {
  return [item.school, item.major, item.degree, item.startDate, item.endDate].some(hasText);
}

export function countPopulatedResumeFields(document: ResumeDocumentV1): number {
  return [
    document.profile.fullName,
    document.profile.phone,
    document.profile.email,
    document.profile.location,
    document.profile.title,
    document.target,
    document.summary,
    ...document.experience.flatMap(item => [item.company, item.role, item.startDate, item.endDate, item.description]),
    ...document.projects.flatMap(item => [item.name, item.role, item.startDate, item.endDate, item.description]),
    ...document.education.flatMap(item => [item.school, item.major, item.degree, item.startDate, item.endDate]),
    ...document.skills,
    ...document.certificates,
  ].filter(hasText).length;
}

export interface SaveStatusScheduler {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (timer: unknown) => void;
}

export interface SaveStatusController {
  commit: (mutation: () => void) => void;
  dispose: () => void;
}

export function createSaveStatusController(
  onStatusChange: (status: ResumeSaveState) => void,
  scheduler: SaveStatusScheduler,
): SaveStatusController {
  let savingTimer: unknown = null;
  let settledTimer: unknown = null;

  const clearTimers = () => {
    if (savingTimer !== null) scheduler.clearTimeout(savingTimer);
    if (settledTimer !== null) scheduler.clearTimeout(settledTimer);
    savingTimer = null;
    settledTimer = null;
  };

  return {
    commit(mutation) {
      clearTimers();
      onStatusChange('unsaved');
      let settledStatus: ResumeSaveState = 'saved';
      try {
        mutation();
      } catch {
        settledStatus = 'error';
      }
      savingTimer = scheduler.setTimeout(() => {
        savingTimer = null;
        onStatusChange('saving');
        settledTimer = scheduler.setTimeout(() => {
          settledTimer = null;
          onStatusChange(settledStatus);
        }, 220);
      }, 0);
    },
    dispose: clearTimers,
  };
}
