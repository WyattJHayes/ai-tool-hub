import { NextRequest, NextResponse } from 'next/server';

// Fallback: in-memory favorites (for demo/no-auth mode)
const userFavorites = new Map<string, Set<number>>();
const MAX_FALLBACK_SESSIONS = 10_000;

function getSessionId(req: NextRequest): string | null {
  return req.headers.get('x-session-id');
}

function validateMutation(toolId: unknown, action: unknown): string | null {
  if (!Number.isInteger(toolId) || Number(toolId) <= 0) return 'valid tool_id required';
  if (action !== 'add' && action !== 'remove') return 'action must be add or remove';
  return null;
}

export async function GET(req: NextRequest) {
  // Try to get user from Supabase JWT
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
      if (authError || !user) return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
      if (user) {
        const { data, error } = await supabase
          .from('favorites')
          .select('tool_id')
          .eq('user_id', user.id);
        if (error) return NextResponse.json({ error: 'Failed to load favorites' }, { status: 502 });
        return NextResponse.json({ favorites: (data || []).map((r: { tool_id: string }) => Number(r.tool_id)) });
      }
    } catch {
      return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
    }
  }

  const sessionId = getSessionId(req);
  if (!sessionId) return NextResponse.json({ favorites: [] });
  const favs = userFavorites.get(sessionId) || new Set();
  return NextResponse.json({ favorites: Array.from(favs) });
}

export async function POST(req: NextRequest) {
  try {
    const { tool_id, action } = await req.json();
    const validationError = validateMutation(tool_id, action);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    // Try Supabase
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7));
        if (authError || !user) return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
        if (user) {
          let writeError;
          if (action === 'add') {
            ({ error: writeError } = await supabase.from('favorites').upsert({
              user_id: user.id, tool_id: tool_id,
            }, { onConflict: 'user_id,tool_id' }));
          } else if (action === 'remove') {
            ({ error: writeError } = await supabase.from('favorites').delete().match({
              user_id: user.id, tool_id: tool_id,
            }));
          }
          if (writeError) return NextResponse.json({ error: 'Failed to update favorites' }, { status: 502 });
          // Return updated list
          const { data, error } = await supabase.from('favorites').select('tool_id').eq('user_id', user.id);
          if (error) return NextResponse.json({ error: 'Failed to load favorites' }, { status: 502 });
          return NextResponse.json({ ok: true, favorites: (data || []).map((r: { tool_id: string }) => Number(r.tool_id)) });
        }
      } catch {
        return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
      }
    }

    // Fallback: in-memory
    const sessionId = getSessionId(req);
    if (!sessionId) return NextResponse.json({ error: 'x-session-id required' }, { status: 400 });
    if (!userFavorites.has(sessionId) && userFavorites.size >= MAX_FALLBACK_SESSIONS) {
      userFavorites.delete(userFavorites.keys().next().value as string);
    }
    if (!userFavorites.has(sessionId)) userFavorites.set(sessionId, new Set());
    const favs = userFavorites.get(sessionId)!;
    if (action === 'add') favs.add(tool_id);
    else if (action === 'remove') favs.delete(tool_id);
    return NextResponse.json({ ok: true, favorites: Array.from(favs) });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
