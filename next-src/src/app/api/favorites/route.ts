import { NextRequest, NextResponse } from 'next/server';
import {
  getSupabaseAdminQueryClient,
  requireSupabaseUser,
  ResumeApiError,
} from '@/server/supabase-admin';

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

function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof ResumeApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
}

export async function GET(req: NextRequest) {
  // Authenticated path: service-role client with explicit user scoping.
  if (req.headers.get('authorization')?.startsWith('Bearer ')) {
    try {
      const user = await requireSupabaseUser(req);
      const admin = getSupabaseAdminQueryClient();
      const { data, error } = await admin
        .from('favorites')
        .select('tool_id')
        .eq('user_id', user.id);
      if (error) return NextResponse.json({ error: 'Failed to load favorites' }, { status: 502 });
      const rows = (data as { tool_id: string }[] | null) || [];
      return NextResponse.json({ favorites: rows.map((row) => Number(row.tool_id)) });
    } catch (error) {
      return authErrorResponse(error);
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

    // Authenticated path: service-role client with explicit user scoping.
    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
      try {
        const user = await requireSupabaseUser(req);
        const admin = getSupabaseAdminQueryClient();

        let writeError: unknown;
        if (action === 'add') {
          ({ error: writeError } = await admin.from('favorites').upsert({
            user_id: user.id,
            tool_id: tool_id,
          }, { onConflict: 'user_id,tool_id' }));
        } else if (action === 'remove') {
          ({ error: writeError } = await admin.from('favorites').delete().match({
            user_id: user.id,
            tool_id: tool_id,
          }));
        }
        if (writeError) return NextResponse.json({ error: 'Failed to update favorites' }, { status: 502 });

        const { data, error } = await admin.from('favorites').select('tool_id').eq('user_id', user.id);
        if (error) return NextResponse.json({ error: 'Failed to load favorites' }, { status: 502 });
        const rows = (data as { tool_id: string }[] | null) || [];
        return NextResponse.json({ ok: true, favorites: rows.map((row) => Number(row.tool_id)) });
      } catch (error) {
        return authErrorResponse(error);
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
    if (action === 'add') favs.add(tool_id as number);
    else if (action === 'remove') favs.delete(tool_id as number);
    return NextResponse.json({ ok: true, favorites: Array.from(favs) });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
