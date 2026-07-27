import type { Embedder } from '../usecases/ports/gateways'
import { embed } from '../utils/embed'
import { runUpstream } from './upstreamError'

// Embedder adapter: wraps the shared low-level embed() (Gemini gemini-embedding-001),
// which the ingest path also uses. runUpstream translates any Gemini failure into an
// UpstreamError at this boundary, so the core never sees a raw SDK error.
export function geminiEmbedder(apiKey: string): Embedder {
    return { embed: (text) => runUpstream('gemini-embed', () => embed(text, apiKey)) }
}
