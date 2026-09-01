# nuxt-nasa-rag

Ask an astronomy question in plain language and get an answer built only from real
NASA **Astronomy Picture of the Day** (APOD) descriptions, with the source images
and videos shown next to it. A hands-on **RAG** (Retrieval-Augmented Generation)
learning project, and a sibling to my
[APOD caching demo](https://nuxt-cache-project.netlify.app/).

**Live:** https://nuxt-rag.netlify.app/

## What it does

1. **Ingest:** fetch about three years of APOD entries from the NASA API, turn each
   explanation into an embedding, and store them in a hosted vector database.
2. **Ask:** embed the question, find the closest APOD texts in the database, and let
   Gemini write an answer grounded only in those texts.

Because the answer is drawn only from the retrieved descriptions, it stays grounded in
real sources and keeps unsupported claims to a minimum (a strong prompt constraint, not
an absolute guarantee). If the texts don't cover an otherwise real question, it shows the
closest pictures instead of guessing; if the input is just gibberish, it says so and stops.
The pictures behind an answer are always shown as sources.

Two toggles on the start screen: **Smart search** suggests cleaned-up versions of your
question (typos fixed, wording tightened) to pick from before searching, so a misspelled
or vague query still finds matches, and a **Star Trek toggle** gives the answer a playful
in-character voice (off = cool and factual). Both sync to the URL for sharing.

## Tech

- **Nuxt 4 + Vue** with **Nitro** server routes (keys and AI logic stay server-side)
- **Google Gemini** for embeddings (`gemini-embedding-001`, multilingual) and the
  grounded answer (`gemini-3.6-flash`, a structured JSON reply validated with Zod)
- **Upstash Vector** as the vector store
- **@nuxt/image** for AVIF/WebP images through the Netlify Image CDN
- **Tailwind CSS v4** + **shadcn-vue**, hosted on **Netlify**
- **Schema.org structured data** on every page (`nuxt-schema-org`): a `WebSite` with a
  search action, plus per-page types (`TechArticle`, `AboutPage`, `FAQPage`)
- **Sitemap** (`@nuxtjs/sitemap`): generated from the routes at build time, so a new
  page cannot be forgotten (the old hand-written `public/sitemap.xml` had missed `/faq`)
- **Social previews**: `og:image` is the newest NASA-owned APOD still, cropped to
  1200x630 by the image CDN. Pictures by photographers are skipped, since only NASA's
  own work is free to reuse as the site's preview. A shared result link (`/?q=...`)
  shows the picture of its own top match, resolved server-side without spending a
  Gemini answer on the crawler

The look is a dark, editorial space theme with a live pipeline in the footer and a
draggable Taurus constellation as an easter egg. There are four pages: the Ask
page, a "how it works" walkthrough, a FAQ, and an about page.

## Architecture

The query path follows a clean-architecture split, so the core does not depend on the
specific tech:

- **`server/domain/`** plain types and pure rules (`ask.ts` for the query flow,
  `apod.ts` for ingest).
- **`server/usecases/`** the use cases (`resolveQuestion`, `suggestQueries`,
  `ingestApodRange`) plus the ports they need, split into `ports/gateways.ts` (the
  Gemini capabilities) and `ports/repositories.ts` (data: the vector store + NASA
  catalogue).
- **`server/infrastructure/`** the adapters that fulfil those ports (Gemini, Upstash,
  NASA), plus a small `config.ts` that reads the keys once and injects them.
- **`server/api/ask.post.ts`** and **`server/api/suggest.post.ts`** thin controllers
  (the composition roots): `ask` for the grounded answer, `suggest` for the optional
  "did you mean?" step. The ingest follows the same shape: one `ingestApodRange` use
  case driven by both the backfill script and the daily Netlify function.

Swapping Gemini for another model, or Upstash for another store, means writing one new
adapter, the core stays untouched, and the use case is testable with fake adapters (no
real APIs). The About page tells the plan-A-to-plan-B story (hand-written cosine over a
JSON file, then a hosted vector database).

On the front end, the Ask page follows the same one-concern-per-file idea: all
interaction lives in a `useAsk()` composable, the UI copy (and per-page SEO) in
`useContent()`, and the four states (idle, answer, empty, error) are small view
components, leaving `index.vue` as thin orchestration.

### One type contract, no duplication

The shapes that cross the wire (the `/api/ask` and `/api/suggest` responses) are defined
**once**, as Zod schemas in `shared/contracts/ask.ts`. Everything else derives from that
single source: the server domain re-exports the inferred types, the controllers validate
their responses at the boundary with `.parse()`, and the client imports the same types.

Why do it this way:

- **No duplicated definitions.** The client type used to be a hand-kept copy of the domain
  type; the two could drift. Now there is one definition and `z.infer` derives the rest, so
  a change to the shape updates client and server together.
- **Runtime safety, not just compile-time.** Because it is a Zod schema and not just a
  TypeScript type, the controllers actually `.parse()` what they send. If the server ever
  built a wrong-shaped response, it fails loudly at the boundary instead of shipping bad
  data to the browser.
- **Zod stays out of the client bundle.** The client uses `import type` only, which the
  build erases, so the schema code never reaches the browser (verified: the library is
  absent from `.output/public`). The client pays for the types, not the runtime.
- **Clean architecture is intact.** The contract is framed as the core entities and every
  layer still points inward to it. The one concession is that the core entities are defined
  with Zod instead of plain interfaces; no framework or SDK leaks inward. This is the same
  "one schema, infer everywhere" pattern tRPC and OpenAPI-first tooling use.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # build/refresh the vector store, then restart dev
npm run eval     # offline retrieval eval: Recall@K + MRR over a labelled test set
```

The ingest is resumable and safe to re-run: it skips days already stored and works
in small batches with pauses, upserting each batch immediately, so hitting the daily
Gemini quota never loses more than the batch in progress. A daily top-up (`netlify/functions/daily-ingest.mts`) adds each new APOD day on
its own, on a daily cron (`0 8 * * *`).

`npm run eval` is an offline tuning tool (not part of the request path): it runs a
small set of labelled questions through the real retrieval path and reports Recall@K
and MRR, so `MIN_RETRIEVAL_SCORE` and `topK` can be set from numbers instead of
guesswork. These are standard information-retrieval metrics.

## Testing

```bash
npm run test       # vitest
npm run typecheck  # vue-tsc, catches broken import type paths eslint/vitest miss
npm run lint
```

Husky wires the fast checks into git: **pre-commit** runs ESLint on the staged
files (lint-staged) plus the test suite, both about a second. **pre-push** runs
the typecheck, which takes ~30s and is too slow for every commit.

The suite runs the core with fake adapters (no network), grouped by area:

- **Retrieval decision** (`resolveQuestion`): the three states, the score pre-filter,
  the structured reply and the source-citation check.
- **Ingest** (`ingestApod`): the range/batching behaviour.
- **Suggestions** (`suggestQueries`): the "did you mean?" cleanup.
- **Eval metrics** (`evaluateRetrieval`): `reciprocalRank`, `recallAtK`, `mrr` and the
  use case over fake ports.
- **NASA adapter** (`nasaApodCatalog`): window splitting over a mocked `fetch`, the
  retry policy (429/503 retried, 400 not) and the snake_case to domain mapping.
- **Error boundary** (`upstreamError`): a busy upstream (500/503/504) is retried
  with a short backoff while a 429, a 400 and a schema mismatch are not; 429 and 503
  pass through to the client, any other status is sanitised to 502, and the failure
  is logged server-side.
- **Type contract** (`askContract`): the shared Zod schemas accept a valid response
  and reject a malformed one (wrong state, missing field).
- **Preview image** (`resolveApodPreview`): picks the newest entry, skips videos and
  anything with a `copyright` holder, and returns null when the window holds nothing
  reusable.
- **Shared link preview** (`resolveSharePreview`): embeds the question, takes the top
  match, re-checks ownership for that day, and falls back to null for a weak match, a
  video, a photographer's picture, or a blank question (no embedding call at all).
- **UI helpers** (`media`, `describeError`, `shareQuery`): the small client-side utils.

## Environment variables

Copy the values into a `.env` (gitignored, never commit these; they are only ever
read server-side, never exposed to the browser).

| Variable | What it's for | Where to get it |
| --- | --- | --- |
| `NASA_API_KEY` | Fetching APOD entries (text + media) from NASA, used by the ingest script. | Free, instant: <https://api.nasa.gov/> |
| `NUXT_NASA_APOD_API_URL` | The APOD endpoint URL (`https://api.nasa.gov/planetary/apod`), kept in env so it's easy to change. | (fixed) |
| `GEMINI_API_KEY` | Embeddings and the grounded answer (the "generation" in RAG). Used server-side. | Free tier, no credit card: <https://aistudio.google.com/apikey> |
| `UPSTASH_VECTOR_REST_URL` | REST endpoint of the Upstash Vector index (retrieval + ingest). | Free tier: <https://console.upstash.com/> |
| `UPSTASH_VECTOR_REST_TOKEN` | Read/write token for the Upstash Vector index (the ingest needs write). | Same index dashboard in the Upstash console |

```bash
NASA_API_KEY=your_nasa_key_here
NUXT_NASA_APOD_API_URL=https://api.nasa.gov/planetary/apod
GEMINI_API_KEY=your_gemini_key_here
UPSTASH_VECTOR_REST_URL=your_upstash_url_here
UPSTASH_VECTOR_REST_TOKEN=your_upstash_token_here
```

## Note

Deliberately a free-tier project, so it can hit the daily Gemini quota. Built to
learn and to show, not to run up costs.
