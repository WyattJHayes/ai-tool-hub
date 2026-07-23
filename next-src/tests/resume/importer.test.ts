import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractResumeFile,
  parseResumeTextLocally,
  ResumeImportError,
  type ResumeTextExtractors,
} from '../../src/features/resume/importer';

interface FakeFile extends Pick<File, 'name' | 'size' | 'text' | 'arrayBuffer'> {}

function fakeFile(name: string, size: number, contents = ''): FakeFile {
  return {
    name,
    size,
    text: async () => contents,
    arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
  };
}

test('rejects old DOC, oversized, and empty extraction without changing editor state', async () => {
  await assert.rejects(() => extractResumeFile(fakeFile('cv.doc', 10) as File), /另存为 \.docx/);
  await assert.rejects(() => extractResumeFile(fakeFile('cv.pdf', 10 * 1024 * 1024 + 1) as File), /10 MB/);
  await assert.rejects(() => extractResumeFile(fakeFile('cv.txt', 0, '') as File), /没有可提取文本/);
});

test('dispatches PDF, DOCX, TXT, HTML, and Markdown to browser extractors', async () => {
  const extractor = async (file: File) => `${file.name.split('.').at(-1)} text`;
  const extractors: ResumeTextExtractors = {
    pdf: extractor,
    docx: extractor,
    txt: extractor,
    html: extractor,
    htm: extractor,
    md: extractor,
    markdown: extractor,
  };

  for (const name of ['cv.pdf', 'cv.docx', 'cv.txt', 'cv.html', 'cv.md']) {
    const extracted = await extractResumeFile(fakeFile(name, 10) as File, extractors);
    assert.equal(extracted.fileName, name);
    assert.equal(extracted.text, `${name.split('.').at(-1)} text`);
  }
});

test('extracts TXT and Markdown with the default local extractors', async () => {
  const text = await extractResumeFile(fakeFile('cv.txt', 12, 'Plain resume') as File);
  const markdown = await extractResumeFile(fakeFile('cv.md', 18, '# Resume\n**Wei**') as File);

  assert.equal(text.text, 'Plain resume');
  assert.equal(markdown.text, '# Resume\n**Wei**');
});

test('extracts inert HTML text with the default browser extractor', async () => {
  const originalDomParser = globalThis.DOMParser;
  class TestDomParser {
    parseFromString(source: string) {
      return { body: { textContent: source.replace(/<[^>]*>/g, '') } };
    }
  }
  Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: TestDomParser });

  try {
    const extracted = await extractResumeFile(
      fakeFile('cv.html', 42, '<h1>Wei</h1><script>alert(1)</script><p>Engineer</p>') as File,
    );
    assert.equal(extracted.text, 'Weialert(1)Engineer');
  } finally {
    Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: originalDomParser });
  }
});

test('rejects unsupported files and caps extracted text at 50,000 characters', async () => {
  await assert.rejects(
    () => extractResumeFile(fakeFile('cv.rtf', 10, 'text') as File),
    ResumeImportError,
  );

  const extracted = await extractResumeFile(fakeFile('cv.markdown', 50_001, 'x'.repeat(50_001)) as File);
  assert.equal(extracted.text.length, 50_000);
});

test('parses contact details, experience, education, and skills locally', () => {
  const document = parseResumeTextLocally(`
Wei Jiahao
wei@example.com | +86 138 0013 8000

Experience
Acme Inc | Senior Engineer | 2022.01 - Present
Built a resilient local editor.

Education
Example University | Computer Science | Bachelor | 2016.09 - 2020.06

Skills
TypeScript, React, Product design
`);

  assert.equal(document.profile.fullName, 'Wei Jiahao');
  assert.equal(document.profile.email, 'wei@example.com');
  assert.match(document.profile.phone, /138 0013 8000/);
  assert.deepEqual(document.experience.map(item => [item.company, item.role]), [['Acme Inc', 'Senior Engineer']]);
  assert.deepEqual(document.education.map(item => [item.school, item.major]), [['Example University', 'Computer Science']]);
  assert.deepEqual(document.skills, ['TypeScript', 'React', 'Product design']);
});
