import { cp, mkdir, rm } from 'node:fs/promises';

const packageRoot = new URL('../node_modules/pdfjs-dist/', import.meta.url);
const publicRoot = new URL('../public/pdfjs/', import.meta.url);

await rm(publicRoot, { recursive: true, force: true });
await mkdir(publicRoot, { recursive: true });

for (const directory of ['cmaps', 'standard_fonts']) {
  await cp(
    new URL(`${directory}/`, packageRoot),
    new URL(`${directory}/`, publicRoot),
    { recursive: true, force: true },
  );
}
