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
  'src/components/resume/AIPanel.tsx',
  'src/components/resume/QuotaDrawer.tsx',
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
  const ui = read('src/features/resume/ui.ts');

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
  assert.match(ui, /commitResumeImport/);
  assert.match(dialog, /resetAndClose/);
  assert.match(dialog, /event\.key === 'Escape'[\s\S]{0,160}resetAndClose/);
  assert.match(dialog, /event\.key === 'Tab'/);
  assert.match(dialog, /dialogRef/);
  assert.match(dialog, /openerRef/);
  assert.match(dialog, /\.focus\(\)/);
  assert.match(dialog, /createResumeImportConfirmation/);
  assert.match(dialog, /trapDialogTabKey/);
  assert.match(dialog, /tabIndex=\{-1\}/);
  assert.match(ui, /:not\(\[hidden\]\)/);
  assert.match(ui, /getClientRects\(\)/);
});

test('exposes a post-import undo action wired to the canonical store', () => {
  const workspace = read('src/components/resume/ResumeWorkspace.tsx');

  assert.match(workspace, /useResumeStore\(state => state\.undo\)/);
  assert.match(workspace, /handleUndo/);
  assert.match(workspace, /handleUndo[\s\S]{0,260}\bundo\(\)/);
  assert.match(workspace, /onClick=\{handleUndo\}/);
  assert.match(workspace, /撤销导入/);
});

test('uses a viewport flex shell and suppresses the global footer on desktop resume routes', () => {
  const css = read('src/app/globals.css');

  assert.match(css, /body:has\(\.resume-page\)\s*>\s*footer[\s\S]{0,100}display:\s*none/);
  assert.match(css, /\.resume-page\s*\{[\s\S]{0,220}height:\s*calc\(100dvh - var\(--nav-height\)\)/);
  assert.match(css, /\.resume-page\s*\{[\s\S]{0,220}display:\s*flex/);
  assert.match(css, /\.resume-toolbar\s*\{[\s\S]{0,100}top:\s*0/);
  assert.match(css, /\.resume-workspace\s*\{[\s\S]{0,220}flex:\s*1 1 0/);
  assert.match(css, /\.resume-workspace\s*\{[\s\S]{0,220}min-height:\s*0/);
  assert.doesNotMatch(css.match(/\.resume-workspace\s*\{[\s\S]*?\}/)?.[0] ?? '', /min-height:\s*620px/);
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

test('extends Supabase login with one-shot continuation and non-enumerating password recovery', () => {
  const auth = read('src/components/auth/AuthModal.tsx');

  assert.match(auth, /onAuthenticated\?:\s*\(\)\s*=>\s*void/);
  assert.match(auth, /contextLabel\?:\s*string/);
  assert.match(auth, /resetPasswordForEmail\(email\.trim\(\),\s*\{\s*redirectTo\s*\}\)/);
  assert.match(auth, /设置或找回密码/);
  assert.match(auth, /如果账号存在，重置邮件已发送/);
  assert.match(auth, /onAuthenticated\?\.\(\)[\s\S]{0,200}(?:onClose\(\)|onCloseRef\.current\(\))/);
});

test('contains focus in Task 9 dialogs and restores the invoking control', () => {
  for (const path of [
    'src/components/auth/AuthModal.tsx',
    'src/components/resume/QuotaDrawer.tsx',
  ]) {
    const dialog = read(path);
    assert.match(dialog, /trapDialogTabKey/);
    assert.match(dialog, /event\.key === 'Tab'/);
    assert.match(dialog, /openerRef/);
    assert.match(dialog, /\.focus\(\)/);
    assert.match(dialog, /tabIndex=\{-1\}/);
  }
});

test('ships the complete AI validation, stream, and canonical diff review workflow', () => {
  const panel = read('src/components/resume/AIPanel.tsx');

  for (const state of ['idle', 'validating', 'reserving', 'streaming', 'review', 'error']) {
    assert.match(panel, new RegExp(`'${state}'`));
  }
  for (const label of ['轻度优化', '中度优化', '深度优化']) assert.match(panel, new RegExp(label));
  assert.match(panel, /每次 1 次额度/);
  assert.match(panel, /disabled=\{[^}]*!hasJobDescription/);
  assert.match(panel, /aria-live=['"]polite['"]/);
  assert.match(panel, /computeResumeChanges/);
  assert.match(panel, /setChanges/);
  assert.match(panel, /acceptChange/);
  assert.match(panel, /acceptAllChanges/);
  assert.match(panel, /rejectChange/);
  assert.match(panel, /接受/);
  assert.match(panel, /拒绝/);
  assert.match(panel, /AbortController/);
  assert.match(panel, /documentRef\.current/);
  assert.match(panel, /actionsDisabled\s*=\s*busy\s*\|\|\s*state\s*===\s*'review'/);
  assert.match(panel, /disabled=\{actionsDisabled/);
});

test('keeps payment fail-closed while exposing injected same-order lifecycle states', () => {
  const drawer = read('src/components/resume/QuotaDrawer.tsx');
  const api = read('src/features/resume/api.ts');

  assert.match(drawer, /ResumePaymentClient/);
  assert.match(drawer, /paymentClient\?:/);
  assert.match(drawer, /paymentClient\s*=\s*null/);
  assert.match(drawer, /xddpay\.enabled\s*===\s*true/);
  assert.match(drawer, /确认购买/);
  assert.match(drawer, /基础会员/);
  assert.match(drawer, /10 次/);
  assert.match(drawer, /CNY 9\.90/);
  assert.match(drawer, /永久 VIP/);
  assert.match(drawer, /不限次/);
  assert.match(drawer, /CNY 99\.00/);
  for (const status of ['pending', 'fulfilled', 'expired', 'review']) {
    assert.match(drawer, new RegExp(status));
  }
  assert.match(drawer, /手动查询/);
  assert.match(drawer, /createResumePaymentController/);
  assert.match(drawer, /setAvailability\(DISABLED_AVAILABILITY\)/);
  assert.match(drawer, /setSelectedPlan\(null\)/);
  assert.match(api, /getPlansAvailability/);
  assert.match(api, /enabled:\s*xddpay\?\.enabled\s*===\s*true/);
});

test('wires auth-safe AI and quota controls into the canonical workspace', () => {
  const workspace = read('src/components/resume/ResumeWorkspace.tsx');
  const toolbar = read('src/components/resume/ResumeToolbar.tsx');

  assert.match(workspace, /createPendingResumeActionController/);
  assert.match(workspace, /<AIPanel/);
  assert.match(workspace, /<QuotaDrawer/);
  assert.match(workspace, /<AuthModal/);
  assert.match(workspace, /onAuthenticated=/);
  assert.match(workspace, /pendingActionController\.resume/);
  assert.doesNotMatch(workspace, /localStorage[\s\S]{0,200}pending/i);
  assert.match(toolbar, /onQuota/);
  assert.match(toolbar, /onAccount/);
});
