import type { Embedder } from './ports/gateways'
import type { ApodCatalog, KnowledgeIndex, ApodVectorRecord } from './ports/repositories'
import type { ApodEntry } from '../domain/apod'
import { isUsableApod } from '../domain/apod'

// What ingestApodRange needs from the outside.
interface Deps {
    catalog: ApodCatalog
    embedder: Embedder
    index: KnowledgeIndex
}

// A short summary of what one ingest run did.
export interface IngestReport {
    fetched: number
    usable: number
    skipped: number
    added: number
}

interface Options {
    // Entries embedded + upserted per batch (default 50). The backfill uses this to
    // stay under Gemini's per-minute limit; the daily top-up has just one entry.
    batchSize?: number
    // Called after each upserted batch, so the CALLER can log progress and pause
    // between batches. Injected, so the use case stays timing-free and fast to test
    // (a test passes no onBatch, and nothing ever waits).
    onBatch?: (added: number, total: number) => Promise<void> | void
}

// Map one entry to a vector record, embedding its explanation via the injected
// embedder. This does I/O, so it belongs with the use case, not in the pure domain.
async function toRecord(entry: ApodEntry, embedder: Embedder): Promise<ApodVectorRecord> {
    const vector = await embedder.embed(entry.explanation)
    return {
        id: entry.date,
        vector,
        metadata: {
            date: entry.date,
            title: entry.title,
            imageUrl: entry.url,
            explanation: entry.explanation,
            mediaType: entry.mediaType,
            thumbnailUrl: entry.thumbnailUrl ?? ''
        }
    }
}

// Ingest one date range: fetch the entries, keep the usable ones, skip days already
// stored, embed the rest and upsert them. The same use case serves the full backfill
// and the daily top-up (which just passes today...today).
export async function ingestApodRange(
    startDate: string,
    endDate: string,
    deps: Deps,
    options: Options = {}
): Promise<IngestReport> {
    const { batchSize = 50, onBatch } = options
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error('batchSize must be a positive integer')
    }
    const entries = await deps.catalog.fetchRange(startDate, endDate)
    const usable = entries.filter(isUsableApod)
    const existing = await deps.index.existingIds()
    const pending = usable.filter((entry) => !existing.has(entry.date))

    let added = 0
    for (let start = 0; start < pending.length; start += batchSize) {
        const slice = pending.slice(start, start + batchSize)
        const records: ApodVectorRecord[] = []
        for (const entry of slice) {
            records.push(await toRecord(entry, deps.embedder))
        }
        await deps.index.upsert(records)
        added += records.length
        if (onBatch) await onBatch(added, pending.length)
    }

    return {
        fetched: entries.length,
        usable: usable.length,
        skipped: usable.length - pending.length,
        added
    }
}
