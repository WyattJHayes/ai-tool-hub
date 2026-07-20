import { lstat, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const lexicalTmpRoot = path.resolve('/tmp');

function isWithinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function validateQaDir(candidate) {
  const normalized = path.resolve(candidate);
  const relative = path.relative(lexicalTmpRoot, normalized);
  if (relative === '' || !isWithinRoot(lexicalTmpRoot, normalized)) {
    throw new Error(`CARBON_QA_DIR must resolve to a non-root descendant of /tmp/: ${candidate}`);
  }
  return normalized;
}

async function ensureDirectory(candidate) {
  let metadata;
  try {
    metadata = await lstat(candidate);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    try {
      await mkdir(candidate);
    } catch (mkdirError) {
      if (mkdirError?.code !== 'EEXIST') throw mkdirError;
    }
    metadata = await lstat(candidate);
  }

  if (metadata.isSymbolicLink()) {
    throw new Error(`CARBON_QA_DIR contains a symbolic link: ${candidate}`);
  }
  if (!metadata.isDirectory()) {
    throw new Error(`CARBON_QA_DIR ancestor is not a directory: ${candidate}`);
  }
}

export async function prepareQaDir(candidate) {
  const normalized = validateQaDir(candidate);
  const trustedTmpRoot = await realpath(lexicalTmpRoot);
  const segments = path.relative(lexicalTmpRoot, normalized).split(path.sep);
  let currentRealPath = trustedTmpRoot;

  for (const segment of segments) {
    const descendant = path.join(currentRealPath, segment);
    await ensureDirectory(descendant);
    const realDescendant = await realpath(descendant);
    if (!isWithinRoot(trustedTmpRoot, realDescendant) || realDescendant === trustedTmpRoot) {
      throw new Error(`CARBON_QA_DIR resolves outside trusted /tmp/: ${candidate}`);
    }
    currentRealPath = realDescendant;
  }

  return normalized;
}
