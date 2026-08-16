import { NextRequest, NextResponse } from 'next/server';

// In-memory click counter (resets on deploy; replaced by Supabase when configured)
const clickCounts = new Map<string, number>();
const MAX_CLICK_KEYS = 50_000;

function normalizeClickKey(toolId: unknown, toolSlug: unknown): string | null {
  if (typeof toolId === 'number' && Number.isInteger(toolId) && toolId > 0) return `id:${toolId}`;
  if (typeof toolSlug === 'string' && /^[\w.-]{1,128}$/.test(toolSlug)) {
    return `slug:${toolSlug.toLowerCase()}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tool_id, tool_slug } = body;

    const key = normalizeClickKey(tool_id, tool_slug);
    if (!key) {
      return NextResponse.json({ error: 'tool_id or tool_slug required' }, { status: 400 });
    }

    if (!clickCounts.has(key) && clickCounts.size >= MAX_CLICK_KEYS) {
      clickCounts.delete(clickCounts.keys().next().value as string);
    }
    clickCounts.set(key, (clickCounts.get(key) || 0) + 1);

    // When Supabase is configured, also write to DB
    // import { getSupabase } from '@/lib/supabase';
    // const supabase = getSupabase();
    // await supabase.from('click_logs').insert({ tool_slug, from_page, from_section });

    return NextResponse.json({ ok: true, count: clickCounts.get(key) });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ clicks: Object.fromEntries(clickCounts) });
}
