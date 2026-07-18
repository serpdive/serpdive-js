/**
 * Typed errors mapped from the API's stable error codes.
 *
 * Every non-200 response carries `{ error: <stable code>, message: <human,
 * actionable sentence> }`. The code decides the class; the message is
 * surfaced verbatim so the fix is always in the stack trace.
 */

export class SerpDiveError extends Error {
  /** stable machine-readable code, e.g. "invalid_api_key" */
  code?: string;
  /** HTTP status of the failing response, when there was one */
  statusCode?: number;

  constructor(message: string, opts: { code?: string; statusCode?: number } = {}) {
    super(message);
    this.name = new.target.name;
    this.code = opts.code;
    this.statusCode = opts.statusCode;
  }
}

/** Missing, invalid, or revoked API key (`missing_api_key`, `invalid_api_key`). */
export class AuthenticationError extends SerpDiveError {}

/** The request itself is malformed (`invalid_json`, `missing_query`). */
export class InvalidRequestError extends SerpDiveError {}

/** Too many requests per second/minute (`rate_limit_exceeded`). Slow down and retry. */
export class RateLimitError extends SerpDiveError {}

/** Monthly credits exhausted (`monthly_quota_exceeded`). Upgrade or wait for renewal. */
export class QuotaExceededError extends SerpDiveError {}

/** Transient service failure (`server_busy`, `search_failed`). Never billed; safe to retry. */
export class ServerError extends SerpDiveError {}

const CODE_TO_ERROR: Record<string, typeof SerpDiveError> = {
  missing_api_key: AuthenticationError,
  invalid_api_key: AuthenticationError,
  invalid_json: InvalidRequestError,
  missing_query: InvalidRequestError,
  rate_limit_exceeded: RateLimitError,
  monthly_quota_exceeded: QuotaExceededError,
  server_busy: ServerError,
  search_failed: ServerError,
};

export function errorFromResponse(statusCode: number, payload: unknown): SerpDiveError {
  let code: string | undefined;
  let message = `Unexpected API response (HTTP ${statusCode}).`;
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    if (typeof p.error === "string") code = p.error;
    if (typeof p.message === "string" && p.message) message = p.message;
  }
  let cls = code ? CODE_TO_ERROR[code] : undefined;
  if (!cls) {
    if (statusCode === 401) cls = AuthenticationError;
    else if (statusCode === 400) cls = InvalidRequestError;
    else if (statusCode === 429) cls = RateLimitError;
    else if (statusCode >= 500) cls = ServerError;
    else cls = SerpDiveError;
  }
  return new cls(message, { code, statusCode });
}
