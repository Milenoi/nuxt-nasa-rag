import { embed } from './embed'

// Shared core of both ingest paths: the batch backfill (scripts/ingest.ts) and
// the daily top-up (netlify/functions/daily-ingest.mts) turn a raw APOD entry
// into an upsertable Upstash record here, so the embed step and the metadata
// mapping live in exactly one place.

// The subset of NASA APOD fields we use.
export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    media_type: string
    thumbnail_url?: string
}

// Usable if we can ground on it (has explanation text) and show it (image/video).
export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.media_type === 'image' || entry.media_type === 'video')
}

// Embed the explanation and build the Upstash record (id = date, so upserts are
// idempotent per day). The embed function is injected, so the backfill can pass
// a retrying variant while the daily job uses the plain one.
// What we store per vector and read back at query time. Used on both sides
// (ingest writes it, ask.post types the query result with it) so they can't
// drift apart.
export interface ApodMetadata {
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
}

export async function toVectorItem(
    entry: ApodEntry,
    embedFn: (text: string) => Promise<number[]> = embed
) {
    const vector = await embedFn(entry.explanation)
    const metadata: ApodMetadata = {
        date: entry.date,
        title: entry.title,
        imageUrl: entry.url,
        explanation: entry.explanation,
        mediaType: entry.media_type,
        thumbnailUrl: entry.thumbnail_url ?? ''
    }
    return { id: entry.date, vector, metadata }
}
