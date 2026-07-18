// Offline tests: every request is served by a fake fetch, no network.
import { describe, expect, it } from "vitest";

import {
  AuthenticationError,
  InvalidRequestError,
  QuotaExceededError,
  RateLimitError,
  SerpDive,
  SerpDiveError,
  ServerError,
} from "../src/index.js";

const SUCCESS_BODY = {
  query: "test query",
  model: "mako",
  response_time_ms: 1234,
  results: [
    { url: "https://example.com/a", title: "A", date: "2026-07-01", content: "alpha" },
    { url: "https://example.com/b", title: null, content: "beta" },
  ],
};

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handler: Handler): typeof fetch {
  return ((url: string, init: RequestInit) => Promise.resolve(handler(url, init))) as typeof fetch;
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function makeClient(handler: Handler, opts: ConstructorParameters<typeof SerpDive>[0] = {}) {
  return new SerpDive({ apiKey: "sd_live_test", fetch: fakeFetch(handler), ...opts });
}

describe("SerpDive.search", () => {
  it("sends auth and parses a typed response", async () => {
    const client = makeClient((url, init) => {
      expect(url).toBe("https://api.serpdive.com/v1/search");
      expect((init.headers as Record<string, string>).authorization).toBe("Bearer sd_live_test");
      return jsonResponse(200, SUCCESS_BODY);
    });
    const response = await client.search("test query");
    expect(response.query).toBe("test query");
    expect(response.results).toHaveLength(2);
    expect(response.results[0].date).toBe("2026-07-01");
    expect(response.results[1].title).toBeNull();
    expect(response.answer).toBeUndefined();
  });

  it("maps camelCase options and drops undefined ones", async () => {
    let seen: Record<string, unknown> = {};
    const client = makeClient((_url, init) => {
      seen = JSON.parse(String(init.body));
      return jsonResponse(200, SUCCESS_BODY);
    });

    await client.search("test query");
    expect(seen).toEqual({ query: "test query" });

    await client.search("test query", { model: "moby", answer: true, maxResults: 3 });
    expect(seen).toEqual({ query: "test query", model: "moby", answer: true, max_results: 3 });
  });

  it("maps stable error codes to typed errors", async () => {
    const cases: Array<[number, string, new (...args: never[]) => SerpDiveError]> = [
      [401, "invalid_api_key", AuthenticationError],
      [400, "missing_query", InvalidRequestError],
      [429, "rate_limit_exceeded", RateLimitError],
      [429, "monthly_quota_exceeded", QuotaExceededError],
    ];
    for (const [status, code, cls] of cases) {
      const client = makeClient(() =>
        jsonResponse(status, { error: code, message: `human text for ${code}` }),
      );
      const err = (await client.search("test query").then(
        () => undefined,
        (e: unknown) => e,
      )) as SerpDiveError;
      expect(err).toBeInstanceOf(cls);
      expect(err.code).toBe(code);
      expect(err.statusCode).toBe(status);
      expect(err.message).toContain(`human text for ${code}`);
    }
  });

  it("retries a 503 then succeeds", async () => {
    let calls = 0;
    const client = makeClient(() => {
      calls++;
      if (calls === 1) {
        return jsonResponse(503, { error: "server_busy", message: "busy" }, { "retry-after": "0" });
      }
      return jsonResponse(200, SUCCESS_BODY);
    });
    const response = await client.search("test query");
    expect(response.query).toBe("test query");
    expect(calls).toBe(2);
  });

  it("throws ServerError after retries are exhausted on persistent 502", async () => {
    let calls = 0;
    const client = makeClient(
      () => {
        calls++;
        return jsonResponse(502, { error: "search_failed", message: "failed" }, { "retry-after": "0" });
      },
      { maxRetries: 2 },
    );
    await expect(client.search("test query")).rejects.toBeInstanceOf(ServerError);
    expect(calls).toBe(3);
  });

  it("never retries a 4xx", async () => {
    let calls = 0;
    const client = makeClient(() => {
      calls++;
      return jsonResponse(429, { error: "rate_limit_exceeded", message: "slow down" });
    });
    await expect(client.search("test query")).rejects.toBeInstanceOf(RateLimitError);
    expect(calls).toBe(1);
  });

  it("retries network errors", async () => {
    let calls = 0;
    const client = makeClient(() => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed");
      return jsonResponse(200, SUCCESS_BODY);
    });
    const response = await client.search("test query");
    expect(response.query).toBe("test query");
    expect(calls).toBe(2);
  });

  it("reads the API key from the environment", async () => {
    process.env.SERPDIVE_API_KEY = "sd_live_env";
    try {
      const client = new SerpDive({
        fetch: fakeFetch((_url, init) => {
          expect((init.headers as Record<string, string>).authorization).toBe("Bearer sd_live_env");
          return jsonResponse(200, SUCCESS_BODY);
        }),
      });
      const response = await client.search("test query");
      expect(response.query).toBe("test query");
    } finally {
      delete process.env.SERPDIVE_API_KEY;
    }
  });

  it("throws without an API key", () => {
    delete process.env.SERPDIVE_API_KEY;
    expect(() => new SerpDive()).toThrow(SerpDiveError);
  });
});
