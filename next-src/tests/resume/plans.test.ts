import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../../src/app/api/resume/plans/route';

test('returns public plan availability without enabling the payment channel', async () => {
  const previousQuota = process.env.DAILY_QUOTA;
  process.env.DAILY_QUOTA = '3';

  try {
    const response = await GET();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /max-age=60/);
    assert.deepEqual(await response.json(), {
      dailyQuota: 3,
      xddpay: { enabled: false },
    });
  } finally {
    if (previousQuota === undefined) delete process.env.DAILY_QUOTA;
    else process.env.DAILY_QUOTA = previousQuota;
  }
});
