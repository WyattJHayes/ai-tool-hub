#!/usr/bin/env node
/**
 * L4 自治系统 —— 代码/文档一致性扫描器（垃圾回收 Agent）
 *
 * 职责（三组契约）：
 *  1. 数量契约：README/设计文档中"总量声明"（N 个工具数据 / N 个工具全部 / N 个场景）
 *     vs 权威数据文件（next-src/public/data/tools.json、scenes.json）
 *  2. 环境变量契约：server 代码实际使用的 process.env.* 是否都进 .env.example
 *  3. API 路由契约：README 声称的 /api/* 路径是否真有对应 route 实现
 *
 * 用法：
 *   node scripts/consistency-scan.mjs          # 只扫描（只读，不写文件），发现不一致退出码 1
 *   node scripts/consistency-scan.mjs --fix    # 自动修复确定性偏差（写回文件）
 *
 * 无第三方依赖；风格对齐 scripts/review-guard.mjs。
 * 语义数字（如 "对比 2-4 款"、"显示前 9 个"）刻意不触碰，只匹配明确的"总量/条目数"语境。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = process.argv.includes('--fix');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

/** @type {{ kind: 'report'|'fix', message: string }[]} */
const issues = [];
const report = (message) => issues.push({ kind: 'report', message });
const fixIssue = (message) => issues.push({ kind: 'fix', message });

/** 记录一个可确定性修复项；仅 --fix 模式下应用实际写入。 */
const applyFix = (file, transform) => {
  const original = read(file);
  const updated = transform(original);
  if (updated !== original) {
    if (FIX) write(file, updated);
    return true;
  }
  return false;
};

/* ────────────────────────────────────────────────
 * 工具函数
 * ──────────────────────────────────────────────── */
function countEntries(file) {
  if (!exists(file)) return null;
  try {
    const data = JSON.parse(read(file));
    const list = Array.isArray(data) ? data : data.tools ?? data.scenes;
    return Array.isArray(list) ? list.length : null;
  } catch {
    return null;
  }
}

function listFiles(dir, extRe) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'dist', '__tests__'].includes(entry.name)) continue;
      out.push(...listFiles(rel, extRe));
    } else if (!extRe || extRe.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

/* ────────────────────────────────────────────────
 * 1. 数量契约（仅"总量"语境，排除区间/每页等语义数字）
 * ──────────────────────────────────────────────── */
function checkNumberContracts() {
  const authorityTools = countEntries('next-src/public/data/tools.json');
  const authorityScenes = countEntries('next-src/public/data/scenes.json');
  const fallbackTools = countEntries('tools.json');

  const realTools = authorityTools ?? fallbackTools;
  if (realTools === null || authorityScenes === null) {
    report('权威数据源缺失（next-src/public/data/tools.json 或 scenes.json），跳过数量契约');
    return;
  }

  const docs = ['README.md', 'FIGMA_V4_DESIGN_SPEC.md'];

  // 工具数：仅匹配"总量声明"语境。禁止前面带 `-`（区间右端如 2-4）或别的数字。
  // 允许的粒度：N 个工具数据、N 个工具全部（完整集声明）。
  const toolRe = /(?<![0-9-])(\d+)\s*个工具(数据|全部|$)/g;
  const sceneRe = /(?<![0-9-])(\d+)\s*个场景/g;

  for (const file of docs) {
    if (!exists(file)) continue;
    applyFix(file, (content) => {
      let out = content;
      out = out.replace(toolRe, (m, n, extra) => {
        if (Number(n) === realTools) return m;
        fixIssue(`数量偏差: ${file} 写 "${m}"，权威=${realTools}`);
        return `${realTools} 个工具${extra}`;
      });
      out = out.replace(sceneRe, (m, n) => {
        if (Number(n) === authorityScenes) return m;
        fixIssue(`场景数偏差: ${file} 写 "${m}"，权威=${authorityScenes}`);
        return `${authorityScenes} 个场景`;
      });
      return out;
    });
  }

  // 根目录 tools.json 与权威源条目一致性（不自动修，仅报告）
  const rootTools = countEntries('tools.json');
  if (rootTools !== null && authorityTools !== null && rootTools !== authorityTools) {
    report(`根 tools.json=${rootTools} 与 next-src 权威源=${authorityTools} 不一致`);
  }
}

/* ────────────────────────────────────────────────
 * 2. 环境变量契约（server 实际使用 vs .env.example 声明）
 * ──────────────────────────────────────────────── */
function collectUsedEnvVars() {
  const used = new Set();
  for (const file of listFiles('server/src', /\.(js|cjs|mjs)$/)) {
    const content = read(file);
    for (const m of content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) used.add(m[1]);
  }
  return used;
}

function declaredEnvVars() {
  const declared = new Set();
  for (const file of ['.env.example', 'server/.env.example']) {
    if (!exists(file)) continue;
    for (const m of read(file).matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*=/gm)) declared.add(m[1]);
  }
  return declared;
}

function checkEnvContract(used, declared) {
  const missing = [...used].filter((v) => !declared.has(v)).sort();
  if (missing.length === 0) return;

  const list = missing.join(', ');
  const envFile = exists('.env.example') ? '.env.example' : null;

  if (!envFile) {
    report(`.env.example 缺失；server 实际使用的变量有: ${list}`);
    return;
  }

  const done = applyFix(envFile, (content) => {
    const present = new Set([...content.matchAll(/^\s*([A-Z_][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]));
    const toAdd = missing.filter((v) => !present.has(v));
    if (toAdd.length === 0) return content;
    fixIssue(`.env.example 未声明 server 实际使用的变量: ${list}`);
    const block = `\n# ── 由 consistency 扫描自动补充（server/src 实际引用）──\n${toAdd.map((v) => `${v}=`).join('\n')}\n`;
    return content.replace(/\s*$/, '\n') + block;
  });
  if (!done) fixIssue(`.env.example 未声明 server 实际使用的变量: ${list}`);
}

/* ────────────────────────────────────────────────
 * 3. API 路由契约
 * ──────────────────────────────────────────────── */
function checkApiRoutes() {
  if (!exists('README.md')) return;
  const readme = read('README.md');
  const documented = new Set();
  for (const m of readme.matchAll(/`\/(api\/[a-z0-9_/{}.?=&-]+)`/g)) {
    let route = m[1].replace(/[?&].*$/, '');
    if (/\{|\*/.test(route)) continue; // 动态段无法直接校验，跳过
    documented.add('/' + route.replace(/^\/+|\/+$/g, ''));
  }
  if (documented.size === 0) return;

  // next-src 路由文件：next-src/src/app/api/<route>/route.ts → /api/<route>
  const nextRoutes = new Set();
  for (const f of listFiles('next-src/src/app', /route\.(ts|js|tsx)$/)) {
    const m = f.match(/app[/\\](.*)[/\\]route\.(?:ts|js|tsx)$/);
    if (m) nextRoutes.add('/' + m[1].replaceAll('\\', '/'));
  }
  // server 侧路由：/api/v1/...
  const serverSrc = listFiles('server/src', /\.(js|cjs|mjs)$/)
    .map((f) => read(f))
    .join('\n');
  const serverRoutes = new Set([...serverSrc.matchAll(/(['"])(\/api\/[a-zA-Z0-9/_-]+)\1/g)].map((m) => m[2]));

  const missing = [...documented].filter((r) => !nextRoutes.has(r) && !serverRoutes.has(r));
  missing.sort();
  if (missing.length > 0) {
    report(`README 声称但无实现的 API 路由: ${missing.join(', ')}`);
  } else {
    console.log(`  ✅ API 路由契约: ${[...documented].sort().join(', ')} 全部有实现`);
  }
}

/* ────────────────────────────────────────────────
 * 主流程
 * ──────────────────────────────────────────────── */
checkNumberContracts();
checkEnvContract(collectUsedEnvVars(), declaredEnvVars());
checkApiRoutes();

const fixable = issues.filter((i) => i.kind === 'fix');
const notices = issues.filter((i) => i.kind === 'report');

console.log(`\nL4 一致性扫描完成 — ${fixable.length} 项可修，${notices.length} 项提示\n`);
for (const i of [...fixable, ...notices]) {
  console.log(`  ${i.kind === 'fix' ? '🛠️' : 'ℹ️'} ${i.message}`);
}

if (FIX) {
  console.log(fixable.length > 0 ? '\n已写回自动修复（如适用）。' : '\n无可修项。');
  process.exit(0);
}
if (fixable.length > 0 || notices.length > 0) {
  console.log('\n提示: 加 --fix 自动处理可确定性修复项；其余需人工判断。');
  process.exit(1);
}
console.log('\n全部一致 ✅');
process.exit(0);