export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    media_type: string
    thumbnail_url?: string
}

export interface ApodMetadata {
    [key: string]: unknown
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
}

// What we upsert into the vector index (id = the APOD date).
export interface ApodVectorRecord {
    id: string
    vector: number[]
    metadata: ApodMetadata
}

// A usable APOD entry has an explanation and is an image or video (not, say, an
// interactive page). Pure domain rule, no I/O.
export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.media_type === 'image' || entry.media_type === 'video')
}
