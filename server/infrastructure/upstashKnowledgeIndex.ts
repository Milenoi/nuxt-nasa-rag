import { Index } from '@upstash/vector'
import type { KnowledgeIndex } from '../usecases/ports/repositories'
import { runUpstream } from './upstreamError'

// KnowledgeIndex adapter for Upstash Vector (ingest side): existingIds pages through
// every stored id (so a re-run skips finished days), upsert writes the records.
export function upstashKnowledgeIndex(url: string, token: string): KnowledgeIndex {
    const index = new Index({ url, token })
    return {
        async existingIds() {
            const ids = new Set<string>()
            let cursor = '0'
            while (cursor !== '') {
                const page = await runUpstream('upstash-range', () =>
                    index.range({ cursor, limit: 1000, includeMetadata: false })
                )
                for (const v of page.vectors) ids.add(String(v.id))
                cursor = page.nextCursor
            }
            return ids
        },
        async upsert(records) {
            if (records.length) await runUpstream('upstash-upsert', () => index.upsert(records))
        }
    }
}
