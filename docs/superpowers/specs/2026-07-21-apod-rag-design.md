# APOD-RAG — Design

**Date:** 2026-07-21
**Author:** Melanie Stief (with Claude as mentor)
**Status:** Approved design, ready for guided implementation

## Purpose

A small Nuxt web app where a user can ask questions about astronomy in natural
language and get answers grounded in real NASA "Astronomy Picture of the Day"
(APOD) explanation texts, with the source images shown alongside.

Two goals in one:

1. **Learn RAG** (Retrieval-Augmented Generation) from the ground up. The author
   is a frontend developer new to AI and will type all the code themselves, with
   Claude explaining each step. Learning is the primary driver — chosen
   implementation options favour transparency over convenience.
2. **Portfolio piece.** A sibling to the existing Nuxt APOD "caching demo"
   (https://nuxt-cache-project.netlify.app/). Same dark, minimal astronomy look;
   the two sites cross-link.

## What RAG means here (one paragraph)

APOD explanation texts are embedded (turned into vectors) once and stored
locally. At query time the user's question is embedded too, the most similar
APOD texts are retrieved by cosine similarity, and those texts plus the question
are sent to an LLM which writes an answer grounded only in them. This avoids
hallucination and lets us show the source APOD images.

## Tech stack

- **Nuxt + Vue** — matches the sibling site; reuses the author's existing Nitro
  knowledge so learning can focus on the *new* RAG parts.
- **Nitro server routes** — all AI/API logic runs server-side (API keys never
  reach the browser).
- **Transformers.js** — embeddings computed locally, no account, no cost. Chosen
  so the author sees text -> vector hands-on.
- **In-memory cosine similarity over a JSON file** — the vector "store" is a
  plain JSON file; search is ~20 lines of hand-written cosine similarity. Chosen
  so the retrieval mechanism is fully visible, not a black box. Fine for the few
  thousand APOD texts involved.
- **Google Gemini (free tier)** — the LLM that writes the final answer. No credit
  card; swappable for a paid API later via one function.
- **Netlify** — deploy target, like the sibling site.

## Components (each has one clear job)

1. `scripts/ingest.ts` — one-time indexer. Fetches an APOD date range from the
   NASA API, embeds each `explanation`, writes `data/apod-vectors.json`
   (vector + title + date + image URL + explanation).
2. `server/utils/embed.ts` — wraps Transformers.js: "text in, vector out". Used
   by both ingest and query.
3. `server/utils/search.ts` — cosine similarity: "query vector in, top-N matches
   out". The core mechanism.
4. `server/api/ask.post.ts` — the live route: question -> embed -> search ->
   build prompt -> Gemini -> `{ answer, sources }`.
5. `pages/index.vue` — Ask UI: input, answer, source cards with images (linking
   to the sibling APOD site).
6. `pages/how-it-works.vue` — explains RAG visually; counterpart to the sibling
   site's caching explanation.

## Data flow

```
Phase A — ingest (once, `npm run ingest`):
  NASA APOD API (date range) -> embed each explanation
    -> data/apod-vectors.json  (vector + title + date + imageUrl + explanation)

Phase B — live (Nitro /api/ask):
  question -> embed -> cosine search in data/apod-vectors.json -> top-5 texts
    -> question + texts -> Gemini -> { answer, sources[] }
```

## Error handling (deliberately simple)

- NASA API unreachable during ingest: abort with a clear message.
- No match above a similarity threshold: return "I couldn't find anything about
  that in the APOD texts" instead of a hallucinated answer.
- Gemini error / rate limit: friendly error message in the UI.

## Security

- `GEMINI_API_KEY` and `NASA_API_KEY` live only in `.env`, read only in Nitro
  server routes. Never exposed to the client.

## Scope — explicitly out (YAGNI)

No auth, no chat history, no external database, no answer streaming. Just
question in, grounded answer + sources out. Enough to understand RAG end to end.

## Success criteria

- Author can explain, in their own words, what embedding, retrieval and
  augmented generation each do.
- Asking a question returns a sensible answer plus the APOD images it drew from.
- The app builds and deploys to Netlify; it visually matches and cross-links
  with the sibling APOD site.
