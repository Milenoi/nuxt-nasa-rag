// Domain: an APOD entry and the rule that decides it's usable. No SDK, no NASA field
// names, no persistence shapes (those live with the index port). Depends on nothing.
export interface ApodEntry {
    date: string
    title: string
    url: string
    explanation: string
    mediaType: 'image' | 'video' | 'other'
    thumbnailUrl?: string
    // Set by NASA when the picture belongs to a photographer, not to NASA.
    copyright?: string
}

// A usable APOD entry has an explanation and is an image or video (not, say, an
// interactive page). Pure domain rule, no I/O.
export function isUsableApod(entry: ApodEntry): boolean {
    return Boolean(entry.explanation) && (entry.mediaType === 'image' || entry.mediaType === 'video')
}

// NASA's own work is public domain, a photographer's is not. Only the former may be
// reused as the site's own social preview, hence a still image without a copyright
// holder. Pure domain rule, no I/O.
export function isReusableAsPreview(entry: ApodEntry): boolean {
    return entry.mediaType === 'image' && !entry.copyright?.trim()
}
