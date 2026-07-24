function dailyQuota(source: NodeJS.ProcessEnv = process.env): number {
  const value = source.DAILY_QUOTA?.trim() ?? '';
  if (!/^[1-9]\d*$/.test(value)) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export async function GET(): Promise<Response> {
  return Response.json(
    {
      dailyQuota: dailyQuota(),
      xddpay: { enabled: false },
    },
    {
      headers: {
        'cache-control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  );
}
