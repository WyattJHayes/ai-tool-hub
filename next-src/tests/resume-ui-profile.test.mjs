import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeStructuralSimilarity, inkProfile } from '../../scripts/resume-pdf-profile.mjs';

const width = 120;
const height = 160;
const background = [232, 247, 251];
const ink = [24, 39, 48];
const layout = [
  [10, 12, 85, 7],
  [10, 28, 75, 6],
  [10, 43, 90, 6],
  [10, 61, 80, 6],
  [10, 79, 88, 6],
  [10, 98, 70, 6],
  [10, 116, 86, 6],
  [10, 135, 65, 6],
];

function syntheticImage(blocks = layout, {
  backgroundColor = background,
  backgroundNoise = false,
  inkColor = ink,
} = {}) {
  const sample = Buffer.alloc(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 3;
    const variation = backgroundNoise ? (pixel % 5) - 2 : 0;
    sample[offset] = backgroundColor[0] + variation;
    sample[offset + 1] = backgroundColor[1] + variation;
    sample[offset + 2] = backgroundColor[2] + variation;
  }
  for (const [left, top, blockWidth, blockHeight] of blocks) {
    for (let y = Math.max(0, top); y < Math.min(height, top + blockHeight); y += 1) {
      for (let x = Math.max(0, left); x < Math.min(width, left + blockWidth); x += 1) {
        const offset = ((y * width) + x) * 3;
        sample[offset] = inkColor[0];
        sample[offset + 1] = inkColor[1];
        sample[offset + 2] = inkColor[2];
      }
    }
  }
  return sample;
}

test('accepts equivalent source and exported content layouts', () => {
  const exported = syntheticImage(layout, {
    backgroundColor: [247, 242, 236],
    backgroundNoise: true,
    inkColor: [31, 43, 52],
  });
  const result = analyzeStructuralSimilarity(syntheticImage(), exported, width, height);

  assert.equal(result.matches, true);
  assert.equal(result.inkRatio, 1);
  assert.equal(result.rowDifference, 0);
  assert.equal(result.columnDifference, 0);
});

test('rejects substantial content removal', () => {
  const result = analyzeStructuralSimilarity(syntheticImage(), syntheticImage(layout.slice(0, 3)), width, height);

  assert.equal(result.matches, false);
});

test('rejects right-edge clipping', () => {
  const clipped = layout.map(([left, top, blockWidth, blockHeight]) => (
    [left, top, Math.max(0, Math.min(blockWidth, 55 - left)), blockHeight]
  ));
  const result = analyzeStructuralSimilarity(syntheticImage(), syntheticImage(clipped), width, height);

  assert.equal(result.matches, false);
});

test('rejects vertical content displacement', () => {
  const shifted = layout.map(([left, top, blockWidth, blockHeight]) => [left, top + 16, blockWidth, blockHeight]);
  const result = analyzeStructuralSimilarity(syntheticImage(), syntheticImage(shifted), width, height);

  assert.equal(result.matches, false);
});

test('rejects horizontal content displacement', () => {
  const shifted = layout.map(([left, top, blockWidth, blockHeight]) => [left + 15, top, blockWidth, blockHeight]);
  const result = analyzeStructuralSimilarity(syntheticImage(), syntheticImage(shifted), width, height);

  assert.equal(result.matches, false);
});

test('does not classify a low-variation tinted page background as ink', () => {
  const profile = inkProfile(syntheticImage([], { backgroundNoise: true }), width, height);

  assert.equal(profile.count, 0);
  assert.deepEqual(profile.rows, Array.from({ length: height }, () => 0));
  assert.deepEqual(profile.columns, Array.from({ length: width }, () => 0));
});

test('does not classify the outer page frame as resume content', () => {
  const framed = syntheticImage([]);
  for (let x = 0; x < width; x += 1) {
    const offset = (((height - 1) * width) + x) * 3;
    framed[offset] = ink[0];
    framed[offset + 1] = ink[1];
    framed[offset + 2] = ink[2];
  }
  for (let y = 0; y < height; y += 1) {
    const offset = ((y * width) + width - 1) * 3;
    framed[offset] = ink[0];
    framed[offset + 1] = ink[1];
    framed[offset + 2] = ink[2];
  }

  assert.equal(inkProfile(framed, width, height).count, 0);
});
