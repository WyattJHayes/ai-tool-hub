import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';
import { twMerge } from 'tailwind-merge';

const runtimeRequire = createRequire(import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const css = read('src/app/globals.css');
const sourceExtension = /\.(?:css|cjs|cts|js|jsx|mdx|mjs|mts|ts|tsx)$/;
const forbiddenHex = /#(?:f6f7f4|eef1ec|e8ede7|171a17|5f675f|858c85|dce1da|c8cfc6|176b4d|105b40|e4f0e9|b54747|9a6700|171917|202320|292d29|303530|f2f4ef|b2b9b0|858d84|373d36|4a5148|72b897|8cc8aa|203c30|e08080|d8ad58)\b/i;
const rawPaletteClass = /(?<![A-Za-z0-9_-])(?:bg|border|text|fill|stroke|ring|outline|divide|decoration|from|via|to)-(?:red|amber|yellow|green|emerald|teal|cyan|sky|blue|purple|violet)-\d+(?:\/\d+)?(?![A-Za-z0-9_/-])/;
const aliasDefinition = /(?<![A-Za-z0-9_-])--(?:danger|warning)\s*:/;
const aliasUse = /var\(\s*--(?:danger|warning)\s*(?:,|\))/;
const whiteForegroundClass = /(?<![A-Za-z0-9_-])text-white(?:\/\d+)?(?![A-Za-z0-9_/-])/;
const gradientEffect = /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(|(?<![A-Za-z0-9_-])bg-(?:gradient|linear|radial|conic)(?:-[A-Za-z0-9_[\]./%-]+)?(?![A-Za-z0-9_-])/;
const spinningAnimation = /(?<![A-Za-z0-9_-])animate-spin(?![A-Za-z0-9_-])/;
const transformTransition = /(?<![A-Za-z0-9_-])transition-transform(?![A-Za-z0-9_-])/;
const scaleOrRotate = /(?<![A-Za-z0-9_-])-?(?:scale(?:-[xy])?|rotate(?:-[xyz])?)-(?:\[[^\]]+\]|\d+(?:\.\d+)?(?:\/\d+)?)(?![A-Za-z0-9_-])/;
const cssScaleOrRotate = /transform\s*:[^;}\n]*(?:rotate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\s*\(|(?<![A-Za-z0-9_-])(?:rotate|scale)\s*:/i;
const arbitraryTransform = /(?<![A-Za-z0-9_-])transform-\[[^\]]*(?:rotate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\s*\([^\]]*\)[^\]]*\](?![A-Za-z0-9_-])/i;
const variantTranslate = /(?<![A-Za-z0-9_-])(?:[^\s"'`]+:)+-?translate-[xy]-(?:\[[^\]]+\]|\d+(?:\.\d+)?(?:\/\d+)?|full|px)(?![A-Za-z0-9_-])/;
const largeRadiusClass = /(?<![A-Za-z0-9_-])rounded(?:-[trblse]{1,2})?-(?:xl|2xl|3xl|full)(?![A-Za-z0-9_-])/;
const arbitraryRadiusClass = /(?<![A-Za-z0-9_-])rounded(?:-[trblse]{1,2})?-\[([^\]]+)\](?![A-Za-z0-9_-])/g;
const approvedArbitraryRadius = /^(\d*\.?\d+)(px|rem)$/;
const negativeTracking = /(?<![A-Za-z0-9_-])tracking-(?:tight|tighter)(?![A-Za-z0-9_-])|(?<![A-Za-z0-9_-])tracking-\[\s*-|letter-spacing\s*:\s*-/;
const javaScriptExtension = /^\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;
const prohibitedStyleProperties = new Set(['rotate', 'scale', 'transform']);
const motionObjectProps = new Set(['animate', 'exit', 'initial', 'style', 'variants', 'whileDrag', 'whileFocus', 'whileHover', 'whileTap']);
const prohibitedTransformFunction = /(?:^|[^A-Za-z0-9_-])(?:rotate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\s*\(/i;

function runThemeBootstrap(script, raw, storageError = false) {
  const classNames = new Set();
  let requestedKey = null;
  const root = {
    classList: {
      contains: (name) => classNames.has(name),
      toggle: (name, enabled) => enabled ? classNames.add(name) : classNames.delete(name),
    },
    setAttribute: () => {},
    style: {},
  };
  vm.runInNewContext(script, {
    document: { documentElement: root },
    window: {
      localStorage: {
        getItem(key) {
          requestedKey = key;
          if (storageError) throw new Error('storage unavailable');
          return raw;
        },
      },
    },
  });
  return {
    colorScheme: root.style.colorScheme,
    dark: root.classList.contains('dark'),
    requestedKey,
  };
}

async function loadUserStore() {
  let source = read('src/stores/useUserStore.ts');
  if (process.env.THEME_STORE_MUTATION === '1') {
    source = source.replace('        synchronizeTheme(next);', '        // mutation: omit toggle synchronization');
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const themeBootstrap = await import(new URL('../src/lib/theme-bootstrap.mjs', import.meta.url).href);
  const module = { exports: {} };
  const requireMock = (id) => {
    if (id === 'zustand' || id === 'zustand/middleware') return runtimeRequire(id);
    if (id === '@/lib/api') return { toggleFavoriteAPI: () => Promise.resolve(), submitRating: () => Promise.resolve(null) };
    if (id === '@/lib/ratings') return { isRatingAggregate: () => false };
    if (id === '@/lib/theme-bootstrap.mjs') return themeBootstrap;
    throw new Error(`Unexpected user-store import: ${id}`);
  };
  new Function('require', 'module', 'exports', outputText)(requireMock, module, module.exports);
  return module.exports.useUserStore;
}

function createThemeDocument(initialTheme = 'dark') {
  const classes = new Set(initialTheme === 'dark' ? ['dark'] : []);
  const attributes = new Map([['data-theme', initialTheme]]);
  const meta = { content: initialTheme === 'dark' ? '#080B0E' : '#F3F6F8' };
  return {
    documentElement: {
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name) ?? null,
      style: { colorScheme: initialTheme },
    },
    meta,
    querySelectorAll: () => [meta],
  };
}

async function withUserStoreEnvironment({ initialTheme = 'dark', raw = null, throwOnSet = false }, run) {
  const original = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    window: globalThis.window,
  };
  const document = createThemeDocument(initialTheme);
  const localStorage = {
    getItem: () => raw,
    setItem: () => {
      if (throwOnSet) throw new Error('quota exceeded');
    },
    removeItem: () => {},
  };
  Object.assign(globalThis, { document, localStorage, window: { localStorage } });
  try {
    await run({ document, localStorage });
  } finally {
    Object.assign(globalThis, original);
  }
}

function hasProhibitedRadius(content) {
  if (largeRadiusClass.test(content)) return true;
  return [...content.matchAll(arbitraryRadiusClass)].some((match) => {
    const approved = match[1].trim().match(approvedArbitraryRadius);
    if (!approved) return true;
    const value = Number.parseFloat(approved[1]);
    const pixels = approved[2] === 'rem' ? value * 16 : value;
    return pixels > 6;
  });
}

function scriptKind(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.tsx') return ts.ScriptKind.TSX;
  if (extension === '.jsx') return ts.ScriptKind.JSX;
  if (extension === '.ts' || extension === '.mts' || extension === '.cts') return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function parseJavaScript(content, file) {
  if (!javaScriptExtension.test(path.extname(file).toLowerCase())) return null;
  const source = /^\s*style\s*=/.test(content) ? `<div ${content} />` : content;
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
}

function accessName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return null;
}

function accessReceiver(node) {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return node.expression;
  return null;
}

function propertyName(node, sourceFile) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteralLike(node.expression)) return node.expression.text;
  return node.getText(sourceFile);
}

function isFunctionScope(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

function isBindingScope(node) {
  return ts.isSourceFile(node)
    || ts.isBlock(node)
    || ts.isModuleBlock(node)
    || ts.isCaseBlock(node)
    || ts.isCatchClause(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || isFunctionScope(node);
}

function containingBindingScope(node) {
  let current = node;
  while (current && !isBindingScope(current)) current = current.parent;
  return current;
}

function bindingIdentifiers(name) {
  if (ts.isIdentifier(name)) return [name];
  if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) return [];
  return name.elements.flatMap((element) => ts.isBindingElement(element)
    ? bindingIdentifiers(element.name)
    : []);
}

function variableBindingScope(node) {
  const declarationList = node.parent;
  if (ts.isVariableDeclarationList(declarationList)
    && (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0) {
    return containingBindingScope(declarationList.parent);
  }
  let current = node.parent;
  while (current && !ts.isSourceFile(current) && !isFunctionScope(current)) current = current.parent;
  return current;
}

function collectBindings(sourceFile) {
  const bindings = new Map();
  const add = (name, scope, initializer = null, position = name.pos) => {
    if (!scope) return;
    const entries = bindings.get(name.text) || [];
    entries.push({ initializer, position, scope });
    bindings.set(name.text, entries);
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isVariableDeclarationList(node.parent)) {
      const scope = variableBindingScope(node);
      for (const name of bindingIdentifiers(node.name)) {
        add(name, scope, ts.isIdentifier(node.name) ? node.initializer || null : null, node.pos);
      }
    } else if (ts.isParameter(node)) {
      for (const name of bindingIdentifiers(node.name)) add(name, node.parent);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      for (const name of bindingIdentifiers(node.variableDeclaration.name)) add(name, node);
    } else if (ts.isImportClause(node) && node.name) {
      add(node.name, sourceFile);
    } else if (ts.isNamespaceImport(node) || ts.isImportSpecifier(node) || ts.isImportEqualsDeclaration(node)) {
      add(node.name, sourceFile);
    } else if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isEnumDeclaration(node))
      && node.name) {
      add(node.name, containingBindingScope(node.parent));
    } else if (ts.isFunctionExpression(node) && node.name) {
      add(node.name, node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return bindings;
}

function resolveBinding(identifier, bindings) {
  const entries = bindings.get(identifier.text) || [];
  let scope = containingBindingScope(identifier);
  while (scope) {
    const scoped = entries.filter((entry) => entry.scope === scope);
    if (scoped.length) {
      const preceding = scoped.filter((entry) => entry.position <= identifier.pos);
      return preceding.at(-1) || { initializer: null };
    }
    scope = containingBindingScope(scope.parent);
  }
  return null;
}

function unwrapExpression(node) {
  let current = node;
  while (current && (ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isNonNullExpression(current))) {
    current = current.expression;
  }
  return current;
}

function staticStyleValue(node, bindings, seen = new Set()) {
  const current = unwrapExpression(node);
  if (!current) return null;
  if (ts.isStringLiteralLike(current) || ts.isNoSubstitutionTemplateLiteral(current)) return current.text;
  if (!ts.isIdentifier(current)) return null;
  const binding = resolveBinding(current, bindings);
  const initializer = binding?.initializer;
  if (!initializer || seen.has(initializer)) return null;
  const nextSeen = new Set(seen);
  nextSeen.add(initializer);
  return staticStyleValue(initializer, bindings, nextSeen);
}

function hasProhibitedStyleValue(property, node, bindings) {
  if (property !== 'transform') return true;
  const value = staticStyleValue(node, bindings);
  return value === null || prohibitedTransformFunction.test(value);
}

function containsProhibitedObjectProperty(node, sourceFile, bindings, seen = new Set()) {
  const current = unwrapExpression(node);
  if (!current) return false;
  if (ts.isIdentifier(current)) {
    const binding = resolveBinding(current, bindings);
    const initializer = binding?.initializer;
    if (!initializer || seen.has(initializer)) return false;
    const nextSeen = new Set(seen);
    nextSeen.add(initializer);
    return containsProhibitedObjectProperty(initializer, sourceFile, bindings, nextSeen);
  }
  if (ts.isObjectLiteralExpression(current)) {
    return current.properties.some((property) => {
      if (ts.isSpreadAssignment(property)) {
        return containsProhibitedObjectProperty(property.expression, sourceFile, bindings, seen);
      }
      if (ts.isPropertyAssignment(property)) {
        const name = propertyName(property.name, sourceFile);
        return (prohibitedStyleProperties.has(name)
          && hasProhibitedStyleValue(name, property.initializer, bindings))
          || containsProhibitedObjectProperty(property.initializer, sourceFile, bindings, seen);
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        const name = propertyName(property.name, sourceFile);
        return prohibitedStyleProperties.has(name)
          || containsProhibitedObjectProperty(property.name, sourceFile, bindings, seen);
      }
      return false;
    });
  }
  return false;
}

function isStyleReceiver(node) {
  return (ts.isIdentifier(node) && node.text === 'style') || accessName(node) === 'style';
}

function callName(node) {
  return ts.isIdentifier(node) ? node.text : accessName(node);
}

function hasProhibitedJavaScriptMotion(content, file) {
  const sourceFile = parseJavaScript(content, file);
  if (!sourceFile) return false;
  const bindings = collectBindings(sourceFile);
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const property = accessName(node.left);
      const styleAccess = accessReceiver(node.left);
      if (prohibitedStyleProperties.has(property)
        && styleAccess
        && accessName(styleAccess) === 'style'
        && hasProhibitedStyleValue(property, node.right, bindings)) {
        found = true;
        return;
      }
    }
    if (ts.isCallExpression(node)) {
      const receiver = accessReceiver(node.expression);
      if (callName(node.expression) === 'setProperty'
        && receiver
        && isStyleReceiver(receiver)
        && node.arguments.length >= 2) {
        const property = staticStyleValue(node.arguments[0], bindings);
        if (prohibitedStyleProperties.has(property)
          && hasProhibitedStyleValue(property, node.arguments[1], bindings)) {
          found = true;
          return;
        }
      }
      if (callName(node.expression) === 'css'
        && node.arguments.some((argument) => containsProhibitedObjectProperty(
          argument,
          sourceFile,
          bindings,
        ))) {
        found = true;
        return;
      }
    }
    if (ts.isJsxOpeningLikeElement(node) && /^motion(?:\.|$)/i.test(node.tagName.getText(sourceFile))) {
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attribute)) {
          if (containsProhibitedObjectProperty(attribute.expression, sourceFile, bindings)) found = true;
          continue;
        }
        const name = attribute.name.getText(sourceFile);
        if (prohibitedStyleProperties.has(name)) {
          found = true;
          break;
        }
        if (!motionObjectProps.has(name) || !attribute.initializer) continue;
        const value = ts.isJsxExpression(attribute.initializer)
          ? attribute.initializer.expression
          : attribute.initializer;
        if (value && containsProhibitedObjectProperty(value, sourceFile, bindings)) {
          found = true;
          break;
        }
      }
      if (found) return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function literalText(node) {
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return null;
  return node.head.text + node.templateSpans.map((span) => `__EXPRESSION__${span.literal.text}`).join('');
}

function isCssLiteralContext(node, sourceFile) {
  const parent = node.parent;
  if (ts.isTaggedTemplateExpression(parent) && parent.template === node) {
    return /(?:^|\.)(?:css|styled(?:\.[A-Za-z0-9_$]+)?)$/i.test(parent.tag.getText(sourceFile));
  }
  if (ts.isVariableDeclaration(parent) && parent.initializer === node) {
    return /(?:css|style|styles)$/i.test(parent.name.getText(sourceFile));
  }
  if (ts.isBinaryExpression(parent) && parent.right === node) {
    return /^(?:cssText|innerHTML|textContent)$/i.test(accessName(parent.left) || '');
  }
  if (ts.isCallExpression(parent) && parent.arguments.includes(node)) {
    return /^(?:insertRule|replaceSync)$/i.test(accessName(parent.expression) || '');
  }
  return false;
}

function getJavaScriptStyleContexts(content, file) {
  const sourceFile = parseJavaScript(content, file);
  if (!sourceFile) return [];
  const contexts = [];
  const cssDeclaration = /(?:^|[;{]\s*)(?:box-shadow|filter|rotate|scale|text-shadow|transform)\s*:/i;
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'style'
      && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      contexts.push(node.initializer.expression.getText(sourceFile));
    }
    const value = literalText(node);
    if (value !== null && cssDeclaration.test(value)
      && (/[{}]/.test(value) || isCssLiteralContext(node, sourceFile))) {
      contexts.push(value);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return contexts;
}

function getStyleContexts(content, file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === '.css') return [content];
  if (javaScriptExtension.test(extension)) return getJavaScriptStyleContexts(content, file);
  if (extension !== '.mdx') return [];

  const inlineStyles = [...content.matchAll(/style\s*=\s*\{\{([\s\S]*?)\}\}/g)].map((match) => match[1]);
  const styleTags = [...content.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/gi)].map((match) => match[1]);
  return [...styleTags, ...inlineStyles];
}

function maskFunctionContents(value) {
  let depth = 0;
  return [...value].map((character) => {
    if (character === '(') {
      depth += 1;
      return ' ';
    }
    if (character === ')') {
      depth = Math.max(0, depth - 1);
      return ' ';
    }
    return depth > 0 ? ' ' : character;
  }).join('');
}

function hasCenteredShadowOffsets(value) {
  const normalized = maskFunctionContents(value.replaceAll('_', ' '));
  return normalized.split(',').some((shadow) => {
    const lengths = shadow.trim().split(/\s+/).filter((token) => /^-?(?:\d*\.)?\d+(?:px|rem|em)?$/.test(token));
    return lengths.length >= 2
      && /^-?0(?:\.0+)?(?:px|rem|em)?$/.test(lengths[0])
      && /^-?0(?:\.0+)?(?:px|rem|em)?$/.test(lengths[1]);
  });
}

function collectFunctionArguments(content, name) {
  const argumentsList = [];
  const startPattern = new RegExp(`${name}\\s*\\(`, 'gi');
  let match;
  while ((match = startPattern.exec(content)) !== null) {
    let depth = 1;
    let index = startPattern.lastIndex;
    const start = index;
    while (index < content.length && depth > 0) {
      if (content[index] === '(') depth += 1;
      if (content[index] === ')') depth -= 1;
      index += 1;
    }
    if (depth === 0) argumentsList.push(content.slice(start, index - 1));
    startPattern.lastIndex = index;
  }
  return argumentsList;
}

function hasProhibitedGlow(content, file) {
  const arbitraryShadows = [...content.matchAll(/(?<![A-Za-z0-9_-])(?:shadow|text-shadow|drop-shadow)-\[([^\]]+)\]/gi)];
  if (arbitraryShadows.some((match) => hasCenteredShadowOffsets(match[1]))) return true;

  return getStyleContexts(content, file).some((context) => {
    const declarations = [...context.matchAll(/(?:box-shadow|text-shadow)\s*:\s*([^;}\n]+)/gi)];
    return declarations.some((match) => hasCenteredShadowOffsets(match[1]))
      || collectFunctionArguments(context, 'drop-shadow').some(hasCenteredShadowOffsets);
  });
}

function hasProhibitedCssMotion(content, file) {
  return getStyleContexts(content, file).some((context) => cssScaleOrRotate.test(context));
}

const sourceRules = [
  ['legacy hex', (content) => forbiddenHex.test(content)],
  ['raw palette class', (content) => rawPaletteClass.test(content)],
  ['legacy alias', (content) => aliasDefinition.test(content) || aliasUse.test(content)],
  ['white foreground', (content) => whiteForegroundClass.test(content)],
  ['prohibited radius', (content) => hasProhibitedRadius(content)],
  ['legacy rgba', (content) => /rgba\(23,\s*26,\s*23(?!\d)/.test(content)],
  ['gradient', (content) => gradientEffect.test(content)],
  ['glow', (content, file) => hasProhibitedGlow(content, file)],
  ['prohibited motion', (content, file) => spinningAnimation.test(content)
    || transformTransition.test(content)
    || scaleOrRotate.test(content)
    || arbitraryTransform.test(content)
    || variantTranslate.test(content)
    || hasProhibitedJavaScriptMotion(content, file)
    || hasProhibitedCssMotion(content, file)],
  ['negative tracking', (content) => negativeTracking.test(content)],
];

function findSourceViolation(content, file) {
  return sourceRules.find(([, matches]) => matches(content, file))?.[0];
}

function collectSourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return collectSourceFiles(absolute);
    if (!sourceExtension.test(entry)) return [];
    // The cyberpunk theme file is the sanctioned gradient/glow zone: every
    // rule there is scoped under [data-theme='cyberpunk'], so it is exempt
    // from the neon-escape scanner by design rather than by oversight.
    if (absolute.endsWith('cyberpunk-theme.css')) return [];
    return [absolute];
  });
}

function cssBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `missing CSS block ${selector}`);
  return match[1];
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  assert.ok(match, `missing token --${name}`);
  return match[1].trim().toLowerCase();
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('defines the approved light, dark, signal, and carbon tool tokens', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const carbon = cssBlock('.carbon-tool-surface');

  assert.deepEqual({
    page: token(light, 'page'),
    surface: token(light, 'surface'),
    ink: token(light, 'ink'),
    mutedSubtle: token(light, 'muted-subtle'),
    lineStrong: token(light, 'line-strong'),
    accent: token(light, 'accent'),
    accentInk: token(light, 'accent-ink'),
    onAccent: token(light, 'on-accent'),
    signal: token(light, 'signal'),
    signalInk: token(light, 'signal-ink'),
    toolSurface: token(light, 'tool-surface'),
    toolAccent: token(light, 'tool-accent'),
    toolOnAccent: token(light, 'tool-on-accent'),
    toolSignalInk: token(light, 'tool-signal-ink'),
  }, {
    page: '#f3f6f8',
    surface: '#ffffff',
    ink: '#081218',
    mutedSubtle: '#5f717b',
    lineStrong: '#6f838d',
    accent: '#007e99',
    accentInk: '#005b70',
    onAccent: '#ffffff',
    signal: '#f28b3c',
    signalInk: '#8a3900',
    toolSurface: '#10161a',
    toolAccent: '#46d9f2',
    toolOnAccent: '#081218',
    toolSignalInk: '#ffb57d',
  });
  assert.deepEqual({
    page: token(dark, 'page'),
    surface: token(dark, 'surface'),
    ink: token(dark, 'ink'),
    mutedSubtle: token(dark, 'muted-subtle'),
    lineStrong: token(dark, 'line-strong'),
    accent: token(dark, 'accent'),
    accentInk: token(dark, 'accent-ink'),
    onAccent: token(dark, 'on-accent'),
    signal: token(dark, 'signal'),
    signalInk: token(dark, 'signal-ink'),
    toolSurface: token(dark, 'tool-surface'),
  }, {
    page: '#080b0e',
    surface: '#10161a',
    ink: '#e8f7fb',
    mutedSubtle: '#7f949e',
    lineStrong: '#58707b',
    accent: '#46d9f2',
    accentInk: '#8aeaf9',
    onAccent: '#081218',
    signal: '#f28b3c',
    signalInk: '#ffb57d',
    toolSurface: '#0c1216',
  });
  for (const mapping of [
    ['surface', 'tool-surface'],
    ['ink', 'tool-ink'],
    ['muted', 'tool-muted'],
    ['line-strong', 'tool-line'],
    ['accent', 'tool-accent'],
    ['on-accent', 'tool-on-accent'],
    ['signal', 'tool-signal'],
    ['signal-ink', 'tool-signal-ink'],
    ['signal-soft', 'tool-signal-soft'],
  ]) {
    assert.match(carbon, new RegExp(`--${mapping[0]}:\\s*var\\(--${mapping[1]}\\)`));
  }
});

test('keeps every required text and control color pair above its WCAG threshold', () => {
  const light = cssBlock(':root');
  const dark = cssBlock('.dark');
  const checks = [
    [token(light, 'muted-subtle'), token(light, 'page'), 4.5],
    [token(light, 'accent-ink'), token(light, 'page'), 4.5],
    [token(light, 'line-strong'), token(light, 'surface'), 3],
    [token(light, 'on-accent'), token(light, 'accent'), 4.5],
    [token(light, 'signal-ink'), token(light, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-muted'), token(light, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(light, 'tool-surface'), 3],
    [token(light, 'tool-on-accent'), token(light, 'tool-accent'), 4.5],
    [token(light, 'tool-signal-ink'), token(light, 'tool-signal-soft'), 4.5],
    [token(dark, 'muted-subtle'), token(dark, 'surface'), 4.5],
    [token(dark, 'accent-ink'), token(dark, 'surface'), 4.5],
    [token(dark, 'line-strong'), token(dark, 'surface'), 3],
    [token(dark, 'on-accent'), token(dark, 'accent'), 4.5],
    [token(dark, 'signal-ink'), token(dark, 'signal-soft'), 4.5],
    [token(light, 'tool-ink'), token(dark, 'tool-surface'), 4.5],
    [token(light, 'tool-line'), token(dark, 'tool-surface'), 3],
  ];
  for (const [foreground, background, minimum] of checks) {
    assert.ok(contrast(foreground, background) >= minimum, `${foreground} on ${background}`);
  }
});

test('maps browser metadata, radii, and default motion to the approved system', () => {
  const layout = read('src/app/layout.tsx');
  const manifest = JSON.parse(read('public/manifest.json'));
  const tailwind = read('tailwind.config.ts');

  assert.match(layout, /themeColor:\s*'#080B0E'/);
  assert.equal(manifest.background_color, '#080B0E');
  assert.equal(manifest.theme_color, '#080B0E');
  assert.match(tailwind, /darkMode:\s*['"]class['"]/);
  assert.match(css, /--radius:\s*6px/);
  assert.match(css, /--radius-sm:\s*4px/);
  assert.doesNotMatch(css, /border-radius:\s*8px/);
  assert.match(css, /--transition-duration:\s*140ms/);
  assert.match(css, /transition-property:\s*color, background-color, border-color, outline-color/);
  assert.match(tailwind, /lg:\s*'var\(--radius\)'/);
  assert.match(tailwind, /DEFAULT:\s*'140ms'/);
  assert.match(tailwind, /DEFAULT:\s*'ease-out'/);
});

test('boots dark before paint while honoring a persisted theme', async () => {
  const layout = read('src/app/layout.tsx');
  const store = read('src/stores/useUserStore.ts');
  const moduleUrl = new URL('../src/lib/theme-bootstrap.mjs', import.meta.url);

  assert.equal(existsSync(moduleUrl), true, 'missing theme bootstrap module');
  const {
    DEFAULT_THEME,
    THEME_BOOTSTRAP_SCRIPT,
    THEME_STORAGE_KEY,
    THEME_STORAGE_VERSION,
    createSafeStorage,
    resolveStoredTheme,
    synchronizeTheme,
  } = await import(`${moduleUrl.href}?contract=${Date.now()}`);

  assert.equal(DEFAULT_THEME, 'dark');
  assert.equal(THEME_STORAGE_KEY, 'ai-tool-hub-user');
  assert.equal(THEME_STORAGE_VERSION, 0);
  assert.equal(resolveStoredTheme(null, DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme('{bad json', DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'light' } }), DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'light' }, version: 1 }), DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'light' }, version: THEME_STORAGE_VERSION }), DEFAULT_THEME), 'light');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'dark' }, version: THEME_STORAGE_VERSION }), DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'green' }, version: THEME_STORAGE_VERSION }), DEFAULT_THEME), 'dark');
  assert.equal(resolveStoredTheme(JSON.stringify({ state: { theme: 'green' } }), DEFAULT_THEME), 'dark');
  assert.match(THEME_BOOTSTRAP_SCRIPT, /const parsed = parseStoredThemeEnvelope\(stored\)/);
  assert.doesNotMatch(THEME_BOOTSTRAP_SCRIPT, /const resolveStoredTheme =/);

  const safeStorage = createSafeStorage({
    getItem() { throw new Error('read denied'); },
    setItem() { throw new Error('write denied'); },
    removeItem() { throw new Error('remove denied'); },
  });
  assert.equal(safeStorage.getItem(THEME_STORAGE_KEY), null);
  assert.doesNotThrow(() => safeStorage.setItem(THEME_STORAGE_KEY, 'value'));
  assert.doesNotThrow(() => safeStorage.removeItem(THEME_STORAGE_KEY));

  const classNames = new Set();
  const meta = { content: '' };
  const documentRef = {
    documentElement: {
      classList: { toggle: (name, enabled) => enabled ? classNames.add(name) : classNames.delete(name) },
      setAttribute: () => {},
      style: {},
    },
    querySelectorAll: () => [meta],
  };
  synchronizeTheme('dark', documentRef);
  assert.deepEqual({ dark: classNames.has('dark'), colorScheme: documentRef.documentElement.style.colorScheme, meta: meta.content }, {
    dark: true, colorScheme: 'dark', meta: '#080B0E',
  });
  synchronizeTheme('light', documentRef);
  assert.deepEqual({ dark: classNames.has('dark'), colorScheme: documentRef.documentElement.style.colorScheme, meta: meta.content }, {
    dark: false, colorScheme: 'light', meta: '#F3F6F8',
  });

  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, null), {
    colorScheme: 'dark',
    dark: true,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, JSON.stringify({ state: { theme: 'light' }, version: 0 })), {
    colorScheme: 'light',
    dark: false,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.deepEqual(runThemeBootstrap(THEME_BOOTSTRAP_SCRIPT, null, true), {
    colorScheme: 'dark',
    dark: true,
    requestedKey: 'ai-tool-hub-user',
  });
  assert.match(store, /theme:\s*DEFAULT_THEME/);
  assert.match(store, /name:\s*THEME_STORAGE_KEY/);
  assert.match(store, /version:\s*THEME_STORAGE_VERSION/);
  assert.match(store, /storage:\s*createThemeStorage<UserStore>/);
  assert.match(store, /synchronizeTheme\(next\)/);
  assert.match(store, /synchronizeTheme\(state\.theme\)/);
  assert.match(layout, /id="theme-bootstrap"/);
  assert.match(layout, /dangerouslySetInnerHTML=\{\{ __html: THEME_BOOTSTRAP_SCRIPT \}\}/);
  assert.ok(layout.indexOf('id="theme-bootstrap"') < layout.indexOf('<body'));
});

test('executes persisted user theme synchronization through Zustand storage', async () => {
  await withUserStoreEnvironment({ throwOnSet: true }, async ({ document }) => {
    const useUserStore = await loadUserStore();
    assert.equal(useUserStore.getState().theme, 'dark');
    assert.doesNotThrow(() => useUserStore.getState().toggleTheme());
    assert.equal(useUserStore.getState().theme, 'light');
    assert.equal(document.documentElement.classList.contains('dark'), false);
    assert.equal(document.documentElement.style.colorScheme, 'light');
    assert.equal(document.meta.content, '#F3F6F8');
  });

  await withUserStoreEnvironment({ raw: JSON.stringify({ state: { theme: 'light' }, version: 0 }) }, async ({ document }) => {
    const useUserStore = await loadUserStore();
    await useUserStore.persist.rehydrate();
    assert.equal(useUserStore.getState().theme, 'light');
    assert.equal(document.documentElement.classList.contains('dark'), false);
    assert.equal(document.documentElement.style.colorScheme, 'light');
    assert.equal(document.meta.content, '#F3F6F8');
  });

  await withUserStoreEnvironment({
    initialTheme: 'light',
    raw: JSON.stringify({ state: { favorites: [42], theme: 'dark' }, version: 0 }),
  }, async ({ document }) => {
    const useUserStore = await loadUserStore();
    await useUserStore.persist.rehydrate();
    assert.equal(useUserStore.getState().theme, 'dark');
    assert.deepEqual(useUserStore.getState().favorites, [42]);
    assert.equal(document.documentElement.classList.contains('dark'), true);
    assert.equal(document.documentElement.style.colorScheme, 'dark');
    assert.equal(document.meta.content, '#080B0E');
  });

  for (const raw of [
    '{bad json',
    JSON.stringify({ state: { theme: 'light' } }),
    JSON.stringify({ state: { theme: 'green' }, version: 0 }),
    JSON.stringify({ state: { theme: 'light' }, version: 1 }),
  ]) {
    await withUserStoreEnvironment({ raw }, async ({ document }) => {
      const useUserStore = await loadUserStore();
      await useUserStore.persist.rehydrate();
      assert.equal(useUserStore.getState().theme, 'dark');
      assert.equal(document.documentElement.classList.contains('dark'), true);
      assert.equal(document.documentElement.style.colorScheme, 'dark');
      assert.equal(document.meta.content, '#080B0E');
    });
  }
});

test('uses contrast-safe chrome, primary actions, active rails, and control borders', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');
  const search = read('src/components/hero/SearchBar.tsx');
  const tasks = read('src/components/home/TaskEntryList.tsx');
  const home = read('src/app/page.tsx');
  const context = read('src/components/tools/TaskContextBar.tsx');
  const filters = read('src/components/tools/FilterFields.tsx');
  const drawer = read('src/components/tools/MobileFilterDrawer.tsx');

  assert.match(navbar, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(bottomNav, /active \? 'text-\[var\(--accent-ink\)\]'/);
  assert.match(search, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(search, /rgba\(23,26,23/);
  assert.match(search, /border-l-\[3px\] border-l-transparent/);
  assert.match(search, /flex min-h-12 w-full items-center border-l-\[3px\] border-l-transparent/);
  assert.match(search, /border-l-\[var\(--accent\)\]/);
  assert.match(tasks, /border-l-\[3px\] border-l-transparent/);
  assert.match(tasks, /hover:border-l-\[var\(--accent\)\]/);
  assert.match(home, /border-\[var\(--signal\)\]/);
  assert.match(home, /bg-\[var\(--signal-soft\)\]/);
  assert.equal((context.match(/border-\[var\(--line-strong\)\]/g) || []).length, 4);
  assert.match(filters, /accent-\[var\(--accent\)\]/);
  assert.match(filters, /border-\[var\(--line-strong\)\]/);
  assert.match(drawer, /border-l border-\[var\(--line-strong\)\]/);
});

test('uses precision navigation rails and outline-only search focus', () => {
  const navbar = read('src/components/layout/Navbar.tsx');
  const bottomNav = read('src/components/layout/BottomNav.tsx');
  const search = read('src/components/hero/SearchBar.tsx');

  assert.match(css, /\.instrument-nav-item\[data-orientation='desktop'\]::after/);
  assert.match(css, /\.instrument-nav-item\[data-orientation='mobile'\]::after/);
  assert.match(css, /\.instrument-nav-item\[data-active='true'\]::after/);
  assert.match(css, /\.instrument-section::before/);
  assert.match(css, /\.instrument-section::after/);
  assert.match(css, /@media \(min-width: 768px\)/);
  assert.doesNotMatch(css, /repeating-(?:linear|radial)-gradient/);
  assert.match(navbar, /data-orientation="desktop"/);
  assert.match(navbar, /data-active=\{active \? 'true' : undefined\}/);
  assert.match(navbar, /aria-current=\{active \? 'page' : undefined\}/);
  assert.doesNotMatch(navbar, /aria-label=\{theme === 'dark'/);
  assert.match(navbar, /sr-only">\{regularMeta\.label\}/);
  assert.match(navbar, /title=\{regularMeta\.label\}/);
  assert.match(navbar, /aria-pressed=\{isCyberpunk\}/);
  assert.match(navbar, /toggleCyberpunk/);
  assert.match(bottomNav, /data-orientation="mobile"/);
  assert.match(bottomNav, /data-active=\{active \? 'true' : undefined\}/);
  assert.match(search, /data-search-shell/);
  assert.match(search, /\[outline-style:solid\] outline-2 outline-offset-2 outline-\[var\(--accent\)\]/);
  assert.doesNotMatch(search, /ring-2 ring-\[var\(--accent-soft\)\]/);
});

test('preserves the explicit search outline style after Tailwind class merging', () => {
  const search = read('src/components/hero/SearchBar.tsx');
  const focusedClass = search.match(/focused\s*\?\s*'([^']+)'/)?.[1];
  assert.ok(focusedClass, 'missing focused SearchBar class');

  const mergedFocusedClass = twMerge(focusedClass);
  const mergedTokens = new Set(mergedFocusedClass.split(/\s+/));
  for (const token of [
    '[outline-style:solid]',
    'outline-2',
    'outline-offset-2',
    'outline-[var(--accent)]',
  ]) assert.ok(mergedTokens.has(token), `${token} did not survive twMerge: ${mergedFocusedClass}`);
});

test('task-first guard toggles away from and restores the current theme in both paths', () => {
  const guard = readRepo('scripts/task-first-ui-guard.mjs');
  const section = (start, end) => {
    const startIndex = guard.indexOf(start);
    const endIndex = guard.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0, `missing ${start}`);
    assert.ok(endIndex > startIndex, `missing ${end} after ${start}`);
    return guard.slice(startIndex, endIndex);
  };
  const helper = section('async function assertThemeToggle', 'async function runFlow');
  const keyboardPath = section('async function assertKeyboardAndTheme', 'async function assertCompareLimit');
  const responsivePath = section('async function assertResponsiveGeometry', 'async function main');

  assert.match(helper, /const readTheme = async \(\) =>/);
  assert.match(helper, /getAttribute\('data-theme'\)/);
  assert.match(helper, /切换到\(\?:亮色\|暗色\)主题/);
  assert.match(helper, /\(\?:切换到\|退出\)赛博朋克主题/);
  assert.match(helper, /if \(afterFirst === initialTheme\) \{\s*fail\(`\$\{label\}: theme did not change`\);\s*return;\s*\}/);
  assert.match(helper, /restoredTheme !== initialTheme/);
  assert.match(keyboardPath, /await assertThemeToggle\(page,/);
  assert.match(responsivePath, /await assertThemeToggle\(page,/);
  assert.equal((guard.match(/await assertThemeToggle\(page,/g) || []).length, 2);
});

test('uses stable selected rails and a scoped carbon compare tray', () => {
  const row = read('src/components/tools/ToolDecisionRow.tsx');
  const list = read('src/components/tools/ToolDecisionList.tsx');
  const tray = read('src/components/compare/CompareTray.tsx');

  assert.match(row, /data-selected=\{selected \? 'true' : undefined\}/);
  assert.match(row, /before:w-\[3px\]/);
  assert.match(row, /before:bg-transparent/);
  assert.match(row, /selected && 'bg-\[var\(--accent-soft\)\] before:bg-\[var\(--accent\)\]'/);
  assert.match(row, /text-\[var\(--accent-ink\)\]/);
  assert.match(list, /border-\[var\(--signal\)\]/);
  assert.match(list, /bg-\[var\(--signal-soft\)\]/);
  assert.match(tray, /data-carbon-surface/);
  assert.match(tray, /carbon-tool-surface/);
  assert.match(tray, /border-\[var\(--line-strong\)\]/);
  assert.match(tray, /text-\[var\(--on-accent\)\]/);
});

test('uses a carbon detail rail and keeps ratings, favorites, and ordinary success out of signal orange', () => {
  const summary = read('src/components/tools/ToolDecisionSummary.tsx');
  const detail = read('src/components/tools/ToolDetailClient.tsx');
  const evidence = read('src/components/tools/ToolEvidenceSections.tsx');
  const rating = read('src/components/ratings/RatingWidget.tsx');

  assert.match(detail, /data-carbon-surface/);
  assert.match(detail, /carbon-tool-surface/);
  assert.match(detail, /border-\[var\(--signal\)\]/);
  assert.match(detail, /border-\[var\(--signal-ink\)\]/);
  assert.match(detail, /bg-\[var\(--signal-soft\)\]/);
  assert.match(summary, /fill-current text-\[var\(--accent\)\]/);
  assert.match(summary, /text-\[var\(--on-accent\)\]/);
  assert.doesNotMatch(summary, /--danger|text-white/);
  assert.doesNotMatch(evidence, /amber|--danger|--warning/);
  assert.doesNotMatch(rating, /amber|--danger|--warning|text-white/);
  assert.match(rating, /fill-\[var\(--accent\)\] text-\[var\(--accent\)\]/);
  assert.match(rating, /text-\[var\(--signal-ink\)\]/);
});

test('uses carbon compare headers while keeping recoverable compare actions neutral', () => {
  const compare = read('src/app/compare/page.tsx');
  const header = compare.match(/selectedTools\.map\(\(tool\) => \(\s*(<div key=\{tool\.id\}[\s\S]*?<\/div>)\s*\)\)/)?.[1];
  const dataCell = compare.match(/values\.map\(\(value, index\) => (<div key=\{`\$\{row\.key\}-\$\{index\}`\}[\s\S]*?<\/div>)\)\}/)?.[1];
  const clearAction = compare.match(/<button type="button" onClick=\{clearAll\} className="([^"]*)">清除全部<\/button>/)?.[1];
  const removeAction = header?.match(/<button type="button" onClick=\{\(\) => removeTool\(tool\.id\)\} className="([^"]*)"/)?.[1];
  const carbonSurface = cssBlock('.carbon-tool-surface');

  assert.ok(header, 'missing selected-tool header block');
  assert.match(header, /<div key=\{tool\.id\} data-carbon-surface className="carbon-tool-surface[^\"]*border-\[var\(--line-strong\)\][^\"]*text-\[var\(--ink\)\][^\"]*">/);
  assert.match(carbonSurface, /--ink:\s*var\(--tool-ink\)/);
  assert.match(carbonSurface, /--on-accent:\s*var\(--tool-on-accent\)/);
  assert.doesNotMatch(header, /--danger|bg-red|border-red|text-red|text-white/);

  assert.ok(removeAction, 'missing selected-tool remove action');
  assert.match(removeAction, /h-11 w-11/);
  assert.match(removeAction, /text-\[var\(--muted\)\]/);
  assert.match(removeAction, /hover:bg-\[var\(--surface-subtle\)\]/);
  assert.doesNotMatch(removeAction, /--(?:danger|signal)|(?:bg|border|text|ring|fill)-(?:red|amber|orange|signal)|\b(?:amber|orange|signal)\b|text-white/);

  assert.ok(dataCell, 'missing ordinary comparison data-cell block');
  assert.match(dataCell, /bg-\[var\(--surface\)\]/);
  assert.match(dataCell, /text-\[var\(--accent-ink\)\]/);
  assert.doesNotMatch(dataCell, /data-carbon-surface|carbon-tool-surface/);

  assert.ok(clearAction, 'missing recoverable clear action');
  assert.match(clearAction, /min-h-11/);
  assert.match(clearAction, /border-\[var\(--line-strong\)\]/);
  assert.match(clearAction, /text-\[var\(--muted\)\]/);
  assert.match(clearAction, /hover:bg-\[var\(--surface-hover\)\]/);
  assert.doesNotMatch(clearAction, /--(?:danger|signal)|(?:bg|border|text|ring|fill)-(?:red|amber|orange|signal)|\b(?:amber|orange|signal)\b|text-white/);
});

test('source scanner collects existing JavaScript modules and recognizes MDX source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const modules = collectSourceFiles(sourceRoot)
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => path.basename(file))
    .sort();

  for (const knownModule of [
    'compare-selection.mjs',
    'search-suggestions.mjs',
    'tool-decision.mjs',
    'tools-query-state.mjs',
  ]) {
    assert.ok(modules.includes(knownModule), knownModule);
  }
  assert.equal(sourceExtension.test('content.mdx'), true);
});

test('source scanner rejects reviewed palette, effect, motion, radius, and tracking escapes', async (t) => {
  const cases = [
    ['danger alias definition', '--danger: #b54747;'],
    ['warning alias definition', '--warning : var(--signal-ink);'],
    ['danger alias use', 'color: var( --danger );'],
    ['stroke palette utility', 'stroke-red-500'],
    ['outline palette utility', 'outline-amber-400'],
    ['divide palette utility', 'divide-green-300'],
    ['decoration palette utility', 'decoration-cyan-400'],
    ['gradient stop palette utility', 'hover:from-purple-500/50'],
    ['ordinary linear gradient', 'background: linear-gradient(90deg, #000, #fff);'],
    ['repeating radial gradient', 'background: repeating-radial-gradient(circle, #000, #fff);'],
    ['conic gradient', 'background: conic-gradient(from 45deg, #000, #fff);'],
    ['arbitrary Tailwind gradient', 'bg-[linear-gradient(90deg,#000,#fff)]'],
    ['box shadow glow', 'box-shadow: 0 0 12px rgb(0 0 0 / 20%);', 'fixture.css'],
    ['text shadow glow', 'text-shadow: 0px 0rem 4px #000;', 'fixture.css'],
    ['arbitrary Tailwind glow', 'shadow-[0_0_12px_rgba(0,0,0,0.2)]'],
    ['color-first box shadow glow', 'box-shadow: #fff 0 0 12px;', 'fixture.css'],
    ['color-first text shadow glow', 'text-shadow: #fff 0 0 12px;', 'fixture.css'],
    ['color-first arbitrary Tailwind glow', 'shadow-[#fff_0_0_12px]'],
    ['color-first arbitrary Tailwind text glow', 'text-shadow-[#fff_0_0_12px]'],
    ['rgb color-first CSS glow', 'box-shadow: rgb(255 255 255) 0 0 12px;', 'fixture.css'],
    ['variable color-first CSS glow', 'text-shadow: var(--glow) 0 0 12px;', 'fixture.css'],
    ['later comma-separated CSS glow', 'box-shadow: 0 1px 2px #000, #fff 0 0 12px;', 'fixture.css'],
    ['arbitrary Tailwind drop shadow glow', 'drop-shadow-[0_0_12px_#fff]'],
    ['CSS filter drop shadow glow', 'filter: drop-shadow(0 0 12px #fff);', 'fixture.css'],
    ['unprefixed scale utility', 'scale-95'],
    ['responsive scale utility', 'md:scale-x-105'],
    ['group rotate utility', 'group-hover:-rotate-3'],
    ['data scale utility', 'data-[state=open]:scale-100'],
    ['CSS transform rotate function', 'transform: rotate(3deg);', 'fixture.css'],
    ['CSS transform rotateX function', 'transform: rotateX(3deg);', 'fixture.css'],
    ['CSS transform rotateY function', 'transform: rotateY(3deg);', 'fixture.css'],
    ['CSS transform rotateZ function', 'transform: rotateZ(3deg);', 'fixture.css'],
    ['CSS transform rotate3d function', 'transform: ROTATE3D(1, 0, 0, 3deg);', 'fixture.css'],
    ['CSS transform scale function', 'transform: scale(1.05);', 'fixture.css'],
    ['CSS transform scaleX function', 'transform: scaleX(1.05);', 'fixture.css'],
    ['CSS transform scaleY function', 'transform: scaleY(1.05);', 'fixture.css'],
    ['CSS transform scaleZ function', 'transform: scaleZ(1.05);', 'fixture.css'],
    ['CSS transform scale3d function', 'transform: SCALE3D(1.05, 1, 1);', 'fixture.css'],
    ['standalone CSS rotate property', 'rotate: 3deg;', 'fixture.css'],
    ['standalone CSS scale property', 'scale: 1.05;', 'fixture.css'],
    ['inline style scale property', 'style={{ scale: 1.1 }}', 'fixture.tsx'],
    ['imperative transform assignment', "element.style.transform = 'scale(1.05)';", 'fixture.ts'],
    ['imperative rotate assignment', "element.style.rotate = '3deg';", 'fixture.js'],
    ['imperative scale assignment', "element.style.scale = '1.05';", 'fixture.mjs'],
    ['setProperty transform scale assignment', "element.style.setProperty('transform', 'scale(1.05)');", 'fixture.ts'],
    ['setProperty transform rotate assignment', "element.style.setProperty('transform', 'rotateZ(3deg)');", 'fixture.ts'],
    ['setProperty rotate assignment', "element.style.setProperty('rotate', '3deg');", 'fixture.js'],
    ['setProperty scale assignment', "element.style.setProperty('scale', '1.05');", 'fixture.mjs'],
    ['CSS-in-JS transform scale property', "css({ transform: 'scale(1.05)' });", 'fixture.ts'],
    ['CSS-in-JS transform rotate property', "css({ transform: 'rotate(3deg)' });", 'fixture.ts'],
    ['CSS-in-JS scale property', 'css({ scale: 1.05 });', 'fixture.ts'],
    ['CSS-in-JS rotate property', "css({ rotate: '3deg' });", 'fixture.ts'],
    ['motion JSX scale prop', '<motion.div whileHover={{ scale: 1.05 }} />', 'fixture.tsx'],
    ['motion JSX rotate prop', '<motion.div animate={{ rotate: 3 }} />', 'fixture.jsx'],
    ['motion variants identifier', "const variants = { hover: { scale: 1.05 } }; <motion.div variants={variants} />", 'fixture.tsx'],
    ['motion prop identifier', "const hover = { rotate: 3 }; <motion.div whileHover={hover} />", 'fixture.tsx'],
    ['motion nested object spread identifier', "const hover = { scale: 1.05 }; const variants = { hover: { ...hover } }; <motion.div variants={variants} />", 'fixture.tsx'],
    ['motion prop object spread identifier', "const hover = { rotate: 3 }; <motion.div whileHover={{ ...hover }} />", 'fixture.tsx'],
    ['motion JSX spread identifier', "const motionProps = { whileHover: { scale: 1.05 } }; <motion.div {...motionProps} />", 'fixture.tsx'],
    ['motion variants resolve nearest let binding', "const variants = { hover: { opacity: 0.8 } }; function Card() { let variants = { hover: { scale: 1.05 } }; return <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['motion variants resolve nearest var binding', "const variants = { hover: { opacity: 0.8 } }; function Card() { var variants = { hover: { rotate: 3 } }; return <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['injected transform CSS string', "const injectedCss = '.card { transform: scale(1.05); }';", 'fixture.ts'],
    ['injected rotate CSS template', 'const injectedCss = `.card { rotate: 3deg; }`;', 'fixture.mjs'],
    ['injected centered glow CSS', "styleElement.textContent = '.card { box-shadow: 0 0 12px #fff; }';", 'fixture.js'],
    ['active translate utility', 'active:translate-x-1'],
    ['focus translate utility', 'focus:-translate-y-1'],
    ['group data translate utility', 'group-data-[state=open]:translate-x-1'],
    ['arbitrary hover translate utility', '[&:hover]:translate-x-1'],
    ['disabled translate utility', 'disabled:translate-x-1'],
    ['checked translate utility', 'checked:-translate-y-1'],
    ['arbitrary selector translate utility', '[&[data-state=open]]:translate-x-1'],
    ['arbitrary transform rotate utility', 'transform-[rotate(3deg)]'],
    ['arbitrary transform rotateX utility', 'transform-[rotateX(3deg)]'],
    ['arbitrary transform rotateY utility', 'transform-[rotateY(3deg)]'],
    ['arbitrary transform rotateZ utility', 'transform-[rotateZ(3deg)]'],
    ['arbitrary transform rotate3d utility', 'transform-[ROTATE3D(1,0,0,3deg)]'],
    ['arbitrary transform scale utility', 'transform-[scale(1.05)]'],
    ['arbitrary transform scaleX utility', 'transform-[scaleX(1.05)]'],
    ['arbitrary transform scaleY utility', 'transform-[scaleY(1.05)]'],
    ['arbitrary transform scaleZ utility', 'transform-[scaleZ(1.05)]'],
    ['arbitrary transform scale3d utility', 'transform-[SCALE3D(1.05,1,1)]'],
    ['MDX style tag transform function', '<style>.card { transform: rotateX(3deg); }</style>', 'fixture.mdx'],
    ['MDX attributed style tag property', '<style type="text/css">.card { scale: 1.1; }</style>', 'fixture.mdx'],
    ['MDX inline style transform function', '<div style={{ transform: \'scaleZ(1.1)\' }} />', 'fixture.mdx'],
    ['MDX inline style property', '<div style={{ rotate: \'3deg\' }} />', 'fixture.mdx'],
    ['large radius utility', 'rounded-xl'],
    ['directional large radius utility', 'md:rounded-t-2xl'],
    ['full radius utility', 'rounded-full'],
    ['arbitrary pixel radius above limit', 'rounded-[7px]'],
    ['arbitrary rem radius above limit', 'rounded-[0.5rem]'],
    ['percentage arbitrary radius', 'rounded-[50%]'],
    ['em arbitrary radius', 'rounded-[1em]'],
    ['point arbitrary radius', 'rounded-[8pt]'],
    ['calculated arbitrary radius', 'rounded-[calc(6px+1px)]'],
    ['variable arbitrary radius', 'rounded-[var(--large-radius)]'],
    ['tight tracking utility', 'tracking-tight'],
    ['tighter tracking utility', 'sm:tracking-tighter'],
    ['negative arbitrary tracking', 'tracking-[-0.01em]'],
    ['negative CSS tracking', 'letter-spacing: -0.01em;'],
  ];

  for (const [name, source, file = 'fixture.tsx'] of cases) {
    await t.test(name, () => assert.ok(findSourceViolation(source, file), source));
  }
});

test('source scanner allows precise identifiers, approved radii, and static positioning', async (t) => {
  const cases = [
    ['white prefix identifier', 'text-whitespace'],
    ['spin prefix identifier', 'animate-spinach'],
    ['palette prefix identifier', 'text-red-500ish'],
    ['approved large token radius', 'rounded-lg'],
    ['approved arbitrary pixel radius', 'rounded-[6px]'],
    ['approved arbitrary rem radius', 'rounded-[0.375rem]'],
    ['static positioning translate', '-translate-y-1/2'],
    ['static positive translate', 'translate-x-1'],
    ['non-glow shadow', 'box-shadow: 0 1px 2px rgb(0 0 0 / 20%);', 'fixture.css'],
    ['nonnegative tracking', 'letter-spacing: 0; tracking-wide'],
    ['similar custom property', '--dangerous: 1; color: var(--warning-label);'],
    ['similar transform identifiers', 'rotate-icon scale-factor transition-transformation'],
    ['ordinary scale object key', 'const options = { scale: 2 };', 'fixture.ts'],
    ['ordinary transform object keys', "const options = { rotate: false, transform: 'raw' };", 'fixture.ts'],
    ['imperative transform translate assignment', "element.style.transform = 'translateX(4px)';", 'fixture.ts'],
    ['imperative transform cleanup assignment', "element.style.transform = 'none';", 'fixture.ts'],
    ['setProperty transform translate assignment', "style.setProperty('transform', 'translateX(4px)');", 'fixture.ts'],
    ['setProperty transform cleanup assignment', "style.setProperty('transform', 'none');", 'fixture.ts'],
    ['CSS-in-JS static translate property', "css({ transform: 'translateX(4px)' });", 'fixture.ts'],
    ['CSS-in-JS transform cleanup property', "css({ transform: 'none' });", 'fixture.ts'],
    ['motion variants with safe properties', "const variants = { hover: { opacity: 0.8, color: '#fff' } }; <motion.div variants={variants} />", 'fixture.tsx'],
    ['motion spread with safe properties', "const hover = { opacity: 0.8 }; const variants = { hover: { ...hover } }; <motion.div variants={variants} />", 'fixture.tsx'],
    ['motion function parameter shadows prohibited outer binding', "const variants = { hover: { scale: 1.05 } }; function Card(variants) { return <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['motion arrow parameter shadows prohibited outer binding', "const variants = { hover: { scale: 1.05 } }; const Card = (variants) => <motion.div variants={variants} />;", 'fixture.tsx'],
    ['motion catch binding shadows prohibited outer binding', "const variants = { hover: { scale: 1.05 } }; try {} catch (variants) { <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['motion destructured binding shadows prohibited outer binding', "const variants = { hover: { scale: 1.05 } }; function Card(props) { const { variants } = props; return <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['motion uninitialized binding shadows prohibited outer binding', "const variants = { hover: { scale: 1.05 } }; function Card() { let variants; return <motion.div variants={variants} />; }", 'fixture.tsx'],
    ['ordinary JSX scale prop', '<Chart scale={2} rotate={0} />', 'fixture.tsx'],
    ['non-CSS scale string', "const note = 'Rotate credentials regularly at enterprise scale.';", 'fixture.ts'],
    ['non-CSS transform label', "const label = 'transform: data normalization';", 'fixture.js'],
    ['injected non-glow CSS string', "const css = '.card { box-shadow: 0 1px 2px #000; }';", 'fixture.ts'],
    ['MDX prose with scale label', 'Enterprise scale: built for teams', 'fixture.mdx'],
    ['MDX ordinary scale expression', '{ scale: 2 }', 'fixture.mdx'],
  ];

  for (const [name, source, file = 'fixture.tsx'] of cases) {
    await t.test(name, () => assert.equal(findSourceViolation(source, file), undefined, source));
  }
});

test('contains no legacy palette, raw status colors, or prohibited motion in application source', () => {
  const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
  const files = collectSourceFiles(sourceRoot);

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const violation = findSourceViolation(content, file);
    assert.equal(violation, undefined, `${file}: ${violation}`);
  }
});

test('prepares the QA directory without following existing path escapes', async () => {
  const helperUrl = new URL('../../scripts/carbon-qa-path.mjs', import.meta.url);
  assert.equal(existsSync(helperUrl), true, 'missing executable QA path preparation helper');
  const { prepareQaDir, validateQaDir } = await import(helperUrl.href);
  assert.equal(validateQaDir('/tmp/carbon-console-qa'), '/tmp/carbon-console-qa');
  assert.equal(validateQaDir('/tmp/nested/../carbon-console-qa'), '/tmp/carbon-console-qa');
  for (const rejected of [
    '.',
    fileURLToPath(new URL('../', import.meta.url)),
    fileURLToPath(new URL('../../', import.meta.url)),
    '/',
    '/tmp',
    '/tmp/..',
    '/tmp/../outside',
    '/tmp-sibling',
  ]) {
    assert.throws(() => validateQaDir(rejected), /CARBON_QA_DIR.*\/tmp\//, rejected);
  }
  const callerRoot = await mkdtemp('/tmp/carbon-qa-caller-');
  const externalRoot = await mkdtemp('/tmp/carbon-qa-external-');
  const externalEvidence = path.join(externalRoot, 'evidence');
  const sentinel = path.join(externalEvidence, 'sentinel.txt');

  try {
    await mkdir(externalEvidence);
    await writeFile(sentinel, 'must survive');
    await symlink(externalRoot, path.join(callerRoot, 'linked'), 'dir');

    await assert.rejects(
      prepareQaDir(path.join(callerRoot, 'linked', 'evidence')),
      /symbolic link/i,
    );
    assert.equal(await readFile(sentinel, 'utf8'), 'must survive');

    const fileAncestor = path.join(callerRoot, 'not-a-directory');
    await writeFile(fileAncestor, 'file');
    await assert.rejects(
      prepareQaDir(path.join(fileAncestor, 'evidence')),
      /not a directory/i,
    );

    const safeCandidate = path.join(callerRoot, 'fresh', 'evidence');
    assert.equal(await prepareQaDir(safeCandidate), safeCandidate);
    assert.equal(statSync(safeCandidate).isDirectory(), true);
    await assert.rejects(prepareQaDir('/tmp'), /non-root descendant/i);
  } finally {
    await rm(callerRoot, { recursive: true, force: true });
    await rm(externalRoot, { recursive: true, force: true });
  }
});

test('prepares the QA directory before known-entry cleanup or evidence work', () => {
  const guard = readRepo('scripts/carbon-theme-ui-guard.mjs');
  const preparation = "const qaDir = await prepareQaDir(process.env.CARBON_QA_DIR || '/tmp/carbon-console-qa');";
  const preparationIndex = guard.indexOf(preparation);
  const mainIndex = guard.indexOf('async function main()');
  const cleanupIndex = guard.indexOf('await cleanupGeneratedEvidence(qaDir)');
  const captureIndex = guard.indexOf('await captureScenario(browser, viewport, scenario, theme, qaDir)');
  const composeIndex = guard.indexOf('await composeEvidence(sharp, qaDir)');
  const auditIndex = guard.indexOf('await auditEvidence(sharp, qaDir)');
  assert.match(guard, /import \{ prepareQaDir \} from '\.\/carbon-qa-path\.mjs'/);
  assert.ok(preparationIndex >= 0, 'QA directory is not assigned from the preparation helper');
  assert.equal([...guard.matchAll(/process\.env\.CARBON_QA_DIR/g)].length, 1, 'raw QA env must be read exactly once');
  assert.ok(mainIndex < preparationIndex && preparationIndex < cleanupIndex, 'main/preparation/cleanup order is unsafe');
  assert.ok(cleanupIndex < captureIndex && captureIndex < composeIndex && composeIndex < auditIndex, 'QA work is out of order');
  assert.doesNotMatch(guard, /rm\(qaDir,\s*\{\s*recursive:\s*true/);
  assert.doesNotMatch(guard, /mkdir\(qaDir,\s*\{\s*recursive:\s*true/);
});

test('wires the complete carbon route, state, geometry, focus, and evidence guard into CI', () => {
  const guard = readRepo('scripts/carbon-theme-ui-guard.mjs');
  const workflow = readRepo('.github/workflows/deploy.yml');

  const scenariosBlock = guard.match(/const allScenarios = \[([\s\S]*?)\n\];/)?.[1];
  const viewportsBlock = guard.match(/const viewports = \[([\s\S]*?)\n\];/)?.[1];
  assert.ok(scenariosBlock, 'missing structural scenario array');
  assert.ok(viewportsBlock, 'missing structural viewport array');

  const scenarioNames = [...scenariosBlock.matchAll(/name: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(scenarioNames, ['home', 'directory', 'detail', 'compare', 'scenes', 'scene-detail', 'leaderboard', 'user', 'auth']);
  for (const entry of [
    "name: 'home', path: '/'",
    "name: 'directory', path: '/tools?scene=research&price=free-tier&platform=web'",
    "name: 'detail', path: '/tools/71'",
    "name: 'compare', path: '/tools?scene=research&price=free-tier&platform=web'",
    "name: 'scenes', path: '/scenes'",
    "name: 'scene-detail', path: '/scenes/research'",
    "name: 'leaderboard', path: '/leaderboard'",
    "name: 'user', path: '/user'",
    "name: 'auth', path: '/user'",
  ]) assert.match(scenariosBlock, new RegExp(entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const viewportPairs = [...viewportsBlock.matchAll(/width: (\d+), height: (\d+)/g)]
    .map((match) => [Number(match[1]), Number(match[2])]);
  assert.deepEqual(viewportPairs, [[1440, 900], [1280, 720], [768, 1024], [390, 844], [320, 844]]);
  assert.equal((scenarioNames.length * 2) + (4 * 4 * 2), 50);
  assert.match(guard, /capturePlan\.length !== 50/);

  const functionBody = (name) => {
    const match = guard.match(new RegExp(`(?:async )?function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\}`));
    assert.ok(match, `missing function ${name}`);
    return match[1];
  };
  const capture = functionBody('captureScenario');
  const main = functionBody('main');
  for (const call of [
    'openScenario',
    'assertScenarioIdentity',
    'setTheme',
    'assertHomeHover',
    'assertTokens',
    'assertNoOverflow',
    'assertCarbonSurfaces',
    'assertSelectedRails',
    'assertResponsiveGeometry',
    'assertFocusColors',
    'assertThemeLayoutInvariant',
    'prepareScreenshot',
  ]) assert.match(capture, new RegExp(`await ${call}\\(`), `${call} is not in the capture path`);
  assert.match(capture, /page\.screenshot\(\{[\s\S]*?fullPage: false/);

  for (const name of [
    'assertScenarioIdentity',
    'assertAuthAvailability',
    'assertHomeHover',
    'assertResponsiveGeometry',
    'assertCarbonSurfaces',
    'assertFourToolCompareTrayGeometry',
    'assertSelectedRails',
    'assertFocusColors',
    'assertThemeLayoutInvariant',
    'assertAuthoritativeRatingFlow',
    'assertInitialTheme',
    'assertInstrumentConsole',
    'prepareScreenshot',
    'auditEvidence',
  ]) functionBody(name);
  const authAvailability = functionBody('assertAuthAvailability');
  assert.match(authAvailability, /await riskState\.count\(\)/);
  assert.match(authAvailability, /await submit\.isEnabled\(\)/);
  assert.match(authAvailability, /riskCount === 1 && enabled/);
  assert.match(authAvailability, /riskCount === 0 && !enabled/);
  assert.equal((guard.match(/await assertAuthAvailability\(dialog,/g) || []).length, 2);
  assert.match(functionBody('assertScenarioIdentity'), /404|not-found|nextjs-portal/);
  assert.match(functionBody('assertScenarioIdentity'), /searchParams/);
  assert.match(functionBody('assertHomeHover'), /backgroundColor/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertTargetSize/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertContainerGeometry/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertFixedSurfaceGeometry/);
  assert.match(functionBody('assertResponsiveGeometry'), /assertFourToolCompareTrayGeometry/);
  const fourToolGeometry = functionBody('assertFourToolCompareTrayGeometry');
  assert.match(fourToolGeometry, /scrollWidth/);
  assert.match(fourToolGeometry, /clientWidth/);
  assert.match(fourToolGeometry, /assertTargetSize/);
  assert.match(fourToolGeometry, /overlap/i);
  assert.match(fourToolGeometry, /intendedTools/);
  assert.match(functionBody('assertTargetSize'), /44/);
  assert.match(functionBody('assertContainerGeometry'), /overlap/i);
  assert.match(functionBody('assertFixedSurfaceGeometry'), /overlap/i);
  assert.match(functionBody('assertSelectedRails'), /toggle/i);
  assert.match(functionBody('assertSelectedRails'), /left/);
  assert.match(functionBody('assertFocusColors'), /assertOutline/);
  assert.match(functionBody('assertOutline'), /outlineStyle/);
  assert.match(functionBody('assertOutline'), /outlineWidth/);
  assert.match(capture, /await assertInstrumentConsole\(/);
  assert.match(capture, /context\.addInitScript\([\s\S]*THEME_STORAGE_KEY[\s\S]*THEME_STORAGE_VERSION/);
  assert.match(main, /await assertInitialTheme\(browser\)/);
  const instrumentConsole = functionBody('assertInstrumentConsole');
  assert.match(instrumentConsole, /gridTemplateColumns/);
  assert.match(instrumentConsole, /data-instrument-section/);
  assert.match(instrumentConsole, /data-search-shell/);
  assert.match(instrumentConsole, /content/);
  assert.match(instrumentConsole, /display/);
  assert.match(instrumentConsole, /visibility/);
  assert.match(instrumentConsole, /outlineStyle/);
  assert.match(functionBody('assertInitialTheme'), /THEME_STORAGE_KEY/);
  assert.match(functionBody('assertInitialTheme'), /DEFAULT_THEME/);
  assert.match(main, /await assertAuthoritativeRatingFlow\(browser\)/);

  assert.match(main, /await prepareQaDir\(/);
  assert.match(main, /await cleanupGeneratedEvidence\(qaDir\)/);
  assert.doesNotMatch(main, /recursive:\s*true/);
  assert.match(main, /await composeEvidence\(sharp, qaDir\)/);
  assert.match(main, /await auditEvidence\(sharp, qaDir\)/);
  assert.match(functionBody('auditEvidence'), /expectedScreenshotNames/);
  assert.match(functionBody('auditEvidence'), /metadata\(\)/);
  assert.match(functionBody('composeEvidence'), /throw new Error|fail\(/);

  const lifecycle = workflow.match(/- name: Run Next\.js task-first UI guard([\s\S]*?)(?=\n      - name:)/)?.[1];
  assert.ok(lifecycle, 'missing shared production UI guard lifecycle');
  const lifecycleOrder = [
    'cleanup() {',
    'trap cleanup EXIT INT TERM',
    'next start --hostname 127.0.0.1 --port 4181',
    'curl --fail --silent http://127.0.0.1:4181/',
    'TASK_FIRST_UI_URL=http://127.0.0.1:4181 node scripts/task-first-ui-guard.mjs',
    'CARBON_THEME_URL=http://127.0.0.1:4181 CARBON_QA_DIR=/tmp/carbon-console-qa node scripts/carbon-theme-ui-guard.mjs',
    'kill "$next_pid"',
    'wait "$next_pid"',
    'trap - EXIT INT TERM',
  ];
  let previousIndex = -1;
  for (const fragment of lifecycleOrder) {
    const index = lifecycle.indexOf(fragment, previousIndex + 1);
    assert.ok(index > previousIndex, `${fragment} missing or out of order`);
    previousIndex = index;
  }
  assert.match(workflow, /next-src\/tests\/editorial-ui-contract\.test\.mjs \\\n\s+next-src\/tests\/carbon-theme-contract\.test\.mjs/);
});

test('keeps protected GitHub Pages deployment out of pull request runs', () => {
  const workflow = readRepo('.github/workflows/deploy.yml');
  const deployJob = workflow.match(/\n  build-and-deploy:\n([\s\S]*)$/)?.[1];
  assert.ok(deployJob, 'missing build-and-deploy job');
  assert.match(deployJob, /^    if: github\.event_name != 'pull_request'$/m);
});
