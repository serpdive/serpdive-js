/**
 * Official TypeScript SDK for SERPdive, the AI Search API.
 *
 * Quickstart:
 * ```ts
 * import { SerpDive } from "serpdive";
 *
 * const client = new SerpDive({ apiKey: "sd_live_..." }); // or SERPDIVE_API_KEY
 * const response = await client.search("who won the 2026 champions league final", {
 *   answer: true,
 * });
 * console.log(response.answer);
 * ```
 */

export {
  SerpDive,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
} from "./client.js";
export type { SerpDiveClientOptions } from "./client.js";
export {
  SerpDiveError,
  AuthenticationError,
  InvalidRequestError,
  RateLimitError,
  QuotaExceededError,
  ServerError,
} from "./errors.js";
export type {
  SearchModel,
  SearchOptions,
  SearchResult,
  SearchResponse,
  ExtraInfo,
} from "./types.js";

export { SerpDive as default } from "./client.js";
