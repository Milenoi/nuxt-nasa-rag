# nuxt-apod-rag

Ask astronomy questions in natural language and get answers grounded in real
NASA **Astronomy Picture of the Day** (APOD) explanation texts, with the source
images and videos shown alongside. A hands-on **RAG** (Retrieval-Augmented
Generation) learning project, built as a sibling to the
[APOD caching demo](https://nuxt-cache-project.netlify.app/).

**Live:** https://nuxt-rag.netlify.app/

## What it does

1. **Ingest (once):** fetch a year of APOD entries from the NASA API, turn each
   explanation text into a vector (embedding), store them in a local JSON file.
2. **Ask (live):** embed the user's question, find the most similar APOD texts by
   cosine similarity, keep the best matches, and let an LLM write an answer
   grounded only in those texts.

So an answer never hallucinates: it comes from real NASA descriptions, and the
matching APOD images and videos are shown as sources. A relevance slider lets you
see and adjust how strict the match has to be.

## Tech

- **Nuxt 4 + Vue** with **Nitro** server routes (all AI logic stays server-side)
- **Google Gemini** embeddings (`gemini-embedding-001`, multilingual, 768-dim), so
  German questions still match the English APOD texts
- **Hand-written cosine similarity** over a plain JSON file, the retrieval is fully
  visible, not a black-box vector DB
- **Google Gemini** (`gemini-flash-latest`, free tier) for the grounded answer
- **Tailwind CSS v4** + **shadcn-vue** components, hosted on **Netlify**

## UI

Dark, editorial space theme (Inter / Spectral / Roboto Mono), sharing a visual
language with the sibling caching site: a blurred header with an orbit-animated
mobile menu, a frosted status footer showing the live RAG pipeline, and an animated
starfield backdrop.

Pages:

- **`/` (Ask).** Five states: idle hero → loading (orbit spinner) → answer, or the
  "empty" / "error" black-hole states. The answer view has a full-bleed hero of the
  top match (images as `<img>`, videos autoplaying as `<video>` or a YouTube
  iframe); clicking a source card swaps it into the hero. A relevance-tolerance
  slider dims weak sources live and is shareable via `?t=`.
- **`/how-it-works`** the pipeline as a four-step timeline, each step with a "Show
  code" excerpt of the real implementation.
- **`/about`** the learning motivation, the plan A to plan B journey, and the stack.
- **`error.vue`** a black-hole 404.

There is a small easter egg in the Taurus constellation (drag its stars on wide
screens).

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # one-time: build the local vector store, then restart dev
```

## Environment variables

Copy the values into a `.env` (gitignored, never commit these; they are only ever
read server-side, never exposed to the browser).

| Variable | What it's for | Where to get it |
| --- | --- | --- |
| `NASA_API_KEY` | Fetching APOD entries (text + media) from NASA, used by the ingest script. | Free, instant: <https://api.nasa.gov/> |
| `NUXT_NASA_APOD_API_URL` | The APOD endpoint URL (`https://api.nasa.gov/planetary/apod`), kept in env so it's easy to change. | (fixed) |
| `GEMINI_API_KEY` | Embeddings and the grounded answer (the "generation" in RAG). Used server-side. | Free tier, no credit card: <https://aistudio.google.com/apikey> |

```bash
NASA_API_KEY=your_nasa_key_here
NUXT_NASA_APOD_API_URL=https://api.nasa.gov/planetary/apod
GEMINI_API_KEY=your_gemini_key_here
```

## Note

Deliberately a free-tier learning and portfolio project, so it can hit the daily
Gemini quota. Built to learn and to show, not to run up costs.
