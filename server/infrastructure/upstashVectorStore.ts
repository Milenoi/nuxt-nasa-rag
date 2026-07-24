import { Index } from '@upstash/vector'
import type { VectorStore } from '../usecases/ports'
import type { ApodMetadata } from '../utils/apodVector'

// VectorStore adapter for Upstash Vector. URL + token are injected by the
// composition root. Maps Upstash matches to the domain RetrievedSource shape.
export function upstashVectorStore(url: string, token: string): VectorStore {
    const index = new Index({ url, token })
    return {
        async query(vector, topK) {
            const matches = await index.query<ApodMetadata>({ vector, topK, includeMetadata: true })
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
