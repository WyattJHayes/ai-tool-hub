import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AIPanel, ResumeDiffValue } from '../../src/components/resume/AIPanel';
import { ResumeStorageAlert } from '../../src/components/resume/ResumeStorageAlert';
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

test('blocking local-storage failures render an accessible recovery surface before editing', () => {
  const markup = renderToStaticMarkup(createElement(ResumeStorageAlert, {
    issue: { code: 'unsupported', blocking: true, recoverable: true },
    busy: false,
    onDownload: () => undefined,
    onRetry: () => undefined,
    onReset: () => undefined,
  }));

  assert.match(markup, /role="alert"/);
  assert.match(markup, /本地简历需要处理/);
  assert.match(markup, /下载原始数据/);
  assert.match(markup, /保留备份并新建/);
  assert.doesNotMatch(markup, /继续编辑/);
});
