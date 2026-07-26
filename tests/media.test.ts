import { describe, it, expect } from 'vitest'
import { isVideo, isFileVideo, youtubeAutoplaySrc, cardImage } from '../app/utils/media'
import type { Source } from '../app/types/ask'

// A minimal source; tests override only the fields they care about.
function makeSource(overrides: Partial<Source> = {}): Source {
    return {
        date: '2024-01-01',
        title: 'Test',
        imageUrl: 'https://apod.nasa.gov/still.jpg',
        explanation: '',
        score: 0.8,
        ...overrides
    }
}

describe('isVideo', () => {
    it('is true only for the video media type', () => {
        expect(isVideo(makeSource({ mediaType: 'video' }))).toBe(true)
        expect(isVideo(makeSource({ mediaType: 'image' }))).toBe(false)
    })

    it('is false for undefined', () => {
        expect(isVideo(undefined)).toBe(false)
    })
})

describe('isFileVideo', () => {
    it('matches direct video files, with or without a query string', () => {
        expect(isFileVideo('https://example.com/clip.mp4')).toBe(true)
        expect(isFileVideo('https://example.com/clip.webm')).toBe(true)
        expect(isFileVideo('https://example.com/clip.ogg')).toBe(true)
        expect(isFileVideo('https://example.com/clip.mp4?v=2')).toBe(true)
    })

    it('is case-insensitive on the extension', () => {
        expect(isFileVideo('https://example.com/CLIP.MP4')).toBe(true)
    })

    it('does not match YouTube embeds or stills', () => {
        expect(isFileVideo('https://www.youtube.com/embed/abc123')).toBe(false)
        expect(isFileVideo('https://apod.nasa.gov/still.jpg')).toBe(false)
    })

    it('does not match a mid-url extension without a boundary', () => {
        expect(isFileVideo('https://example.com/mp4-guide/page')).toBe(false)
    })

    it('is false for undefined', () => {
        expect(isFileVideo(undefined)).toBe(false)
    })
})

describe('youtubeAutoplaySrc', () => {
    it('rebuilds an embed URL with autoplay, mute and loop params', () => {
        const out = youtubeAutoplaySrc('https://www.youtube.com/embed/dQw4w9WgXcQ')
        expect(out).toContain('/embed/dQw4w9WgXcQ')
        expect(out).toContain('autoplay=1')
        expect(out).toContain('mute=1')
        // loop needs playlist=<id> to actually loop a single video
        expect(out).toContain('loop=1')
        expect(out).toContain('playlist=dQw4w9WgXcQ')
    })

    it('strips any existing query string on the source id', () => {
        const out = youtubeAutoplaySrc('https://www.youtube.com/embed/abc123?start=30')
        expect(out).toContain('/embed/abc123?')
        expect(out).toContain('playlist=abc123')
    })

    it('returns the input unchanged when it is not an embed URL', () => {
        const url = 'https://www.youtube.com/watch?v=abc123'
        expect(youtubeAutoplaySrc(url)).toBe(url)
    })
})

describe('cardImage', () => {
    it('uses the thumbnail for a video', () => {
        const src = makeSource({ mediaType: 'video', thumbnailUrl: 'https://img/thumb.jpg' })
        expect(cardImage(src)).toBe('https://img/thumb.jpg')
    })

    it('uses the still image for a non-video', () => {
        const src = makeSource({ mediaType: 'image', imageUrl: 'https://img/still.jpg' })
        expect(cardImage(src)).toBe('https://img/still.jpg')
    })
})
