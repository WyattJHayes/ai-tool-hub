import assert from 'node:assert/strict';
import test from 'node:test';
import { tsImport } from 'tsx/esm/api';

const { normalizeResumeDocument } = await tsImport('../src/features/resume/schema.ts', import.meta.url);

test('retains the persisted v1 resume schema version', () => {
  assert.equal(normalizeResumeDocument({ schemaVersion: 1 }).schemaVersion, 1);
});
