import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const projectUrl = new URL('../../', import.meta.url);

function projectFile(path) {
  return new URL(path, projectUrl);
}

test('serves disabled resume plan availability from a real route', () => {
  const routeUrl = projectFile('src/app/api/resume/plans/route.ts');
  assert.equal(existsSync(routeUrl), true, 'missing /api/resume/plans route');

  const source = readFileSync(routeUrl, 'utf8');
  assert.match(source, /export async function GET|export const GET/);
  assert.match(source, /dailyQuota/);
  assert.match(source, /enabled:\s*false/);
});

test('configures PDF.js CMaps and standard fonts from generated public assets', () => {
  const importer = readFileSync(projectFile('src/features/resume/importer.ts'), 'utf8');
  assert.match(importer, /cMapUrl:\s*['"]\/pdfjs\/cmaps\/['"]/);
  assert.match(importer, /cMapPacked:\s*true/);
  assert.match(importer, /standardFontDataUrl:\s*['"]\/pdfjs\/standard_fonts\/['"]/);

  const copyScriptUrl = projectFile('scripts/copy-pdfjs-assets.mjs');
  assert.equal(existsSync(copyScriptUrl), true, 'missing PDF.js asset copy script');
  const copyScript = readFileSync(copyScriptUrl, 'utf8');
  assert.match(copyScript, /pdfjs-dist[\s\S]*cmaps/);
  assert.match(copyScript, /pdfjs-dist[\s\S]*standard_fonts/);

  const packageJson = JSON.parse(readFileSync(projectFile('package.json'), 'utf8'));
  assert.match(packageJson.scripts.predev, /copy-pdfjs-assets/);
  assert.match(packageJson.scripts.prebuild, /copy-pdfjs-assets/);
});
