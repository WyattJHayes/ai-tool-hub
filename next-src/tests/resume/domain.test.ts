import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createEmptyResume, normalizeResumeDocument, ResumeSchemaError } from '../../src/features/resume/schema';
import { createResumeStorage, RESUME_STORAGE_KEY, useResumeStore } from '../../src/features/resume/store';
import type { ResumeChange, ResumeDocumentV1, ResumeExperience } from '../../src/features/resume/types';

function resetStore() {
  useResumeStore.setState(useResumeStore.getInitialState(), true);
}

function documentWithExperience(experience: ResumeExperience[]): ResumeDocumentV1 {
  return {
    ...createEmptyResume(() => 'document-id'),
    name: 'Original resume',
    experience,
  };
}

function experience(id: string, company: string): ResumeExperience {
  return { id, company, role: 'Engineer', startDate: '', endDate: '', description: '' };
}

test('creates a versioned empty resume with stable repeatable arrays', () => {
  const value = createEmptyResume(() => 'fixed-id');
  assert.equal(value.schemaVersion, 1);
  assert.equal(value.templateId, 'precision');
  assert.deepEqual(value.experience, []);
  assert.equal(value.profile.id, 'fixed-id');
});

test('normalizes unknown local data without accepting executable or prototype fields', () => {
  const value = normalizeResumeDocument({
    schemaVersion: 1,
    name: '<script>alert(1)</script>',
    __proto__: { polluted: true },
    profile: { id: 'p1', fullName: 'Wei' },
    experience: [{ id: 'same', company: 'A' }, { id: 'same', company: 'B' }],
  });
  assert.equal(value.name, '<script>alert(1)</script>');
  assert.equal(value.experience.length, 2);
  assert.notEqual(value.experience[0].id, value.experience[1].id);
  assert.equal((value as unknown as Record<string, unknown>).polluted, undefined);
});

test('rejects resume documents from future schema versions', () => {
  assert.throws(
    () => normalizeResumeDocument({ schemaVersion: 2 }),
    ResumeSchemaError,
  );
});

test('reorders repeatable items without changing their values', () => {
  resetStore();
  useResumeStore.getState().saveState(documentWithExperience([experience('first', 'A'), experience('second', 'B')]));

  useResumeStore.getState().reorderItems('experience', 0, 1);

  assert.deepEqual(useResumeStore.getState().document.experience.map(item => item.company), ['B', 'A']);
});

test('duplicates a repeatable item with a new identifier', () => {
  resetStore();
  useResumeStore.getState().saveState(documentWithExperience([experience('first', 'A')]));

  useResumeStore.getState().duplicateItem('experience', 'first');

  const items = useResumeStore.getState().document.experience;
  assert.equal(items.length, 2);
  assert.equal(items[1].company, 'A');
  assert.notEqual(items[0].id, items[1].id);
});

test('deletes a repeatable item by identifier', () => {
  resetStore();
  useResumeStore.getState().saveState(documentWithExperience([experience('first', 'A'), experience('second', 'B')]));

  useResumeStore.getState().deleteItem('experience', 'first');

  assert.deepEqual(useResumeStore.getState().document.experience.map(item => item.id), ['second']);
});

test('caps immutable undo snapshots at twenty entries', () => {
  resetStore();
  for (let index = 0; index < 21; index += 1) {
    const next = { ...useResumeStore.getState().document, name: `Version ${index}` };
    useResumeStore.getState().saveState(next);
  }

  const state = useResumeStore.getState();
  assert.equal(state.undoStack.length, 20);
  assert.notEqual(state.undoStack[0], state.document);
  assert.equal(state.undoStack[0].name, 'Version 0');
});

test('stages an import without replacing the current document', () => {
  resetStore();
  useResumeStore.getState().saveState({ ...useResumeStore.getState().document, name: 'Current' });

  useResumeStore.getState().stageImport({ schemaVersion: 1, name: 'Imported' });

  assert.equal(useResumeStore.getState().document.name, 'Current');
  assert.equal(useResumeStore.getState().stagedImport?.name, 'Imported');
});

test('accepts one pending change and marks it accepted', () => {
  resetStore();
  const change: ResumeChange = {
    id: 'summary-change', section: 'summary', field: 'summary', before: '', after: 'Sharper summary', accepted: false,
  };
  useResumeStore.getState().setChanges([change]);

  useResumeStore.getState().acceptChange('summary-change');

  assert.equal(useResumeStore.getState().document.summary, 'Sharper summary');
  assert.equal(useResumeStore.getState().changes[0].accepted, true);
});

test('normalizes an oversized single accepted change before persistence', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    { id: 'oversized', section: 'summary', field: 'summary', before: '', after: 'x'.repeat(10_001), accepted: false },
  ]);

  useResumeStore.getState().acceptChange('oversized');

  assert.equal(useResumeStore.getState().document.summary.length, 10_000);
  assert.equal(useResumeStore.persist.getOptions().partialize?.(useResumeStore.getState()).document.summary.length, 10_000);
});

test('normalizes invalid runtime diff values when accepting all changes', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    {
      id: 'invalid-runtime-value',
      section: 'profile',
      field: 'fullName',
      before: '',
      after: { value: 'not text' },
      accepted: false,
    } as unknown as ResumeChange,
  ]);

  useResumeStore.getState().acceptAllChanges();

  assert.equal(useResumeStore.getState().document.profile.fullName, '');
  assert.equal(typeof useResumeStore.persist.getOptions().partialize?.(useResumeStore.getState()).document.profile.fullName, 'string');
});

test('undo restores a change to pending after accepting it', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    { id: 'undo-change', section: 'summary', field: 'summary', before: '', after: 'Reversible', accepted: false },
  ]);

  useResumeStore.getState().acceptChange('undo-change');
  useResumeStore.getState().undo();

  assert.equal(useResumeStore.getState().document.summary, '');
  assert.equal(useResumeStore.getState().changes[0].accepted, false);
});

test('accepts all pending changes in one action', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    { id: 'name', section: 'profile', itemId: useResumeStore.getState().document.profile.id, field: 'fullName', before: '', after: 'Wei Jiahao', accepted: false },
    { id: 'target', section: 'target', field: 'target', before: '', after: 'Product engineer', accepted: false },
  ]);

  useResumeStore.getState().acceptAllChanges();

  assert.equal(useResumeStore.getState().document.profile.fullName, 'Wei Jiahao');
  assert.equal(useResumeStore.getState().document.target, 'Product engineer');
  assert.ok(useResumeStore.getState().changes.every(change => change.accepted));
});

test('accepts normalized whole-section changes for AI-generated rows, skills, and certificates', () => {
  resetStore();
  const nextExperience = [experience('ai-experience', 'AI candidate')];
  useResumeStore.getState().setChanges([
    { id: 'experience-items', section: 'experience', field: 'items', before: '[]', after: JSON.stringify(nextExperience), accepted: false },
    { id: 'skill-items', section: 'skills', field: 'items', before: '[]', after: JSON.stringify(['TypeScript', 'React']), accepted: false },
    { id: 'certificate-items', section: 'certificates', field: 'items', before: '[]', after: JSON.stringify(['AWS Associate']), accepted: false },
  ]);

  useResumeStore.getState().acceptAllChanges();

  const state = useResumeStore.getState();
  assert.deepEqual(state.document.experience, nextExperience);
  assert.deepEqual(state.document.skills, ['TypeScript', 'React']);
  assert.deepEqual(state.document.certificates, ['AWS Associate']);
  assert.ok(state.changes.every(change => change.accepted));
});

test('rejects a pending change without mutating the document', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    { id: 'reject-me', section: 'summary', field: 'summary', before: '', after: 'Do not apply', accepted: false },
  ]);

  useResumeStore.getState().rejectChange('reject-me');

  assert.equal(useResumeStore.getState().document.summary, '');
  assert.deepEqual(useResumeStore.getState().changes, []);
});

test('keeps stale item changes pending when their target no longer exists', () => {
  resetStore();
  useResumeStore.getState().setChanges([
    { id: 'stale', section: 'experience', itemId: 'missing', field: 'company', before: '', after: 'No target', accepted: false },
  ]);

  useResumeStore.getState().acceptChange('stale');
  useResumeStore.getState().acceptAllChanges();

  assert.equal(useResumeStore.getState().changes[0].accepted, false);
  assert.equal(useResumeStore.getState().document.experience.length, 0);
});

test('resets the document while preserving an exportable backup', () => {
  resetStore();
  useResumeStore.getState().saveState({ ...useResumeStore.getState().document, name: 'Keep me' });

  useResumeStore.getState().resetDocument();

  assert.equal(useResumeStore.getState().document.name, 'Untitled resume');
  assert.equal(useResumeStore.getState().backup?.name, 'Keep me');
  assert.equal(JSON.parse(useResumeStore.getState().exportBackup() ?? '{}').name, 'Keep me');
});

test('persists only the document under the versioned storage key', () => {
  const partialize = useResumeStore.persist.getOptions().partialize;

  assert.equal(RESUME_STORAGE_KEY, 'weihub-resume-v1');
  assert.deepEqual(Object.keys(partialize?.(useResumeStore.getState()) ?? {}), ['document']);
});

test('drops malformed persisted resume state and clears its storage entry', async () => {
  let cleared = false;
  const storage = createResumeStorage({
    getItem: () => '{not-json',
    setItem: () => undefined,
    removeItem: () => { cleared = true; },
  });

  assert.equal(await storage.getItem(RESUME_STORAGE_KEY), null);
  assert.equal(cleared, true);
});

test('resolves the direct jsPDF dependency at or above the safe version', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const lockfile = JSON.parse(readFileSync(new URL('../../package-lock.json', import.meta.url), 'utf8')) as {
    packages: Record<string, { dependencies?: Record<string, string>; version?: string }>;
  };
  const resolvedVersion = lockfile.packages['node_modules/jspdf']?.version;

  assert.equal(packageJson.dependencies.jspdf, '4.2.1');
  assert.equal(lockfile.packages['']?.dependencies?.jspdf, '4.2.1');
  assert.ok(resolvedVersion && isAtLeastVersion(resolvedVersion, '4.2.1'));
});

function isAtLeastVersion(version: string, minimum: string): boolean {
  const current = version.split('.').map(Number);
  const required = minimum.split('.').map(Number);
  for (let index = 0; index < required.length; index += 1) {
    if (current[index] > required[index]) return true;
    if (current[index] < required[index]) return false;
  }
  return true;
}
