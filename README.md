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
in-character voice (off = cool and factual). On the results view, a **relevance slider**
dims the weaker sources. All sync to the URL for sharing.

## Tech

- **Nuxt 4 + Vue** with **Nitro** server routes (keys and AI logic stay server-side)
- **Google Gemini** for embeddings (`gemini-embedding-001`, multilingual) and the
  grounded answer (`gemini-flash-latest`)
- **Upstash Vector** as the vector store
- **@nuxt/image** for AVIF/WebP images through the Netlify Image CDN
- **Tailwind CSS v4** + **shadcn-vue**, hosted on **Netlify**

The look is a dark, editorial space theme with a live pipeline in the footer and a
draggable Taurus constellation as an easter egg. There are three pages: the Ask
page, a "how it works" walkthrough, and an about page.

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

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # build/refresh the vector store, then restart dev
```

The ingest is resumable and safe to re-run: it skips days already stored and works
in small batches with pauses, so hitting the daily Gemini quota never loses a whole
run. A daily top-up (`netlify/functions/daily-ingest.mts`) adds each new APOD day on
its own, on a daily cron (`0 8 * * *`).

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
