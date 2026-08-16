// Auth utilities for Supabase integration
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export type { User } from '@supabase/supabase-js';

export function getSession() {
  if (!supabase) return null;
  return supabase.auth.getSession();
}

export async function getUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

// D-06: Migrate localStorage favorites/ratings to Supabase
export async function migrateLocalDataToCloud(
  userId: string,
  favorites: number[],
  ratings: Record<number, number>
) {
  if (!supabase) return;

  // Migrate favorites
  for (const toolId of favorites) {
    // Get tool slug from tools data
    try {
      const { data: tools } = await supabase
        .from('tools')
        .select('id')
        .eq('id', toolId)
        .maybeSingle();

      if (tools) {
        await supabase.from('favorites').upsert({
          user_id: userId,
          tool_id: toolId,
        }, { onConflict: 'user_id,tool_id' });
      }
    } catch { /* skip */ }
  }

  // Migrate ratings
  for (const [toolIdStr, score] of Object.entries(ratings)) {
    const toolId = Number(toolIdStr);
    try {
      await supabase.from('ratings').upsert({
        user_id: userId,
        tool_id: toolId,
        score,
        tags: [],
      }, { onConflict: 'user_id,tool_id' });
    } catch { /* skip */ }
  }
}

// Fetch user's cloud favorites
export async function fetchCloudFavorites(userId: string): Promise<number[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('favorites')
    .select('tool_id')
    .eq('user_id', userId);
  return (data || []).map((r: { tool_id: string }) => Number(r.tool_id));
}

// Fetch user's cloud ratings
export async function fetchCloudRatings(userId: string): Promise<Record<number, number>> {
  if (!supabase) return {};
  const { data } = await supabase
    .from('ratings')
    .select('tool_id, score')
    .eq('user_id', userId);
  const result: Record<number, number> = {};
  (data || []).forEach((r: { tool_id: string; score: number }) => {
    result[Number(r.tool_id)] = r.score;
  });
  return result;
}
