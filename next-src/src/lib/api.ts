// API client for AI Tool Hub
// All methods gracefully degrade to local operation when backend isn't available

const SESSION_KEY = 'ai-tool-hub-session-id';

type SecureCrypto = {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
};

export function createAnonymousSessionId(cryptoApi: SecureCrypto | undefined = globalThis.crypto): string | null {
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (!cryptoApi?.getRandomValues) return null;

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getAnonymousSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
      sessionId = createAnonymousSessionId();
      if (!sessionId) return null;
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
