# CONTINUE — Anknüpfungspunkt

_Stand: 2026-07-22. Hier weitermachen._

## Was das ist
**nuxt-apod-rag** — eine RAG-Demo (Retrieval-Augmented Generation): Nutzer stellen
Astronomie-Fragen in natürlicher Sprache, Antworten kommen aus echten NASA-APOD-
Texten, mit Quell-Bildern. Lernprojekt + Portfolio-Stück. Geschwister zu
`nuxt-cache` (https://nuxt-cache-project.netlify.app/).

## Arbeitsweise (wichtig!)
- **RAG-Kern** (embed, search, ingest, LLM-Anbindung) → **Melanie tippt selbst**,
  Claude coacht/erklärt.
- **Styling / UI / Assets** → **Claude baut**, Melanie kontrolliert **jeden Step**.
- **Commits macht Melanie selbst** (nie automatisch committen).

## Status

### FERTIG ✅
- **RAG komplett & funktioniert** (end-to-end getestet via curl):
  - Embeddings lokal (Transformers.js), Cosinus-Suche von Hand, Ingest, Retrieval,
    Grounding-Prompt, Gemini-Antwort, Threshold, "nichts gefunden"-Fall.
  - **Mehrsprachig**: Modell `Xenova/paraphrase-multilingual-MiniLM-L12-v2`
    (384-dim) → deutsche Fragen funktionieren ("Schildkröte" → Turtle Rock).
    Antwortsprache folgt der Frage (Prompt-Zeile).
- **Regal**: `data/apod-vectors.json`, 338 Einträge (letzte 365 Tage), chunked
  geladen (90-Tage-Fenster) mit Retry.
- **Security/Tooling**: Keys server-only in runtimeConfig; ESLint (wie nuxt-cache);
  statische Text-API `/api/content`.
- **UI Step 1 (Fundament)**: Tailwind v4 + shadcn-nuxt + @nuxt/fonts + @nuxt/image
  eingerichtet (wie nuxt-cache). Tokens/Keyframes in `app/assets/css/tailwind.css`.
  `marked` installiert (KI-Antwort ist Markdown).

### NÄCHSTE SCHRITTE (UI, Claude baut, Melanie reviewt)
- **Step 2**: `app/components/StarField.vue` — animierter Hintergrund (Sterne,
  Sternbild Taurus, Kometen). Wiederverwendbar für die 404-Seite.
- **Step 3**: `app/pages/index.vue` — die Ask-Seite mit allen Zuständen
  (idle → loading → answer → empty → error), verdrahtet an `/api/ask` (POST) und
  `/api/content`. KI-Antwort als gerendertes Markdown, Quell-Karten mit Bild +
  Relevanz-Balken. (Dafür `app/app.vue` auf `<NuxtPage />` umstellen.)
- **Step 4**: `app/error.vue` — 404 ("This page drifted past the observable
  universe.", schwarzes Loch).
- **Danach**: "How it works"-Seite, Netlify-Deploy, Querlinks zu nuxt-cache.

## Design-Quelle
Claude Design Projekt **"APOD Ask"** — id `58f017a5-0625-4555-ad8b-e1bd6e415827`
(https://claude.ai/design/p/58f017a5-0625-4555-ad8b-e1bd6e415827). Datei
`APOD Ask.dc.html`. Dunkles UI, 5 Zustände + 404. (Claude kann es via
claude-design MCP lesen; braucht ggf. erneut `/design consent`.)

## Cheat-Sheet
- `npm run dev` — Dev-Server (nach Config-/Modell-Änderungen neu starten!)
- `npm run ingest` — Regal neu bauen. **Danach Dev-Server neu starten**
  (ask.post.ts cached das Regal im Speicher).
- `npm run lint` / `npm run lint:fix`
- `.env`: `NASA_API_KEY`, `NUXT_NASA_APOD_API_URL`, `GEMINI_API_KEY`
- LLM-Modell: **`gemini-flash-latest`** (2.5-flash ist für neue Keys abgeschaltet).
- `RELEVANCE_THRESHOLD = 0.3` in `ask.post.ts` — evtl. fürs mehrsprachige Modell
  nachjustieren (Scores sind gestauchter).

## Dateien-Landkarte
- `server/api/ask.post.ts` — RAG-Route (embed Frage → search → Gemini → Antwort)
- `server/api/content.get.ts` — statische UI-Texte
- `server/api/apod.get.ts` — heutiges APOD (fürs Frontend, optional)
- `server/utils/embed.ts` — Embedding (load-once), `search.ts` — Cosinus
- `scripts/ingest.ts` — Ingest (chunked)
- `shared/apod.ts` — `ApodRecord`-Typ (geteilt)
- `app/assets/css/tailwind.css` — Tokens + Keyframes
- `docs/superpowers/specs/2026-07-21-apod-rag-design.md` — Design-Doc
- `LEARNING-PLAN.md` — der 8-Phasen-Lernplan

## Ausbaustufen-Backlog
- Vektor-DB statt JSON · täglicher Cron-Ingest · Bilderkennung (Bild-Embeddings) ·
  schöne Error-Page · Threshold fürs mehrsprachige Modell justieren.

## Noch offen
- **Nichts committet** — beim Weitermachen ist ein erster Commit überfällig.
