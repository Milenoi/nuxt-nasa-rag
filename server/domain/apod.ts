// Domain: an APOD entry and the rule that decides it's usable. No SDK, no NASA field
// names, no persistence shapes (those live with the index port). Depends on nothing.
export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    mediaType: 'image' | 'video' | 'other'
    thumbnailUrl?: string
}

// A usable APOD entry has an explanation and is an image or video (not, say, an
// interactive page). Pure domain rule, no I/O.
export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.mediaType === 'image' || entry.mediaType === 'video')
}
