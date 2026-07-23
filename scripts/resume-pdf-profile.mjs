const INK_RATIO_MIN = 0.65;
const INK_RATIO_MAX = 1.45;
const PROFILE_DIFFERENCE_MAX = 0.08;
const PROFILE_DISPLACEMENT_MAX = 0.05;
const BACKGROUND_DISTANCE = 24;
const COLOR_BUCKET_SHIFT = 4;

function dominantBackground(sample, pixelCount) {
  const buckets = new Map();
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 3;
    const key = (sample[offset] >> COLOR_BUCKET_SHIFT) << 8
      | (sample[offset + 1] >> COLOR_BUCKET_SHIFT) << 4
      | (sample[offset + 2] >> COLOR_BUCKET_SHIFT);
    const bucket = buckets.get(key) || { count: 0, red: 0, green: 0, blue: 0 };
    bucket.count += 1;
    bucket.red += sample[offset];
    bucket.green += sample[offset + 1];
    bucket.blue += sample[offset + 2];
    buckets.set(key, bucket);
  }
  const dominant = [...buckets.values()].reduce((largest, bucket) => (
    !largest || bucket.count > largest.count ? bucket : largest
  ), null);
  return [
    dominant.red / dominant.count,
    dominant.green / dominant.count,
    dominant.blue / dominant.count,
  ];
}

function colorDistanceSquared(sample, offset, background) {
  const red = sample[offset] - background[0];
  const green = sample[offset + 1] - background[1];
  const blue = sample[offset + 2] - background[2];
  return (red * red) + (green * green) + (blue * blue);
}

export function inkProfile(sample, width, height) {
  const pixelCount = width * height;
  if (sample.length !== pixelCount * 3) throw new RangeError('structural sample must contain three RGB channels per pixel');
  const background = dominantBackground(sample, pixelCount);
  const rows = Array.from({ length: height }, () => 0);
  const columns = Array.from({ length: width }, () => 0);
  let count = 0;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 3;
    const row = Math.floor(pixel / width);
    const column = pixel % width;
    if (row === 0 || row === height - 1 || column === 0 || column === width - 1) continue;
    if (colorDistanceSquared(sample, offset, background) <= BACKGROUND_DISTANCE ** 2) continue;
    rows[row] += 1;
    columns[column] += 1;
    count += 1;
  }
  return { columns, count, rows };
}

function normalizedProfileDifference(left, right, scale) {
  return left.reduce((total, value, index) => total + Math.abs(value - right[index]) / scale, 0) / left.length;
}

function profileCentroid(profile, count) {
  if (count === 0) return 0;
  return profile.reduce((total, value, index) => total + (value * index), 0) / count;
}

export function analyzeStructuralSimilarity(sourceSample, renderedSample, width, height) {
  const sourceInk = inkProfile(sourceSample, width, height);
  const renderedInk = inkProfile(renderedSample, width, height);
  const inkRatio = sourceInk.count > 0 ? renderedInk.count / sourceInk.count : 0;
  const rowDifference = normalizedProfileDifference(sourceInk.rows, renderedInk.rows, width);
  const columnDifference = normalizedProfileDifference(sourceInk.columns, renderedInk.columns, height);
  const rowDisplacement = Math.abs(
    profileCentroid(sourceInk.rows, sourceInk.count) - profileCentroid(renderedInk.rows, renderedInk.count),
  ) / height;
  const columnDisplacement = Math.abs(
    profileCentroid(sourceInk.columns, sourceInk.count) - profileCentroid(renderedInk.columns, renderedInk.count),
  ) / width;
  return {
    columnDifference,
    columnDisplacement,
    inkRatio,
    matches: sourceInk.count > 0
      && renderedInk.count > 0
      && inkRatio >= INK_RATIO_MIN
      && inkRatio <= INK_RATIO_MAX
      && rowDifference <= PROFILE_DIFFERENCE_MAX
      && columnDifference <= PROFILE_DIFFERENCE_MAX
      && rowDisplacement <= PROFILE_DISPLACEMENT_MAX
      && columnDisplacement <= PROFILE_DISPLACEMENT_MAX,
    renderedInk,
    rowDifference,
    rowDisplacement,
    sourceInk,
  };
}
