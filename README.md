# nuxt-apod-rag

Ask astronomy questions in natural language and get answers grounded in real
NASA **Astronomy Picture of the Day** (APOD) explanation texts — with the source
images shown alongside. A hands-on **RAG** (Retrieval-Augmented Generation)
learning project, built as a sibling to the
[APOD caching demo](https://nuxt-cache-project.netlify.app/).

## What it does

1. **Ingest (once):** fetch a range of APOD entries from the NASA API, turn each
   explanation text into a vector (embedding), store them locally.
2. **Ask (live):** embed the user's question, find the most similar APOD texts by
   cosine similarity, and let an LLM write an answer grounded only in those texts.

So an answer never hallucinates — it comes from real NASA descriptions, and the
matching APOD images are shown as sources.

## Tech

- **Nuxt 4 + Vue** with **Nitro** server routes (all AI logic stays server-side)
- **Transformers.js** — local embeddings, no API key, no cost
- **In-memory cosine similarity** over a JSON file — the retrieval mechanism is
  hand-written and fully visible, not a black-box vector DB
- **Google Gemini** (free tier) for the generated answer

## UI

Dark, editorial space theme (Inter / Spectral / Roboto Mono), shared visual
language with the sibling caching site — blurred header with an orbit-animated
mobile menu, a frosted status footer showing the live RAG pipeline
(Query → Retrieve → Rank → Answer), and an animated starfield backdrop.

Pages:

- **`/` — Ask.** Five states: idle hero → loading (orbit spinner) → answer, or
  the "empty" / "error" black-hole states. The answer view has a full-bleed hero
  of the top match; clicking a source card swaps it into the hero. The error
  state surfaces the real reason (e.g. a Gemini 429 quota).
- **`/how-it-works`** — the pipeline as a four-step timeline, each step with a
  "Show code" excerpt of the real implementation.
- **`/about`** — the learning motivation and the exact stack.
- **`error.vue`** — a black-hole 404.

There's a small easter egg in the Taurus constellation (drag its stars).

## Status

Learning project, built step by step. See [`LEARNING-PLAN.md`](./LEARNING-PLAN.md)
for the roadmap, [`CONTINUE.md`](./CONTINUE.md) for where to pick up, and
[`docs/superpowers/specs/`](./docs/superpowers/specs/) for the design.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # one-time: build the local vector store
```

## Environment variables

Copy `.env.example` to `.env` and fill in your own keys. The `.env` file is
gitignored and must never be committed — these are secrets, and they are only
ever read server-side (in Nitro routes / the ingest script), never exposed to the
browser.

| Variable | What it's for | Where to get it |
| --- | --- | --- |
| `NASA_API_KEY` | Fetching APOD entries (their text + image) from NASA, used by the ingest script. | Free, instant: <https://api.nasa.gov/> |
| `NUXT_NASA_APOD_API_URL` | The APOD endpoint URL (`https://api.nasa.gov/planetary/apod`), kept in env so it's easy to change. | — |
| `GEMINI_API_KEY` | The LLM that turns the retrieved APOD texts into a written answer (the "generation" in RAG). Used server-side in `/api/ask`. | Free tier, no credit card: <https://aistudio.google.com/apikey> |

Example `.env` (values are placeholders — use your own):

```bash
NASA_API_KEY=your_nasa_key_here
NUXT_NASA_APOD_API_URL=https://api.nasa.gov/planetary/apod
GEMINI_API_KEY=your_gemini_key_here
```
