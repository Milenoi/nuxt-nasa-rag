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

Because the answer can only draw from the retrieved descriptions, it does not make
things up, and the pictures it used are shown as sources. A relevance slider lets
you set how strict the match has to be.

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

## Why some files are still here

This is a learning project, so I kept the earlier attempts in the repo on purpose
instead of deleting them, they show how it got here:

- **`data/apod-vectors.json`** plus the **hand-written cosine similarity** in
  `server/utils/search.ts` were plan A. Retrieval ran on a plain JSON file and a few
  lines of my own dot-product math, so I could actually see how it works before
  reaching for a database. The app now runs on Upstash Vector, but the old code
  stays as a record of the progress. The About page tells that plan-A-to-plan-B
  story in full.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run ingest   # build/refresh the vector store, then restart dev
```

The ingest is resumable and safe to re-run: it skips days already stored and works
in small batches with pauses, so hitting the daily Gemini quota never loses a whole
run. A daily top-up (`netlify/functions/daily-ingest.mts`) adds each new APOD day on
its own; its cron is commented out until the historical backfill is complete.

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
