import assert from 'node:assert/strict';
import test, { before } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ResumePreview } from '../../src/components/resume/ResumePreview';
import type { ResumeChange, ResumeDocumentV1 } from '../../src/features/resume/types';

type UiModule = typeof import('../../src/features/resume/ui');

let ui: Partial<UiModule> = {};

before(async () => {
  ui = await import('../../src/features/resume/ui').catch(() => ({} as Partial<UiModule>));
});

function requireExport<Key extends keyof UiModule>(name: Key): UiModule[Key] {
  const value = ui[name];
  assert.equal(typeof value, 'function', `missing production helper: ${String(name)}`);
  return value as UiModule[Key];
}

function resume(overrides: Partial<ResumeDocumentV1> = {}): ResumeDocumentV1 {
  return {
    schemaVersion: 1,
    id: 'resume-1',
    name: 'Current resume',
    templateId: 'precision',
    profile: {
      id: 'profile-1',
      fullName: '',
      phone: '',
      email: '',
      location: '',
      title: '',
    },
    target: '',
    summary: '',
    experience: [],
    projects: [],
    education: [],
    skills: [],
    certificates: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('builds replacement directly and merges without overwriting populated current fields', () => {
  const buildResumeImportCandidate = requireExport('buildResumeImportCandidate');
  const current = resume({
    profile: { id: 'profile-1', fullName: 'Current Name', phone: '', email: '', location: '', title: '' },
    target: 'Current target',
    experience: [{ id: 'experience-current', company: 'Acme', role: 'Engineer', startDate: '', endDate: '', description: '' }],
    skills: ['TypeScript'],
  });
  const imported = resume({
    id: 'resume-imported',
    name: 'Imported resume',
    profile: { id: 'profile-imported', fullName: 'Imported Name', phone: '123', email: 'new@example.com', location: '', title: '' },
    target: 'Imported target',
    summary: 'Imported summary',
    experience: [
      { id: 'experience-duplicate', company: ' Acme ', role: 'Engineer', startDate: '', endDate: '', description: '' },
      { id: 'experience-new', company: 'Beta', role: 'Lead', startDate: '', endDate: '', description: '' },
    ],
    skills: [' TypeScript ', 'React'],
  });

  assert.equal(buildResumeImportCandidate('replace', current, imported), imported);
  const merged = buildResumeImportCandidate('merge', current, imported);
  assert.equal(merged.profile.fullName, 'Current Name');
  assert.equal(merged.profile.phone, '123');
  assert.equal(merged.profile.email, 'new@example.com');
  assert.equal(merged.target, 'Current target');
  assert.equal(merged.summary, 'Imported summary');
  assert.deepEqual(merged.experience.map(item => item.company.trim()), ['Acme', 'Beta']);
  assert.deepEqual(merged.skills, ['TypeScript', 'React']);
});

test('treats whitespace-only current scalar values as empty during merge', () => {
  const buildResumeImportCandidate = requireExport('buildResumeImportCandidate');
  const current = resume({
    name: '   ',
    profile: { id: 'profile-current', fullName: ' ', phone: '\t', email: 'current@example.com', location: '\n', title: '  ' },
    target: '  ',
    summary: '\t',
  });
  const imported = resume({
    name: 'Imported resume',
    profile: { id: 'profile-imported', fullName: 'Imported Name', phone: '123', email: 'imported@example.com', location: 'Shanghai', title: 'Engineer' },
    target: 'Platform Engineer',
    summary: 'Imported summary',
  });

  const merged = buildResumeImportCandidate('merge', current, imported);
  assert.equal(merged.name, 'Imported resume');
  assert.deepEqual(merged.profile, {
    id: 'profile-current',
    fullName: 'Imported Name',
    phone: '123',
    email: 'current@example.com',
    location: 'Shanghai',
    title: 'Engineer',
  });
  assert.equal(merged.target, 'Platform Engineer');
  assert.equal(merged.summary, 'Imported summary');
});

test('does not stage or accept until production import confirmation explicitly confirms Merge or Replace', () => {
  const createResumeImportConfirmation = requireExport('createResumeImportConfirmation');
  const current = resume({ name: 'Current' });
  const imported = resume({ name: 'Imported' });

  for (const mode of ['merge', 'replace'] as const) {
    const calls: string[] = [];
    const state = {
      document: current,
      undoStack: [] as ResumeDocumentV1[],
      changeUndoStack: [] as ResumeChange[][],
      stagedImport: null as ResumeDocumentV1 | null,
      changes: [] as ResumeChange[],
      backup: null as ResumeDocumentV1 | null,
    };
    const confirmation = createResumeImportConfirmation(current, imported, {
      getState: () => state,
      stageImport: candidate => { calls.push('stage'); state.stagedImport = candidate; },
      acceptStagedImport: () => { calls.push('accept'); state.document = state.stagedImport!; state.stagedImport = null; },
      restoreState: snapshot => Object.assign(state, snapshot),
    });

    assert.deepEqual(calls, []);
    const candidate = confirmation.prepare(mode);
    assert.deepEqual(calls, []);
    assert.equal(candidate.name, mode === 'replace' ? 'Imported' : 'Current');

    assert.equal(confirmation.confirm(mode).ok, true);
    assert.deepEqual(calls, ['stage', 'accept']);
  }
});

test('commits an import by staging before accepting it', () => {
  const commitResumeImport = requireExport('commitResumeImport');
  const current = resume();
  const imported = resume({ name: 'Imported' });
  const calls: string[] = [];
  const state = {
    document: current,
    undoStack: [] as ResumeDocumentV1[],
    changeUndoStack: [] as ResumeChange[][],
    stagedImport: null as ResumeDocumentV1 | null,
    changes: [] as ResumeChange[],
    backup: null as ResumeDocumentV1 | null,
  };

  const result = commitResumeImport('replace', current, imported, {
    getState: () => state,
    stageImport: (candidate) => { calls.push('stage'); state.stagedImport = candidate; },
    acceptStagedImport: () => { calls.push('accept'); state.document = state.stagedImport!; state.stagedImport = null; },
    restoreState: snapshot => Object.assign(state, snapshot),
  });

  assert.deepEqual(calls, ['stage', 'accept']);
  assert.equal(result.ok, true);
  assert.equal(state.document.name, 'Imported');
});

test('restores canonical and undo state and clears staging when persistence throws after mutation', () => {
  const commitResumeImport = requireExport('commitResumeImport');
  const current = resume({ name: 'Before import' });
  const priorUndo = resume({ id: 'prior', name: 'Prior undo' });
  const changes: ResumeChange[] = [{ id: 'change-1', section: 'summary', field: 'summary', before: '', after: 'X', accepted: false }];
  const state = {
    document: current,
    undoStack: [priorUndo],
    changeUndoStack: [[...changes]],
    stagedImport: null as ResumeDocumentV1 | null,
    changes,
    backup: resume({ id: 'backup', name: 'Backup' }) as ResumeDocumentV1 | null,
  };
  const before = structuredClone(state);

  const result = commitResumeImport('replace', current, resume({ name: 'Leaked import' }), {
    getState: () => state,
    stageImport: candidate => { state.stagedImport = candidate; },
    acceptStagedImport: () => {
      state.undoStack.push(state.document);
      state.changeUndoStack.push([]);
      state.changes = [];
      state.backup = null;
      state.document = state.stagedImport!;
      throw new Error('localStorage quota exceeded');
    },
    restoreState: snapshot => {
      Object.assign(state, snapshot);
      throw new Error('restoration persistence also failed');
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(state.document, before.document);
  assert.deepEqual(state.undoStack, before.undoStack);
  assert.deepEqual(state.changeUndoStack, before.changeUndoStack);
  assert.deepEqual(state.changes, before.changes);
  assert.deepEqual(state.backup, before.backup);
  assert.equal(state.stagedImport, null);
});

test('dialog reset clears preview, error, and busy state', () => {
  const reduceImportDialogState = requireExport('reduceImportDialogState');
  const initialImportDialogState = ui.initialImportDialogState;
  assert.ok(initialImportDialogState, 'missing production state: initialImportDialogState');

  const dirty = {
    ...initialImportDialogState,
    preview: { extracted: { fileName: 'resume.txt', kind: 'txt' as const, text: 'text' }, document: resume() },
    error: 'failure',
    busy: true,
  };
  assert.deepEqual(reduceImportDialogState(dirty, { type: 'reset' }), initialImportDialogState);
});

test('keeps Tab and Shift+Tab inside the dialog when no enabled child can receive focus', () => {
  const trapDialogTabKey = requireExport('trapDialogTabKey');
  const focused: string[] = [];
  const hiddenInput = {
    hidden: true,
    disabled: false,
    tabIndex: 0,
    getAttribute: () => null,
    getClientRects: () => [{ width: 1 }],
    focus: () => focused.push('hidden-input'),
  };
  const disabledButton = {
    hidden: false,
    disabled: true,
    tabIndex: 0,
    getAttribute: () => null,
    getClientRects: () => [{ width: 1 }],
    focus: () => focused.push('disabled-button'),
  };
  const nonRenderedControl = {
    hidden: false,
    disabled: false,
    tabIndex: 0,
    getAttribute: () => null,
    getClientRects: () => [],
    focus: () => focused.push('non-rendered'),
  };
  const negativeTabIndexControl = {
    hidden: false,
    disabled: false,
    tabIndex: -1,
    getAttribute: () => '-1',
    getClientRects: () => [{ width: 1 }],
    focus: () => focused.push('negative-tabindex'),
  };
  const ariaHiddenControl = {
    hidden: false,
    disabled: false,
    tabIndex: 0,
    getAttribute: (name: string) => name === 'aria-hidden' ? 'true' : null,
    getClientRects: () => [{ width: 1 }],
    focus: () => focused.push('aria-hidden'),
  };
  const dialog = {
    querySelectorAll: () => [hiddenInput, disabledButton, nonRenderedControl, negativeTabIndexControl, ariaHiddenControl],
    contains: () => false,
    focus: () => focused.push('dialog'),
  };

  for (const shiftKey of [false, true]) {
    let prevented = false;
    const event = {
      key: 'Tab',
      shiftKey,
      preventDefault: () => { prevented = true; },
    };
    const contained = trapDialogTabKey(event as KeyboardEvent, dialog as unknown as HTMLElement);
    assert.equal(contained, true);
    assert.equal(prevented, true);
  }
  assert.deepEqual(focused, ['dialog', 'dialog']);
});

test('wraps from the dialog fallback after eligible controls re-enable', () => {
  const trapDialogTabKey = requireExport('trapDialogTabKey');

  for (const shiftKey of [false, true]) {
    const focused: string[] = [];
    const ownerDocument: { activeElement: unknown } = { activeElement: null };
    const firstControl = {
      hidden: false,
      disabled: true,
      tabIndex: 0,
      getAttribute: () => null,
      getClientRects: () => [{ width: 1 }],
      focus: () => { focused.push('first'); ownerDocument.activeElement = firstControl; },
    };
    const lastControl = {
      hidden: false,
      disabled: true,
      tabIndex: 0,
      getAttribute: () => null,
      getClientRects: () => [{ width: 1 }],
      focus: () => { focused.push('last'); ownerDocument.activeElement = lastControl; },
    };
    const dialog = {
      ownerDocument,
      querySelectorAll: () => [firstControl, lastControl],
      contains: (element: unknown) => element === dialog || element === firstControl || element === lastControl,
      focus: () => { focused.push('dialog'); ownerDocument.activeElement = dialog; },
    };

    let preventedWhileDisabled = false;
    assert.equal(trapDialogTabKey({
      key: 'Tab',
      shiftKey: false,
      preventDefault: () => { preventedWhileDisabled = true; },
    } as KeyboardEvent, dialog as unknown as HTMLElement), true);
    assert.equal(preventedWhileDisabled, true);
    assert.equal(ownerDocument.activeElement, dialog);

    firstControl.disabled = false;
    lastControl.disabled = false;
    let preventedAfterEnable = false;
    assert.equal(trapDialogTabKey({
      key: 'Tab',
      shiftKey,
      preventDefault: () => { preventedAfterEnable = true; },
    } as KeyboardEvent, dialog as unknown as HTMLElement), true);
    assert.equal(preventedAfterEnable, true);
    assert.deepEqual(focused, ['dialog', shiftKey ? 'last' : 'first']);
  }
});

test('preserves outside, boundary, and interior dialog focus handling', () => {
  const trapDialogTabKey = requireExport('trapDialogTabKey');
  const focused: string[] = [];
  const ownerDocument: { activeElement: unknown } = { activeElement: null };
  const control = (name: string) => ({
    hidden: false,
    disabled: false,
    tabIndex: 0,
    getAttribute: () => null,
    getClientRects: () => [{ width: 1 }],
    focus() { focused.push(name); ownerDocument.activeElement = this; },
  });
  const first = control('first');
  const middle = control('middle');
  const last = control('last');
  const outside = {};
  const dialog = {
    ownerDocument,
    querySelectorAll: () => [first, middle, last],
    contains: (element: unknown) => element === dialog || element === first || element === middle || element === last,
    focus: () => { focused.push('dialog'); ownerDocument.activeElement = dialog; },
  };
  const cases = [
    { active: outside, shiftKey: false, trapped: true, target: 'first' },
    { active: outside, shiftKey: true, trapped: true, target: 'last' },
    { active: first, shiftKey: true, trapped: true, target: 'last' },
    { active: last, shiftKey: false, trapped: true, target: 'first' },
    { active: first, shiftKey: false, trapped: false, target: null },
    { active: middle, shiftKey: false, trapped: false, target: null },
    { active: middle, shiftKey: true, trapped: false, target: null },
    { active: last, shiftKey: true, trapped: false, target: null },
  ];

  for (const scenario of cases) {
    focused.length = 0;
    ownerDocument.activeElement = scenario.active;
    let prevented = false;
    const trapped = trapDialogTabKey({
      key: 'Tab',
      shiftKey: scenario.shiftKey,
      preventDefault: () => { prevented = true; },
    } as KeyboardEvent, dialog as unknown as HTMLElement);
    assert.equal(trapped, scenario.trapped);
    assert.equal(prevented, scenario.trapped);
    assert.deepEqual(focused, scenario.target ? [scenario.target] : []);
  }
});

test('save controller makes unsaved, saving, and saved observable in order', () => {
  const createSaveStatusController = requireExport('createSaveStatusController');
  const statuses: string[] = [];
  const pending = new Map<number, () => void>();
  let nextId = 1;
  const scheduler = {
    setTimeout(callback: () => void) { const id = nextId++; pending.set(id, callback); return id; },
    clearTimeout(id: unknown) { pending.delete(id as number); },
  };
  const runNext = () => {
    const entry = pending.entries().next().value as [number, () => void] | undefined;
    assert.ok(entry, 'expected a scheduled save-status transition');
    pending.delete(entry[0]);
    entry[1]();
  };
  const controller = createSaveStatusController(status => statuses.push(status), scheduler);

  controller.commit(() => undefined);
  assert.deepEqual(statuses, ['unsaved']);
  runNext();
  assert.deepEqual(statuses, ['unsaved', 'saving']);
  runNext();
  assert.deepEqual(statuses, ['unsaved', 'saving', 'saved']);
});

test('save controller cancels stale transitions, reports errors, and disposes timers', () => {
  const createSaveStatusController = requireExport('createSaveStatusController');
  const statuses: string[] = [];
  const pending = new Map<number, () => void>();
  let nextId = 1;
  const scheduler = {
    setTimeout(callback: () => void) { const id = nextId++; pending.set(id, callback); return id; },
    clearTimeout(id: unknown) { pending.delete(id as number); },
  };
  const runAll = () => {
    while (pending.size) {
      const [id, callback] = pending.entries().next().value!;
      pending.delete(id);
      callback();
    }
  };
  const controller = createSaveStatusController(status => statuses.push(status), scheduler);

  controller.commit(() => undefined);
  controller.commit(() => { throw new Error('write failed'); });
  runAll();
  assert.deepEqual(statuses, ['unsaved', 'unsaved', 'saving', 'error']);

  controller.commit(() => undefined);
  controller.dispose();
  runAll();
  assert.deepEqual(statuses.at(-1), 'unsaved');
});

test('preview omits empty repeatable rows and keeps partially populated rows', () => {
  const document = resume({
    experience: [{ id: 'blank-experience', company: ' ', role: '', startDate: '', endDate: '', description: '' }],
    projects: [{ id: 'partial-project', name: 'Project Atlas', role: '', startDate: '', endDate: '', description: '' }],
    education: [{ id: 'blank-education', school: '', major: '', degree: '', startDate: '', endDate: '' }],
  });
  const markup = renderToStaticMarkup(createElement(ResumePreview, { document }));

  assert.doesNotMatch(markup, /工作经历/);
  assert.doesNotMatch(markup, /教育经历/);
  assert.match(markup, /项目经历/);
  assert.match(markup, /Project Atlas/);
});

test('counts populated nested fields consistently instead of counting each row as one', () => {
  const countPopulatedResumeFields = requireExport('countPopulatedResumeFields');
  const document = resume({
    profile: { id: 'profile-1', fullName: 'Name', phone: '', email: '', location: '', title: '' },
    target: 'Target',
    experience: [{ id: 'experience-1', company: 'Acme', role: '', startDate: '', endDate: '', description: 'Built systems' }],
    projects: [{ id: 'project-1', name: 'Atlas', role: '', startDate: '', endDate: '', description: '' }],
    education: [{ id: 'education-1', school: ' ', major: '', degree: '', startDate: '', endDate: '' }],
    skills: ['', 'TypeScript'],
    certificates: ['Certificate'],
  });
  assert.equal(countPopulatedResumeFields(document), 7);
});
