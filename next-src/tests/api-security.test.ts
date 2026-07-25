import test from 'node:test';
import assert from 'node:assert/strict';

import { createAnonymousSessionId } from '../src/lib/api';

test('uses getRandomValues when randomUUID is unavailable', () => {
  const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);
  const sessionId = createAnonymousSessionId({
    getRandomValues(array) {
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
      return array;
    },
  });

  assert.equal(sessionId, '00010203-0405-4607-8809-0a0b0c0d0e0f');
});

test('refuses to create an identifier without secure randomness', () => {
  assert.equal(createAnonymousSessionId({}), null);
});
