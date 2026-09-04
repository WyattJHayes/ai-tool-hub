import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const scannerUrl = new URL('./consistency-scan.mjs', import.meta.url);

async function loadScanner() {
  assert.equal(existsSync(scannerUrl), true, 'missing consistency scanner');
  return import(scannerUrl.href);
}

test('fixes a stale tool count and keeps the correct one untouched', async () => {
  const { applyNumberContract } = await loadScanner();
  const input = '平台收录 83 个工具数据，共 84 个工具全部可用。';
  const { text, fixed } = applyNumberContract(input, {
    realTools: 84,
    authorityScenes: 8,
    file: 'README.md',
  });
  assert.equal(text, '平台收录 84 个工具数据，共 84 个工具全部可用。');
  assert.equal(fixed.length, 1);
  assert.match(fixed[0], /README\.md/);
});

test('does not touch range-like or per-page numbers (semantic guard)', async () => {
  const { applyNumberContract } = await loadScanner();
  // "2-4 款工具" 是区间（右端），"显示前 9 个" 是分页语义——都不能被当成总量更正
  const input = '对比 84 个工具中的 2-4 款工具；列表一页显示前 20 个工具。3 个场景特别适合新手。';
  const { text, fixed } = applyNumberContract(input, {
    realTools: 84,
    authorityScenes: 8,
    file: 'README.md',
  });
  assert.equal(text, input, '语义数字不应被改写');
  assert.equal(fixed.length, 0);
});

test('fixes a stale scene count in a total-statement context', async () => {
  const { applyNumberContract } = await loadScanner();
  // 场景总量句带语境后缀（入口/数据/括号），会被修正
  const withCtx = applyNumberContract('共覆盖 6 个场景入口', {
    realTools: 84,
    authorityScenes: 8,
    file: 'FIGMA_V4_DESIGN_SPEC.md',
  });
  assert.equal(withCtx.text, '共覆盖 8 个场景入口');
  assert.equal(withCtx.fixed.length, 1);
  assert.match(withCtx.fixed[0], /场景数偏差/);
  // 裸句（无语境后缀）如"共 N 个场景"不触碰：语义歧义，宁可不改
  const bare = applyNumberContract('共覆盖 6 个场景', {
    realTools: 84,
    authorityScenes: 8,
    file: 'FIGMA_V4_DESIGN_SPEC.md',
  });
  assert.equal(bare.text, '共覆盖 6 个场景');
  assert.equal(bare.fixed.length, 0);
});

test('fixes a stale table count only when realTables is supplied', async () => {
  const { applyNumberContract } = await loadScanner();
  // 传 realTables 时纠正
  const fixed_ = applyNumberContract('数据库中有 9 表', {
    realTools: 84,
    authorityScenes: 8,
    realTables: 8,
    file: 'README.md',
  });
  assert.equal(fixed_.text, '数据库中有 8 表');
  assert.equal(fixed_.fixed.length, 1);
  // 不传 realTables（如 migrations 缺失）则不触碰表声明
  const skip = applyNumberContract('数据库中有 9 表', {
    realTools: 84,
    authorityScenes: 8,
    file: 'README.md',
  });
  assert.equal(skip.text, '数据库中有 9 表');
  assert.equal(skip.fixed.length, 0);
});

test('keeps a table count that already matches authoritative value', async () => {
  const { applyNumberContract } = await loadScanner();
  const { text, fixed } = applyNumberContract('共 8 张表，涵盖用户与工具', {
    realTools: 84,
    authorityScenes: 8,
    realTables: 8,
    file: 'README.md',
  });
  assert.equal(text, '共 8 张表，涵盖用户与工具');
  assert.equal(fixed.length, 0);
});

test('scanner import must not execute the CLI main flow', async () => {
  // import 后不应直接退出进程（invokedAsScript 守卫），否则测试进程会先行结束
  const mod = await import(scannerUrl.href);
  assert.equal(typeof mod.applyNumberContract, 'function');
});

test('CI workflow still runs the scanner in auto-fix mode and reports vulnerabilities', async () => {
  const workflow = readFileSync(new URL('../.github/workflows/consistency.yml', import.meta.url), 'utf8');
  assert.match(workflow, /node scripts\/consistency-scan\.mjs --fix/);
  assert.match(workflow, /node scripts\/consistency-scan\.mjs > scan-report\.txt/);
  // 依赖漏洞要能在无文档差异时自动创建 issue（闭环，防静默红色）
  assert.match(workflow, /gh issue create/);
  assert.match(workflow, /依赖漏洞\|无法运行/);
});