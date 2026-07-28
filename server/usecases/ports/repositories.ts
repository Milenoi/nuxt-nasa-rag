import type { RetrievedSource } from '../../domain/ask'
import type { ApodEntry } from '../../domain/apod'

// Repository ports: reading and writing stored data. Adapters (Upstash, NASA)
// implement these; the use cases know only these contracts, never the concrete tech.

// Returns the closest stored sources for a query vector (query side).
export interface VectorStore {
    query(vector: number[], topK: number): Promise<RetrievedSource[]>
}

// The stored shape of an APOD in the vector index: chosen metadata plus the embedding,
// keyed by the date. A persistence model, so it lives with the index port, not in the
// domain. The index signature keeps it assignable to Upstash's generic Dict.
export interface ApodMetadata {
    [key: string]: unknown
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
}

export interface ApodVectorRecord {
    id: string
    vector: number[]
    metadata: ApodMetadata
}

// The vector index seen from the ingest side: which day-ids already exist (so a
// re-run skips finished days) and upserting new records.
export interface KnowledgeIndex {
    existingIds(): Promise<Set<string>>
    upsert(records: ApodVectorRecord[]): Promise<void>
}

// Fetches raw APOD entries for a date range (ingest side).
export interface ApodCatalog {
    fetchRange(startDate: string, endDate: string): Promise<ApodEntry[]>
}
