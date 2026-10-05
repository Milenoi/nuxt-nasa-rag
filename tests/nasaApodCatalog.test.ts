import { describe, it, expect, vi, afterEach } from 'vitest'
import { nasaApodCatalog } from '../server/infrastructure/nasaApodCatalog'
import { UpstreamError } from '../server/usecases/errors'

const ASSETS = 'https://assets.science.nasa.gov'
const PLACEHOLDER = `${ASSETS}/dynamicimage/assets/science/astro/programs/cosmic-origins/images/misc/news-thumbnail.png?w=594&h=516`

// A fake fetch Response with just the bits the adapter reads.
function res(status: number, body: unknown = [], totalPages = 1) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'x-wp-totalpages': String(totalPages) }),
        json: async () => body
    }
}

// The legacy single-page markup, trimmed to what the adapter reads.
const page = (media: string) => `<center><h1> Astronomy Picture of the Day </h1><p>2026 October 5<br>${media}</center>`

// One raw apod-basic DTO, trimmed from a real October 2026 response.
function dto(date: string, overrides: Record<string, unknown> = {}) {
    return {
        date,
        title: `APOD&#039;s ${date}`,
        explanation: '<strong>Explanation: </strong>A <a href="#">deep</a> image.<br><br><strong>Tomorrow\'s picture: </strong>a smile',
        media_type: 'image',
        permalink: `https://science.nasa.gov/image-article/apod-${date}/`,
        hdurl: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/october/M104_4222.jpg?w=4222&h=2817`,
        copyright: '<a href="#">Engelbert Vollmer</a>',
        basic_html: page(`<IMG SRC="${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/october/M104_4222.jpg">`),
        ...overrides
    }
}

const requested = (call: unknown[]) => new URL(call[0] as string).searchParams

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('nasaApodCatalog paging', () => {
    it('asks for the range in yymmdd and walks every page the first one reports', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(res(200, [dto('2026-10-05')], 2))
            .mockResolvedValueOnce(res(200, [dto('2026-08-01')], 2))
        vi.stubGlobal('fetch', fetchMock)

        const entries = await nasaApodCatalog().fetchRange('2026-08-01', '2026-10-05')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        const first = requested(fetchMock.mock.calls[0]!)
        expect(first.get('date_from')).toBe('260801')
        expect(first.get('date_to')).toBe('261005')
        expect(requested(fetchMock.mock.calls[1]!).get('page')).toBe('2')
        expect(entries.map((e) => e.date)).toEqual(['2026-08-01', '2026-10-05'])
    })

    it('returns nothing for a day that is not published yet', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [], 0)))

        expect(await nasaApodCatalog().fetchRange('2026-10-06', '2026-10-06')).toEqual([])
    })
})

describe('nasaApodCatalog mapping', () => {
    it('takes the image from the page markup and cleans the text fields', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [dto('2026-10-05')])))

        const [entry] = await nasaApodCatalog().fetchRange('2026-10-05', '2026-10-05')

        expect(entry).toEqual({
            date: '2026-10-05',
            title: 'APOD\'s 2026-10-05',
            url: `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/october/M104_4222.jpg`,
            explanation: 'A deep image.',
            mediaType: 'image',
            thumbnailUrl: undefined,
            copyright: 'Engelbert Vollmer'
        })
    })

    it('ignores the generic placeholder and falls back to the page image', async () => {
        const gif = `${ASSETS}/content/dam/science/cds/apod/apod/1995/june/e_lens.gif`
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [
            dto('1995-06-16', { hdurl: PLACEHOLDER, basic_html: page(`<IMG SRC="${gif}">`) })
        ])))

        const [entry] = await nasaApodCatalog().fetchRange('1995-06-16', '1995-06-16')

        expect(entry!.url).toBe(gif)
    })

    it('marks a day whose media was lost in the migration as "other", so ingest skips it', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [
            dto('2024-06-03', { hdurl: PLACEHOLDER, basic_html: page('') })
        ])))

        const [entry] = await nasaApodCatalog().fetchRange('2024-06-03', '2024-06-03')

        expect(entry!.mediaType).toBe('other')
    })

    it('plays a self-hosted video and uses the snapshot as thumbnail', async () => {
        const mp4 = `${ASSETS}/content/dam/science/cds/apod/apod/2026/september/Comet.mp4`
        const snapshot = `${ASSETS}/dynamicimage/assets/science/cds/apod/apod/2026/september/Comet_snapshot.png`
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [
            dto('2026-09-13', { media_type: 'video', hdurl: snapshot, basic_html: page(`<video><source src="${mp4}" type="video/mp4"></video>`) })
        ])))

        const [entry] = await nasaApodCatalog().fetchRange('2026-09-13', '2026-09-13')

        expect(entry!.url).toBe(mp4)
        expect(entry!.thumbnailUrl).toBe(snapshot)
    })

    it('makes a protocol-relative YouTube embed absolute and derives its thumbnail', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [
            dto('2026-08-23', { media_type: 'video', hdurl: PLACEHOLDER, basic_html: page('<iframe src="//www.youtube.com/embed/UgxWkOXcdZU?rel=0"></iframe>') })
        ])))

        const [entry] = await nasaApodCatalog().fetchRange('2026-08-23', '2026-08-23')

        expect(entry!.url).toBe('https://www.youtube.com/embed/UgxWkOXcdZU?rel=0')
        expect(entry!.thumbnailUrl).toBe('https://img.youtube.com/vi/UgxWkOXcdZU/hqdefault.jpg')
    })

    it('narrows unknown media types to "other"', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [dto('2026-01-01', { media_type: 'audio' })])))

        const [entry] = await nasaApodCatalog().fetchRange('2026-01-01', '2026-01-01')

        expect(entry!.mediaType).toBe('other')
    })

    it('treats a plain credit as public domain, so the picture may be reused as preview', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(200, [
            dto('2026-10-03', { copyright: '<strong>Image Credit:</strong> <a href="#">NASA</a>, <a href="#">JPL-Caltech</a>' }),
            dto('2015-07-04', { copyright: '<b> Image Credit &amp; <a href="#">Copyright</a>: </b> <a href="#">Robert Schwarz</a>' })
        ])))

        const [archived, current] = await nasaApodCatalog().fetchRange('2015-07-04', '2026-10-03')

        expect(current!.copyright).toBeUndefined()
        expect(archived!.copyright).toBe('Robert Schwarz')
    })
})

describe('nasaApodCatalog retry', () => {
    it('retries a transient 429 and succeeds', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(res(429))
            .mockResolvedValueOnce(res(200, [dto('2026-01-01')]))
        vi.stubGlobal('fetch', fetchMock)

        const pending = nasaApodCatalog().fetchRange('2026-01-01', '2026-01-01')
        await vi.runAllTimersAsync()
        const entries = await pending

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(entries.map((e) => e.date)).toEqual(['2026-01-01'])
    })

    it('does NOT retry a non-transient 400, throws an UpstreamError immediately', async () => {
        const fetchMock = vi.fn().mockResolvedValue(res(400))
        vi.stubGlobal('fetch', fetchMock)

        await expect(nasaApodCatalog().fetchRange('2026-01-01', '2026-01-01')).rejects.toThrow(UpstreamError)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('gives up after 4 attempts on a persistent transient error', async () => {
        vi.useFakeTimers()
        const fetchMock = vi.fn().mockResolvedValue(res(503))
        vi.stubGlobal('fetch', fetchMock)

        const pending = nasaApodCatalog().fetchRange('2026-01-01', '2026-01-01')
        // Surface the rejection now so it isn't flagged as unhandled while timers run.
        const assertion = expect(pending).rejects.toMatchObject({ service: 'nasa', status: 503 })
        await vi.runAllTimersAsync()
        await assertion

        expect(fetchMock).toHaveBeenCalledTimes(4)
    })
})
