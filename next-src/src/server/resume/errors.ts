import 'server-only';

const DEFAULT_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Authentication is required.',
  AUTH_INVALID: 'Authentication could not be verified.',
  QUOTA_EXHAUSTED: 'No resume quota remains for this request.',
  QUOTA_INVALID_REQUEST: 'The quota request is invalid.',
  QUOTA_RESERVATION_NOT_FOUND: 'The quota reservation was not found.',
  QUOTA_ALREADY_SETTLED: 'The quota reservation was already settled.',
  QUOTA_ACCOUNT_INVALID: 'The resume quota account is unavailable.',
  QUOTA_UNAVAILABLE: 'The resume quota service is unavailable.',
  REQUEST_INVALID: 'The request is invalid.',
  RATE_LIMITED: 'Too many resume requests. Please retry shortly.',
  AI_UPSTREAM: 'The AI service is unavailable.',
  AI_TIMEOUT: 'The AI request timed out.',
  AI_INVALID_RESPONSE: 'The AI service returned an invalid response.',
  AI_CANCELLED: 'The AI request was cancelled.',
  STREAM_INCOMPLETE: 'The AI stream ended before completion.',
  INTERNAL_ERROR: 'The request could not be completed.',
};

export interface ResumeErrorBody {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}

export class ResumeApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Seconds until the caller may retry; only set for RATE_LIMITED. */
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    status: number,
    message = DEFAULT_MESSAGES[code] ?? 'The request could not be completed.',
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ResumeApiError';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function toResumeErrorBody(error: ResumeApiError, requestId: string): ResumeErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      requestId,
    },
  };
}

/** Response headers that accompany an error, such as Retry-After on throttling. */
export function toResumeErrorHeaders(error: ResumeApiError): Record<string, string> {
  return error.retryAfterSeconds === undefined
    ? {}
    : { 'Retry-After': String(error.retryAfterSeconds) };
}
