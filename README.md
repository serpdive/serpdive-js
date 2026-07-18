# SERPdive TypeScript SDK

The official TypeScript/JavaScript client for [SERPdive](https://serpdive.com), the AI Search API: ask a question, get answer-ready web content that is extracted, cleaned, and sized for an LLM. On a [public, replayable 1,000-question benchmark](https://github.com/edendalexis/serpdive-benchmark), SERPdive runs at the same speed as Tavily, feeds your LLM 20.2% fewer tokens, and wins 60.7% of decided quality duels.

Zero dependencies. Works in Node 18+, Bun, Deno, and edge runtimes (anywhere `fetch` exists). Full TypeScript types included.

## Install

```bash
npm install serpdive
```

## Quickstart

```ts
import { SerpDive } from "serpdive";

const client = new SerpDive({ apiKey: "sd_live_..." }); // or set SERPDIVE_API_KEY
const response = await client.search("who won the 2026 champions league final", {
  answer: true,
});

console.log(response.answer);
for (const result of response.results) {
  console.log(result.url, result.content.slice(0, 100));
}
```

Get your API key at [serpdive.com/dashboard/keys](https://serpdive.com/dashboard/keys).

## Usage

### Choosing a model

```ts
// mako (default): answers in a few seconds
await client.search("best rust web frameworks");

// moby: reads whole pages, for deep research
await client.search("timeline of the OpenAI board dispute", { model: "moby", answer: true });
```

### Options

```ts
await client.search("your question", {
  model: "moby",     // "mako" (fast, default) or "moby" (whole pages)
  answer: true,      // also return a written answer built from the sources
  maxResults: 5,     // hard cap on delivered results, 1 to 10
});
```

Localization is automatic: the language of the query picks where we search. There is no country parameter to configure.

### Errors

Every API error is a typed exception with a stable `code`, the human `message`, and the HTTP `statusCode`:

```ts
import { SerpDive, RateLimitError, QuotaExceededError, SerpDiveError } from "serpdive";

try {
  const response = await client.search("your question");
} catch (err) {
  if (err instanceof RateLimitError) {
    // slow down, then retry
  } else if (err instanceof QuotaExceededError) {
    // monthly credits exhausted
  } else if (err instanceof SerpDiveError) {
    console.error(err.code, err.message);
  }
}
```

Transient failures (HTTP 502/503) are retried automatically; failed searches are never billed. Tune with `new SerpDive({ maxRetries, timeoutMs })`.

## Response shape

`search()` resolves to a `SearchResponse`:

| Field | Type | Notes |
|---|---|---|
| `query` | `string` | your query, echoed |
| `results` | `SearchResult[]` | each has `url`, `content`, `title`, optional ISO `date` |
| `answer` | `string \| null` | only when `answer: true` was requested |
| `extra_info` | `ExtraInfo` | direct-answer block (weather, rates, scores...) when the query has one |
| `model` | `string` | which model answered |
| `response_time_ms` | `number` | end-to-end latency |

## Docs

Full documentation: [serpdive.com/docs](https://serpdive.com/docs). The API is also self-describing for agents: [llms.txt](https://serpdive.com/llms.txt), [openapi.json](https://serpdive.com/openapi.json).

## License

MIT
