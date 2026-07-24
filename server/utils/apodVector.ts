import { embed } from './embed'

// Shared by both ingest paths (batch backfill + daily top-up): turn a raw APOD
// entry into an upsertable Upstash record, so the mapping lives in one place.

// The NASA APOD fields we use.
export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    media_type: string
    thumbnail_url?: string
}

// Usable = has explanation text and is an image or video.
export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.media_type === 'image' || entry.media_type === 'video')
}

// What we store per vector. The index signature satisfies Upstash's `Dict`.
export interface ApodMetadata {
    [key: string]: unknown
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
}

// Embed + build the record (id = date, so upserts are idempotent per day). embed
// is injected so the backfill can pass its retrying variant.
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
