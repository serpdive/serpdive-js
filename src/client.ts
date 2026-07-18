/**
 * The SERPdive client for POST api.serpdive.com/v1/search.
 *
 * Retry policy: 502/503 responses and network errors are retried (the API
 * never bills failed requests, so retrying is always safe). 4xx errors are
 * never retried: the request itself is wrong, or the account is out of
 * credits, and replaying it cannot help.
 */

import { errorFromResponse, ServerError, SerpDiveError } from "./errors.js";
import type { SearchOptions, SearchResponse } from "./types.js";

export const DEFAULT_BASE_URL = "https://api.serpdive.com";
/** Moby reads whole pages; the docs recommend an 80 s client timeout. */
export const DEFAULT_TIMEOUT_MS = 90_000;
export const DEFAULT_MAX_RETRIES = 2;

const RETRYABLE_STATUSES = new Set([502, 503]);

export interface SerpDiveClientOptions {
  /** Defaults to the SERPDIVE_API_KEY environment variable. */
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  /** Extra attempts after the first, on 502/503 and network errors only. */
  maxRetries?: number;
  /** Custom fetch implementation (testing, polyfills). */
  fetch?: typeof globalThis.fetch;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response | undefined, attempt: number): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds, 10) * 1000;
  }
  return 500 * 2 ** attempt;
}

export class SerpDive {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: SerpDiveClientOptions = {}) {
    const key =
      options.apiKey ??
      (typeof process !== "undefined" ? process.env?.SERPDIVE_API_KEY : undefined);
    if (!key) {
      throw new SerpDiveError(
        "No API key. Pass { apiKey } or set the SERPDIVE_API_KEY environment " +
          "variable. Create a key at https://serpdive.com/dashboard/keys",
      );
    }
    this.apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
  }

  /**
   * Run one search.
   *
   * @param query What you want to know, plain natural language.
   * @param options model, answer, maxResults; extra keys are sent verbatim.
   */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const { model, answer, maxResults, ...extra } = options;
    const payload: Record<string, unknown> = { query, ...extra };
    if (model !== undefined) payload.model = model;
    if (answer !== undefined) payload.answer = answer;
    if (maxResults !== undefined) payload.max_results = maxResults;

    let lastError: SerpDiveError | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/v1/search`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (cause) {
        lastError = new SerpDiveError(`Could not reach the API: ${String(cause)}`);
        if (attempt < this.maxRetries) {
          await sleep(retryDelayMs(undefined, attempt));
          continue;
        }
        throw lastError;
      }

      if (response.ok) {
        let data: unknown;
        try {
          data = await response.json();
        } catch {
          throw new SerpDiveError("The API returned a non-JSON response.", {
            statusCode: response.status,
          });
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new SerpDiveError("The API returned an unexpected payload shape.", {
            statusCode: response.status,
          });
        }
        return data as SearchResponse;
      }

      let errorPayload: unknown;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = undefined;
      }
      const err = errorFromResponse(response.status, errorPayload);
      if (err instanceof ServerError && RETRYABLE_STATUSES.has(response.status)) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await sleep(retryDelayMs(response, attempt));
          continue;
        }
      }
      throw err;
    }
    throw lastError ?? new SerpDiveError("Search failed.");
  }
}
