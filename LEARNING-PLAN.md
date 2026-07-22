# APOD-RAG — Lern-Fahrplan

Modus: **Melanie tippt, Claude erklaert.** Jede Phase hat ein sichtbares
Ergebnis. RAG waechst Stueck fuer Stueck zusammen.

Legende:
- **Ziel** — was du am Ende der Phase kannst/hast
- **Du machst** — was du tippst/ausfuehrst
- **Ich erklaere** — was ich dir dabei beibringe
- **Fertig wenn** — woran du merkst, dass die Phase sitzt

---

## Phase 0 — Setup & erster Start
- **Ziel:** Ein laufendes Nuxt-Projekt, NASA-API-Key besorgt.
- **Du machst:** Nuxt scaffolden, `npm run dev`, Key auf api.nasa.gov holen, `.env` anlegen.
- **Ich erklaere:** Projektstruktur, wo Server-Routes leben, warum Keys in `.env`.
- **Fertig wenn:** leere Nuxt-Seite laeuft auf localhost.

## Phase 1 — Mit der NASA-API reden (noch kein RAG)
- **Ziel:** Eine Nitro-Route holt EIN APOD und zeigt es an.
- **Du machst:** `server/api/apod.get.ts` schreiben, im Frontend anzeigen.
- **Ich erklaere:** Nitro-Routes, `$fetch`, die APOD-JSON-Struktur (das `explanation`-Feld live sehen!).
- **Fertig wenn:** Bild + Erklaerungstext von heute erscheinen auf der Seite.

## Phase 2 — Embeddings begreifen (der Aha-Moment)
- **Ziel:** Einen Satz in einen Vektor verwandeln und angucken.
- **Du machst:** Mini-Script mit Transformers.js, `console.log` den Vektor.
- **Ich erklaere:** Was ein Embedding ist, warum Text zu Zahlen wird, was "Dimensionen" bedeuten.
- **Fertig wenn:** du im Terminal einen Zahlen-Array fuer einen Satz siehst und verstehst, was er bedeutet.

## Phase 3 — Aehnlichkeit selbst rechnen (das Herz von RAG)
- **Ziel:** Mit ~20 Zeilen Cosinus-Aehnlichkeit messen, welche Saetze thematisch nah sind.
- **Du machst:** `server/utils/search.ts`, ein paar Testsaetze vergleichen.
- **Ich erklaere:** Cosinus-Aehnlichkeit anschaulich, warum "nah" = "thematisch aehnlich".
- **Fertig wenn:** "schwarzes Loch" landet naeher bei "Neutronenstern" als bei "Katze".

## Phase 4 — Ingest: das Regal befuellen (Phase A)
- **Ziel:** APOD-Zeitraum holen, alle Texte embedden, als JSON speichern.
- **Du machst:** `scripts/ingest.ts`, `npm run ingest`.
- **Ich erklaere:** warum das EINMALIG passiert, was in `data/apod-vectors.json` landet und warum.
- **Fertig wenn:** eine JSON-Datei mit hunderten/tausenden Eintraegen existiert.

## Phase 5 — Retrieval: das "R" komplett (noch ohne LLM)
- **Ziel:** `/api/ask` embeddet die Frage, sucht, gibt die Top-5 Texte zurueck.
- **Du machst:** `server/api/ask.post.ts` (erstmal nur Suche), Ergebnis im Browser ansehen.
- **Ich erklaere:** wie Query-Embedding + Suche zusammenspielen; du SIEHST relevante Treffer, bevor die KI ueberhaupt dran ist.
- **Fertig wenn:** eine Frage liefert thematisch passende APOD-Texte.

## Phase 6 — Generation: das "AG" dran (jetzt ist es RAG)
- **Ziel:** Gemini formuliert aus Frage + Treffern eine Antwort.
- **Du machst:** Gemini-Key holen, LLM-Call in `ask.post.ts` ergaenzen.
- **Ich erklaere:** Prompting, "antworte NUR aus diesen Texten" (Grounding), Halluzinationen vermeiden.
- **Fertig wenn:** du eine Antwort in APOD-Worten bekommst — vollstaendiges RAG!

## Phase 7 — UI: die Ask-Seite
- **Ziel:** Schoene Frage/Antwort-Oberflaeche mit Quell-Karten (Bilder).
- **Du machst:** `pages/index.vue`, dunkler Astro-Look wie die Schwester-Seite.
- **Ich erklaere:** Frontend an die eigene Route anbinden, Ladezustaende, Quellen anzeigen.
- **Fertig wenn:** du im Browser fragst und Antwort + Bilder erscheinen.

## Phase 8 — How-it-works, Politur, Deploy
- **Ziel:** Erklaerungs-Seite, Feinschliff, live auf Netlify.
- **Du machst:** `pages/how-it-works.vue`, Netlify-Deploy, Querlinks zur Schwester-Seite.
- **Ich erklaere:** wie man RAG verstaendlich visualisiert, Deploy-Setup.
- **Fertig wenn:** die Seite live ist und mit der Cache-Seite verlinkt.

---

## Reihenfolge-Logik
Bewusst NICHT in Datei-Reihenfolge, sondern nach Verstaendnis-Aufbau:
erst die Rohdaten sehen (1), dann die zwei neuen Bausteine isoliert begreifen
(2 Embedding, 3 Aehnlichkeit), dann zusammensetzen (4 Ingest, 5 Retrieval),
dann die KI drauf (6), dann erst UI (7) und Deploy (8). So ist bei jedem
Schritt genau EINE neue Sache neu.
