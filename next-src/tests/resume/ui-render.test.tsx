import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIPanel, ResumeDiffValue } from '../../src/components/resume/AIPanel';
import { createEmptyResume } from '../../src/features/resume/schema';

function renderPanel() {
  return renderToStaticMarkup(createElement(AIPanel, {
    document: createEmptyResume(() => 'fixed-id'),
    authenticated: true,
    quota: null,
    resumedAction: null,
    jobDescription: '',
    onJobDescriptionChange: () => undefined,
    onRequireAuthentication: () => undefined,
    onResumedActionConsumed: () => undefined,
    onSettled: () => undefined,
    onOpenQuota: () => undefined,
  }));
}

test('all five billed AI commands disclose one-unit cost', () => {
  const markup = renderPanel();
  assert.equal((markup.match(/每次 1 次额度/g) ?? []).length, 5);
});

test('AI diff values expose accessible original and suggestion labels', () => {
  const change = { id: 'summary', section: 'summary' as const, field: 'summary', before: 'Old', after: 'New', accepted: false };
  const markup = renderToStaticMarkup(createElement('div', null,
    createElement(ResumeDiffValue, { change, kind: 'before' }),
    createElement(ResumeDiffValue, { change, kind: 'after' }),
  ));
  assert.match(markup, /原文/);
  assert.match(markup, /建议/);
});
