import { describe, it, expect, vi, afterEach } from 'vitest'
import { nasaApodCatalog } from '../server/infrastructure/nasaApodCatalog'
import { UpstreamError } from '../server/usecases/errors'

// A fake fetch Response with just the bits the adapter reads.
function res(status: number, body: unknown = []) {
    return { ok: status >= 200 && status < 300, status, json: async () => body }
}

// One raw NASA DTO (snake_case), the shape the adapter maps to a domain ApodEntry.
function dto(date: string, overrides: Record<string, unknown> = {}) {
    return {
        date,
        title: `APOD ${date}`,
        url: 'https://apod/img.jpg',
        explanation: 'A description.',
        media_type: 'image',
        thumbnail_url: 'https://apod/thumb.jpg',
        ...overrides
    }
}

// Pull start_date / end_date out of a requested URL for window assertions.
function window(url: string) {
    const q = new URL(url).searchParams
    return { start: q.get('start_date'), end: q.get('end_date') }
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

const catalog = () => nasaApodCatalog('test-key', 'https://api.nasa.gov/planetary/apod')

describe('nasaApodCatalog window splitting', () => {
    it('splits a >90-day range into contiguous windows and concatenates the results', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(res(200, [dto('2026-01-01')]))
            .mockResolvedValueOnce(res(200, [dto('2026-04-01')]))
        vi.stubGlobal('fetch', fetchMock)

        // 91 inclusive days -> a full 90-day window plus a single trailing day.
        const entries = await catalog().fetchRange('2026-01-01', '2026-04-01')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(window(fetchMock.mock.calls[0][0])).toEqual({ start: '2026-01-01', end: '2026-03-31' })
        expect(window(fetchMock.mock.calls[1][0])).toEqual({ start: '2026-04-01', end: '2026-04-01' })
        expect(entries.map((e) => e.date)).toEqual(['2026-01-01', '2026-04-01'])
    })

    it('fetches a single window when start equals end', async () => {
        const fetchMock = vi.fn().mockResolvedValue(res(200, [dto('2026-01-01')]))
        vi.stubGlobal('fetch', fetchMock)

        await catalog().fetchRange('2026-01-01', '2026-01-01')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(window(fetchMock.mock.calls[0][0])).toEqual({ start: '2026-01-01', end: '2026-01-01' })
    })

    it('maps snake_case DTOs to domain entries and narrows unknown media types to "other"', async () => {
        const fetchMock = vi.fn().mockResolvedValue(res(200, [
            dto('2026-01-01', { media_type: 'video' }),
            dto('2026-01-02', { media_type: 'audio' })
        ]))
        vi.stubGlobal('fetch', fetchMock)

        const [video, unknown] = await catalog().fetchRange('2026-01-01', '2026-01-02')

        expect(video).toEqual({
            date: '2026-01-01',
            title: 'APOD 2026-01-01',
            url: 'https://apod/img.jpg',
            explanation: 'A description.',
            mediaType: 'video',
            thumbnailUrl: 'https://apod/thumb.jpg'
        })
        expect(unknown!.mediaType).toBe('other')
    })
})

describe('nasaApodCatalog retry', () => {
    it('retries a transient 429 and succeeds', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(res(429))
            .mockResolvedValueOnce(res(200, [dto('2026-01-01')]))
        vi.stubGlobal('fetch', fetchMock)

        const pending = catalog().fetchRange('2026-01-01', '2026-01-01')
        await vi.runAllTimersAsync()
        const entries = await pending

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(entries.map((e) => e.date)).toEqual(['2026-01-01'])
    })

    it('does NOT retry a non-transient 400, throws an UpstreamError immediately', async () => {
        const fetchMock = vi.fn().mockResolvedValue(res(400))
        vi.stubGlobal('fetch', fetchMock)

        await expect(catalog().fetchRange('2026-01-01', '2026-01-01')).rejects.toThrow(UpstreamError)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('gives up after 4 attempts on a persistent transient error', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn().mockResolvedValue(res(503))
        vi.stubGlobal('fetch', fetchMock)

        const pending = catalog().fetchRange('2026-01-01', '2026-01-01')
        // Surface the rejection now so it isn't flagged as unhandled while timers run.
        const assertion = expect(pending).rejects.toMatchObject({ service: 'nasa', status: 503 })
        await vi.runAllTimersAsync()
        await assertion

        expect(fetchMock).toHaveBeenCalledTimes(4)
    })
})
