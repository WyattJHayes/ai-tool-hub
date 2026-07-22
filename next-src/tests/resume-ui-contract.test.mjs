import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const resumeFiles = [
  'src/app/resume/page.tsx',
  'src/components/resume/ResumeWorkspace.tsx',
  'src/components/resume/ResumeToolbar.tsx',
  'src/components/resume/ResumeEditor.tsx',
  'src/components/resume/ResumePreview.tsx',
  'src/components/resume/ImportDialog.tsx',
];

test('ships the native resume page as focused components', () => {
  for (const path of resumeFiles) {
    assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), true, `missing ${path}`);
  }

  const page = read('src/app/resume/page.tsx');
  assert.match(page, /title:\s*['"]AI 简历优化 - AI Tool Hub['"]/);
  assert.match(page, /description:/);
  assert.match(page, /canonical:\s*['"]\/resume\/['"]/);
  assert.equal((page.match(/<ResumeWorkspace\s*\/>/g) ?? []).length, 1);
});

test('keeps the document in the canonical local store and exposes desktop and mobile workspaces', () => {
  const workspace = read('src/components/resume/ResumeWorkspace.tsx');
  const css = read('src/app/globals.css');

  assert.match(workspace, /useResumeStore/);
  assert.match(workspace, /aria-pressed=\{view === 'edit'\}/);
  assert.match(workspace, /aria-pressed=\{view === 'preview'\}/);
  assert.match(workspace, /<ResumeEditor/);
  assert.match(workspace, /<ResumePreview/);
  assert.match(css, /minmax\(320px,\s*0\.9fr\)\s+minmax\(540px,\s*1\.1fr\)/);
  assert.match(css, /--mobile-nav-block-size/);
  assert.match(css, /body:has\(\.resume-page\)[\s\S]*min-width:\s*0/);
});

test('provides every editor module and stable repeatable-row actions', () => {
  const editor = read('src/components/resume/ResumeEditor.tsx');

  for (const label of ['个人信息', '求职目标', '个人总结', '工作经历', '项目经历', '教育经历', '技能', '证书与补充']) {
    assert.match(editor, new RegExp(label));
  }
  for (const action of ['上移', '下移', '复制', '删除', '新增']) {
    assert.match(editor, new RegExp(action));
  }
  assert.match(editor, /saveState/);
  assert.match(editor, /reorderItems/);
  assert.match(editor, /duplicateItem/);
  assert.match(editor, /deleteItem/);
});

test('uses semantic React preview pages with fixed A4 geometry', () => {
  const preview = read('src/components/resume/ResumePreview.tsx');
  const css = read('src/app/globals.css');

  assert.match(preview, /data-resume-page/);
  assert.doesNotMatch(preview, /dangerouslySetInnerHTML/);
  assert.match(css, /aspect-ratio:\s*210\s*\/\s*297/);
  assert.match(css, /width:\s*210mm/);
  assert.match(css, /min-height:\s*297mm/);
});

test('requires a local import preview before merge or replacement', () => {
  const dialog = read('src/components/resume/ImportDialog.tsx');

  assert.match(dialog, /extractResumeFile/);
  assert.match(dialog, /parseResumeTextLocally/);
  assert.match(dialog, /type="file"[\s\S]{0,240}\shidden/);
  assert.match(dialog, /stageImport/);
  assert.match(dialog, /acceptStagedImport/);
  assert.match(dialog, /合并/);
  assert.match(dialog, /替换/);
  assert.match(dialog, /人工核对/);
  assert.match(dialog, /role=['"]dialog['"]/);
  assert.match(dialog, /role=['"]alert['"]/);
});

test('exposes guarded PDF export, toolbar save states, and accessible icon controls', () => {
  const workspace = read('src/components/resume/ResumeWorkspace.tsx');
  const toolbar = read('src/components/resume/ResumeToolbar.tsx');
  const css = read('src/app/globals.css');

  assert.match(workspace, /exportResumePdf/);
  assert.match(workspace, /overflow-x/);
  assert.match(workspace, /overflow-y/);
  assert.match(workspace, /empty-page/);
  for (const state of ['未保存', '保存中', '已保存', '保存失败']) {
    assert.match(toolbar, new RegExp(state));
  }
  assert.match(toolbar, /from ['"]lucide-react['"]/);
  assert.match(toolbar, /aria-label=/);
  assert.match(toolbar, /title=/);
  assert.match(css, /min-(?:width|inline-size):\s*44px/);
  assert.match(css, /min-(?:height|block-size):\s*44px/);
});

test('keeps the precision-console palette semantic and restrained', () => {
  const css = read('src/app/globals.css');
  const resumeCss = css.match(/\/\* resume-workspace:start \*\/[\s\S]*\/\* resume-workspace:end \*\//)?.[0] ?? '';
  const source = resumeFiles.map(read).join('\n') + resumeCss;

  assert.notEqual(resumeCss, '', 'missing scoped resume workspace styles');

  for (const token of ['--page', '--surface', '--surface-subtle', '--line', '--line-strong', '--ink', '--muted', '--accent', '--signal']) {
    assert.match(source, new RegExp(`var\\(${token}\\)`));
  }
  assert.doesNotMatch(source, /(?:bg|text|border)-(?:green|emerald|lime|purple|violet|fuchsia)-/);
  assert.doesNotMatch(source, /(?:linear|radial|conic)-gradient|gradient-|drop-shadow|glow/i);
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}/i);
});
