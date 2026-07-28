import { describe, it, expect } from 'vitest'
import { ingestApodRange } from '../server/usecases/ingestApod'
import type { Embedder } from '../server/usecases/ports/gateways'
import type { ApodCatalog, KnowledgeIndex, ApodVectorRecord } from '../server/usecases/ports/repositories'
import type { ApodEntry } from '../server/domain/apod'

// Fake NASA: returns a fixed list of entries for any range, no real fetch.
function catalog(entries: ApodEntry[]): ApodCatalog {
    return { fetchRange: async () => entries }
}

// Fake Gemini: the use case never inspects the vector, so a fixed one is fine.
const embedder: Embedder = { embed: async () => [0.1, 0.2, 0.3] }

// Fake Upstash: existingIds returns the given ids; upsert records what it got, so
// the test can check what would have been stored.
function knowledgeIndex(existing: string[] = []) {
    const upserted: ApodVectorRecord[] = []
    const index: KnowledgeIndex = {
        existingIds: async () => new Set(existing),
        upsert: async (records) => { upserted.push(...records) }
    }
    return { index, upserted }
}

// Helper: a usable APOD entry (image + explanation) for a given date.
function entry(date: string, overrides: Partial<ApodEntry> = {}): ApodEntry {
    return {
        date,
        title: `APOD ${date}`,
        url: 'https://apod/img.jpg',
        explanation: 'A description.',
        mediaType: 'image',
        ...overrides
    }
}

describe('ingestApodRange', () => {
    it('filters unusable entries, skips existing ones, embeds+upserts the rest, reports counts', async () => {
        const entries = [
            entry('2026-01-01'),                          // usable, new
            entry('2026-01-02'),                          // usable, new
            entry('2026-01-03'),                          // usable, but already stored
            entry('2026-01-04', { mediaType: 'other' })   // not usable (not image/video)
        ]
        const store = knowledgeIndex(['2026-01-03'])

        const report = await ingestApodRange('2026-01-01', '2026-01-04', {
            catalog: catalog(entries),
            embedder,
            index: store.index
        })

        expect(report).toEqual({ fetched: 4, usable: 3, skipped: 1, added: 2 })
        expect(store.upserted.map((r) => r.id)).toEqual(['2026-01-01', '2026-01-02'])
    })

    it('processes pending entries in batches and calls onBatch after each', async () => {
        const entries = [entry('2026-01-01'), entry('2026-01-02'), entry('2026-01-03')]
        const store = knowledgeIndex()
        const batches: number[] = []

        await ingestApodRange('2026-01-01', '2026-01-03', {
            catalog: catalog(entries),
            embedder,
            index: store.index
        }, {
            batchSize: 2,
            onBatch: (added) => { batches.push(added) }
        })

        expect(batches).toEqual([2, 3])          // batch 1 → 2 done, batch 2 → 3 done
        expect(store.upserted).toHaveLength(3)   // all three ended up stored
    })

    it('rejects a non-positive batchSize instead of looping forever', async () => {
        const store = knowledgeIndex()
        const run = (batchSize: number) => ingestApodRange('2026-01-01', '2026-01-01', {
            catalog: catalog([entry('2026-01-01')]),
            embedder,
            index: store.index
        }, { batchSize })

        await expect(run(0)).rejects.toThrow('batchSize must be a positive integer')
        await expect(run(-1)).rejects.toThrow('batchSize must be a positive integer')
    })
})
