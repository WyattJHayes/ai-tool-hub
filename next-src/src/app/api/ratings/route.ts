import { NextRequest, NextResponse } from 'next/server';
import { isRatingAggregate } from '@/lib/ratings';
import {
  getSupabaseAdminQueryClient,
  requireSupabaseUser,
  ResumeApiError,
} from '@/server/supabase-admin';
import { getToolReviews, storeAnonymousReview, type Review } from './fallback-store';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const toolId = Number(url.searchParams.get('tool_id'));
  if (!toolId) return NextResponse.json({ error: 'tool_id required' }, { status: 400 });
  const anonymousReviews: Review[] = getToolReviews(toolId);

  // Try Supabase for aggregate data
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: tool } = await supabase.from('tools').select('avg_rating, rating_count').eq('id', toolId).maybeSingle();
    const { data: reviews } = await supabase.from('ratings').select('score, tags, comment').eq('tool_id', toolId).order('created_at', { ascending: false }).limit(10);
    if (tool) {
      const persistedCount = Number(tool.rating_count || 0);
      const persistedAverage = Number(tool.avg_rating || 0);
      const anonymousTotal = anonymousReviews.reduce((sum, review) => sum + review.score, 0);
      const ratingCount = persistedCount + anonymousReviews.length;
      const averageRating = ratingCount > 0
        ? Number(((persistedAverage * persistedCount + anonymousTotal) / ratingCount).toFixed(2))
        : 0;
      return NextResponse.json({
        tool_id: toolId,
        avg_rating: averageRating,
        rating_count: ratingCount,
        reviews: [...anonymousReviews].reverse().concat(reviews || []).slice(0, 10),
      });
    }
  } catch { /* fallback */ }

  if (anonymousReviews.length === 0) return NextResponse.json({ tool_id: toolId, avg_rating: 0, rating_count: 0, reviews: [] });
  const avg = Number((anonymousReviews.reduce((sum, review) => sum + review.score, 0) / anonymousReviews.length).toFixed(2));
  return NextResponse.json({ tool_id: toolId, avg_rating: avg, rating_count: anonymousReviews.length, reviews: anonymousReviews.slice(-10).reverse() });
}

export async function POST(req: NextRequest) {
  try {
    const { tool_id, score, tags, comment } = await req.json();
    if (!Number.isInteger(tool_id) || tool_id <= 0 || !Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: 'tool_id and score (1-5) required' }, { status: 400 });
    }
    // comment/tags are OPTIONAL in the public contract (DB defaults to ''/[]);
    // validate only when present, then normalize for storage.
    if (comment !== undefined && (typeof comment !== 'string' || comment.length > 200)) {
      return NextResponse.json({ error: 'comment must be a string (max 200)' }, { status: 400 });
    }
    if (tags !== undefined && (!Array.isArray(tags) || tags.length > 10 || tags.some((t) => typeof t !== 'string' || t.length > 20))) {
      return NextResponse.json({ error: 'tags must be a string array (max 10)' }, { status: 400 });
    }
    const normalizedComment = comment ?? '';
    const normalizedTags = tags ?? [];

    // Try Supabase (authenticated path: service-role client with explicit user scoping)
    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
      try {
        const user = await requireSupabaseUser(req);
        const admin = getSupabaseAdminQueryClient();
        const { error: writeError } = await admin.from('ratings').upsert({
          user_id: user.id,
          tool_id: tool_id,
          score,
          tags: normalizedTags,
          comment: normalizedComment,
        }, { onConflict: 'user_id,tool_id' });
        if (writeError) return NextResponse.json({ error: 'Failed to save rating' }, { status: 502 });

        // Fetch updated aggregate
        const { data: tool, error: aggregateError } = await admin
          .from('tools')
          .select('avg_rating, rating_count')
          .eq('id', tool_id)
          .maybeSingle();
        const aggregate = {
          avg_rating: Number(tool?.avg_rating),
          rating_count: Number(tool?.rating_count),
        };
        if (aggregateError || aggregate.rating_count === 0 || !isRatingAggregate(aggregate)) {
          return NextResponse.json({ error: 'Failed to load rating aggregate' }, { status: 502 });
        }
        return NextResponse.json({ ok: true, ...aggregate });
      } catch (error) {
        if (error instanceof ResumeApiError) {
          return NextResponse.json({ error: error.message }, { status: error.status });
        }
        return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
      }
    }

    // Fallback: in-memory
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) return NextResponse.json({ error: 'x-session-id required' }, { status: 400 });
    storeAnonymousReview(tool_id, sessionId, { score, tags: normalizedTags, comment: normalizedComment });
    const reviews = getToolReviews(tool_id);
    const avg = Number((reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(2));
    return NextResponse.json({ ok: true, avg_rating: avg, rating_count: reviews.length });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
