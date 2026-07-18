// API client for AI Tool Hub
// All methods gracefully degrade to local operation when backend isn't available

const SESSION_KEY = 'ai-tool-hub-session-id';

function getAnonymousSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, sessionId);
    }
    return sessionId;
  } catch {
    return null;
  }
}

async function getApiHeaders(json = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';

  const sessionId = getAnonymousSessionId();
  if (sessionId) headers['x-session-id'] = sessionId;

  if (typeof window !== 'undefined') {
    const { supabase } = await import('@/lib/supabase');
    if (!supabase) return headers;
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      headers.Authorization = `Bearer ${data.session.access_token}`;
    }
  }
  return headers;
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  return response.ok ? data : { ...data, ok: false };
}

export async function trackClick(toolId: number, toolSlug: string, fromPage?: string, fromSection?: string) {
  try {
    await fetch('/api/track/click', {
      method: 'POST',
      headers: await getApiHeaders(true),
      body: JSON.stringify({ tool_id: toolId, tool_slug: toolSlug, from_page: fromPage, from_section: fromSection }),
    });
  } catch {
    // Silently fail — analytics shouldn't break UX
  }
}

export async function toggleFavoriteAPI(toolId: number, action: 'add' | 'remove') {
  try {
    const res = await fetch('/api/favorites', {
      method: 'POST',
      headers: await getApiHeaders(true),
      body: JSON.stringify({ tool_id: toolId, action }),
    });
    return await readJson(res);
  } catch {
    return { ok: false };
  }
}

export async function getFavoritesAPI() {
  try {
    const res = await fetch('/api/favorites', { headers: await getApiHeaders() });
    return await readJson(res);
  } catch {
    return { favorites: [] };
  }
}

export async function submitRating(toolId: number, score: number, tags?: string[], comment?: string) {
  try {
    const res = await fetch('/api/ratings', {
      method: 'POST',
      headers: await getApiHeaders(true),
      body: JSON.stringify({ tool_id: toolId, score, tags, comment }),
    });
    return await readJson(res);
  } catch {
    return { ok: false };
  }
}

export async function getRatings(toolId: number) {
  try {
    const res = await fetch(`/api/ratings?tool_id=${toolId}`);
    return await res.json();
  } catch {
    return { avg_rating: 0, rating_count: 0, reviews: [] };
  }
}

export async function searchAPI(query: string, filters?: { category?: string; price?: string; origin?: string; page?: number; limit?: number }) {
  try {
    const params = new URLSearchParams({ q: query });
    if (filters?.category) params.set('category', filters.category);
    if (filters?.price) params.set('price', filters.price);
    if (filters?.origin) params.set('origin', filters.origin);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit) params.set('limit', String(filters.limit));
    const res = await fetch(`/api/search?${params}`);
    return await res.json();
  } catch {
    return { total: 0, results: [], facets: { categories: {}, price: {} } };
  }
}
