/**
 * Typed request options and response objects, mirroring the frozen v1
 * contract. The source of truth is https://api.serpdive.com/openapi.json.
 * Response fields keep the API's own names verbatim (snake_case).
 */

export type SearchModel = "mako" | "moby";

export interface SearchOptions {
  /** "mako" (fast, the default) or "moby" (reads whole pages). */
  model?: SearchModel;
  /** Set true to also get a written answer built from the sources. */
  answer?: boolean;
  /** Hard cap on delivered results (1-10). Sent as `max_results`. */
  maxResults?: number;
  /** Forward-compatibility escape hatch: any extra key is sent verbatim. */
  [key: string]: unknown;
}

/** One delivered result: extracted, cleaned page content. */
export interface SearchResult {
  url: string;
  title: string | null;
  /** publication date when known, always ISO `YYYY-MM-DD` */
  date?: string;
  content: string;
}

/** Structured direct-answer block (weather, rates, scores...) when the query has one. */
export interface ExtraInfo {
  type: string;
  [key: string]: unknown;
}

export interface SearchResponse {
  /** your query, echoed untouched */
  query: string;
  /** which model answered */
  model?: SearchModel | string;
  /** end-to-end latency in milliseconds */
  response_time_ms?: number | null;
  /** the written answer; only present when `answer: true` was requested (null when none could be built) */
  answer?: string | null;
  /** only present when the query has a direct-answer block */
  extra_info?: ExtraInfo;
  results: SearchResult[];
}
