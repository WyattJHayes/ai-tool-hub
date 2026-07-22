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

  constructor(code: string, status: number, message = DEFAULT_MESSAGES[code] ?? 'The request could not be completed.') {
    super(message);
    this.name = 'ResumeApiError';
    this.code = code;
    this.status = status;
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
