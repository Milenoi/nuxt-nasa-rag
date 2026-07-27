import type { Embedder } from '../usecases/ports/gateways'
import { embed } from '../utils/embed'

// Embedder adapter: wraps the shared low-level embed() (Gemini gemini-embedding-001),
// which the ingest scripts also use. A thin wrapper so the query path and the
// ingest path stay on the exact same embedding.
export function geminiEmbedder(apiKey: string): Embedder {
    return { embed: (text) => embed(text, apiKey) }
}
