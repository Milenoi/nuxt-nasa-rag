import { describe, it, expect } from 'vitest'
import { resolveApodPreview } from '../server/usecases/resolveApodPreview'
import type { ApodCatalog } from '../server/usecases/ports/repositories'
import type { ApodEntry } from '../server/domain/apod'

function entry(partial: Partial<ApodEntry> & { date: string }): ApodEntry {
    return {
        title: `APOD ${partial.date}`,
        url: `https://apod.nasa.gov/apod/image/${partial.date}.jpg`,
        explanation: 'text',
        mediaType: 'image',
        ...partial
    }
}

// A catalog stub returning a fixed list, recording the range it was asked for.
function catalog(entries: ApodEntry[]) {
    const state = { start: '', end: '' }
    const c: ApodCatalog = {
        async fetchRange(startDate, endDate) {
            state.start = startDate
            state.end = endDate
            return entries
        }
    }
    return { catalog: c, state }
}

describe('resolveApodPreview', () => {
    it('asks for a window ending today and reaching well back, since NASA-owned stills are rare', async () => {
        const c = catalog([])
        await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(c.state.end).toBe('2026-08-03')
        expect(c.state.start).toBe('2026-06-19')
    })

    it('picks the newest entry, not the first one returned', async () => {
        const c = catalog([entry({ date: '2026-07-28' }), entry({ date: '2026-08-01' }), entry({ date: '2026-07-30' })])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result?.date).toBe('2026-08-01')
    })

    it('skips a photographer\'s work so only NASA-owned images are reused', async () => {
        const c = catalog([
            entry({ date: '2026-08-02', copyright: 'Some Astrophotographer' }),
            entry({ date: '2026-07-29' })
        ])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result?.date).toBe('2026-07-29')
    })

    it('treats a blank copyright string as NASA-owned', async () => {
        const c = catalog([entry({ date: '2026-08-02', copyright: '   ' })])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result?.date).toBe('2026-08-02')
    })

    it('skips videos, which cannot serve as a preview image', async () => {
        const c = catalog([entry({ date: '2026-08-02', mediaType: 'video' }), entry({ date: '2026-07-31' })])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result?.date).toBe('2026-07-31')
    })

    it('returns null when the window holds nothing reusable', async () => {
        const c = catalog([entry({ date: '2026-08-02', mediaType: 'video' }), entry({ date: '2026-08-01', copyright: 'A Photographer' })])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result).toBeNull()
    })

    it('returns the url and title of the picked entry', async () => {
        const c = catalog([entry({ date: '2026-08-01', title: 'The Ghost Nebula', url: 'https://apod.nasa.gov/apod/image/ghost.jpg' })])
        const result = await resolveApodPreview('2026-08-03', { catalog: c.catalog })
        expect(result).toEqual({ date: '2026-08-01', title: 'The Ghost Nebula', url: 'https://apod.nasa.gov/apod/image/ghost.jpg' })
    })
})
