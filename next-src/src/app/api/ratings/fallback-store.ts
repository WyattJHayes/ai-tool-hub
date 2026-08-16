/**
 * Anonymous (x-session-id) ratings fallback store.
 *
 * Pure module: no next/server, no server-only, no path aliases — keeps the
 * bounded-store contract directly unit-testable in node:test.
 *
 * Before [A2] the nested Map grew without bound: any client could append
 * unlimited entries via arbitrary session ids. The store now FIFO-evicts
 * past a global cap, mirroring the track/click cache pattern.
 */

export type Review = { score: number; tags: string[]; comment: string };

const toolRatings = new Map<number, Map<string, Review>>();

/** Bounds worst-case memory for the anonymous demo fallback. */
export const MAX_FALLBACK_REVIEWS = 10_000;

export function countFallbackReviews(): number {
  let total = 0;
  for (const sessions of toolRatings.values()) total += sessions.size;
  return total;
}

export function getToolReviews(toolId: number): Review[] {
  return Array.from(toolRatings.get(toolId)?.values() ?? []);
}

/** Stores a review, FIFO-evicting the oldest entry once the cap is exceeded. */
export function storeAnonymousReview(toolId: number, sessionId: string, review: Review): void {
  let sessions = toolRatings.get(toolId);
  if (!sessions) {
    sessions = new Map();
    toolRatings.set(toolId, sessions);
  }
  sessions.set(sessionId, review);

  let total = countFallbackReviews();
  while (total > MAX_FALLBACK_REVIEWS) {
    let evicted = false;
    for (const [id, toolSessions] of toolRatings) {
      const oldest = toolSessions.keys().next().value;
      if (oldest !== undefined) {
        toolSessions.delete(oldest);
        total -= 1;
        evicted = true;
      }
      if (toolSessions.size === 0) toolRatings.delete(id);
      break;
    }
    if (!evicted) break;
  }
}
