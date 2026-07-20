export interface RatingAggregate {
  avg_rating: number;
  rating_count: number;
}

export function isRatingAggregate(value: unknown): value is RatingAggregate {
  if (!value || typeof value !== 'object') return false;
  const aggregate = value as Record<string, unknown>;
  if (
    typeof aggregate.avg_rating !== 'number' ||
    !Number.isFinite(aggregate.avg_rating) ||
    aggregate.avg_rating < 0 ||
    aggregate.avg_rating > 5
  ) return false;
  if (
    typeof aggregate.rating_count !== 'number' ||
    !Number.isInteger(aggregate.rating_count) ||
    aggregate.rating_count < 0
  ) return false;
  return aggregate.rating_count === 0 ? aggregate.avg_rating === 0 : aggregate.avg_rating >= 1;
}
