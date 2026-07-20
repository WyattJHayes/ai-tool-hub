import { NextRequest, NextResponse } from 'next/server';
import { isRatingAggregate } from '@/lib/ratings';

// In-memory fallback
type Review = { score: number; tags: string[]; comment: string };
const toolRatings = new Map<number, Map<string, Review>>();

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const toolId = Number(url.searchParams.get('tool_id'));
  if (!toolId) return NextResponse.json({ error: 'tool_id required' }, { status: 400 });
  const anonymousReviews = Array.from(toolRatings.get(toolId)?.values() || []);

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
          const { error: writeError } = await supabase.from('ratings').upsert({
            user_id: user.id,
            tool_id: tool_id,
            score,
            tags: tags || [],
            comment: comment || '',
          }, { onConflict: 'user_id,tool_id' });
          if (writeError) return NextResponse.json({ error: 'Failed to save rating' }, { status: 502 });

          // Fetch updated aggregate
          const { data: tool, error: aggregateError } = await supabase
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
        }
      } catch {
        return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 });
      }
    }

    // Fallback: in-memory
    const sessionId = req.headers.get('x-session-id');
    if (!sessionId) return NextResponse.json({ error: 'x-session-id required' }, { status: 400 });
    if (!toolRatings.has(tool_id)) toolRatings.set(tool_id, new Map());
    const data = toolRatings.get(tool_id)!;
    data.set(sessionId, { score, tags: Array.isArray(tags) ? tags.slice(0, 10) : [], comment: typeof comment === 'string' ? comment.slice(0, 50) : '' });
    const reviews = Array.from(data.values());
    const avg = Number((reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(2));
    return NextResponse.json({ ok: true, avg_rating: avg, rating_count: reviews.length });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
