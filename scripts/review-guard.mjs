import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];

function fail(message) {
  failures.push(message);
}

function stripVoidTags(html) {
  return html.replace(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b[^>]*\/?>/gi, '');
}

function checkHtmlBalance(file) {
  const html = stripVoidTags(read(file));
  const tagRe = /<\/?([a-zA-Z][\w:-]*)(?:\s[^>]*)?>/g;
  const stack = [];
  const lineAt = index => html.slice(0, index).split('\n').length;

  for (const match of html.matchAll(tagRe)) {
    const [raw, tagName] = match;
    const tag = tagName.toLowerCase();
    if (raw.startsWith('</')) {
      const top = stack.pop();
      if (!top || top.tag !== tag) {
        fail(`${file}:${lineAt(match.index)} unexpected </${tag}>; top is ${top ? `<${top.tag}> from line ${top.line}` : 'empty'}`);
        return;
      }
    } else {
      stack.push({ tag, line: lineAt(match.index) });
    }
  }

  if (stack.length > 0) {
    const tail = stack.slice(-6).map(item => `<${item.tag}> line ${item.line}`).join(', ');
    fail(`${file}: unclosed tags: ${tail}`);
  }
}

function checkToolCounts() {
  const tools = JSON.parse(read('tools.json'));
  const preview = read('v4-preview.html');
  const spec = read('FIGMA_V4_DESIGN_SPEC.md');
  const toolCount = Array.isArray(tools) ? tools.length : tools.tools.length;
  const categories = new Set((Array.isArray(tools) ? tools : tools.tools).map(tool => tool.category).filter(Boolean));

  for (const file of ['v4-preview.html', 'FIGMA_V4_DESIGN_SPEC.md']) {
    const content = file === 'v4-preview.html' ? preview : spec;
    if (/(^|[^\d])94(\s*款|\s*工具|\+?\s*工具|\))/.test(content)) {
      fail(`${file}: still contains stale tool count 94; expected ${toolCount}`);
    }
    if (content.includes('12` 分类') || content.includes('12 分类')) {
      fail(`${file}: still contains stale category count 12; expected ${categories.size}`);
    }
  }
}

function checkPortableShotsScript() {
  const content = read('v4-shots.mjs');
  if (content.includes('/Users/weijiahao') || content.includes('file:///Users/')) {
    fail('v4-shots.mjs: contains user-specific absolute path');
  }
}

function checkPythonScripts() {
  for (const file of ['test-weihub.py', 'test-weihub3.py']) {
    const content = read(file);
    if (!content.includes('sys.exit(1)')) {
      fail(`${file}: does not exit non-zero when tests fail`);
    }
    if (content.includes('test("HTTP 200", True') || content.includes('test("分类筛选生效", True')) {
      fail(`${file}: contains unconditional PASS assertion`);
    }
    if (content.includes('page.locator("button").first')) {
      fail(`${file}: uses the first button as the theme toggle`);
    }
  }
}

checkHtmlBalance('v4-preview.html');
checkToolCounts();
checkPortableShotsScript();
checkPythonScripts();

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('review guard passed');
