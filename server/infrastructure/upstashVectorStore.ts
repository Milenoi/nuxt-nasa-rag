import { Index } from '@upstash/vector'
import type { VectorStore, ApodMetadata } from '../usecases/ports/repositories'
import { runUpstream } from './upstreamError'

// VectorStore adapter for Upstash Vector. URL + token are injected by the
// composition root. Maps Upstash matches to the domain RetrievedSource shape.
export function upstashVectorStore(url: string, token: string): VectorStore {
    const index = new Index({ url, token })
    return {
        async query(vector, topK) {
            const matches = await runUpstream('upstash-query', () =>
                index.query<ApodMetadata>({ vector, topK, includeMetadata: true })
            )
            return matches.map((match) => {
                const m = match.metadata!
                return {
                    date: m.date,
                    title: m.title,
                    imageUrl: m.imageUrl,
                    explanation: m.explanation,
                    mediaType: m.mediaType,
                    thumbnailUrl: m.thumbnailUrl,
                    score: match.score
                }
            })
        }
    }
}
