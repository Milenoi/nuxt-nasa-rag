import { embed } from './embed'

// Shared by both ingest paths: turn an APOD entry into an Upstash record.

export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    media_type: string
    thumbnail_url?: string
}

export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.media_type === 'image' || entry.media_type === 'video')
}

// Index signature satisfies Upstash's `Dict`.
export interface ApodMetadata {
    [key: string]: unknown
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
}

// embed is injected so the backfill can pass its retrying variant.
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
