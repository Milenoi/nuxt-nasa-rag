import type { ApodCatalog } from '../usecases/ports/repositories'
import type { ApodEntry } from '../domain/apod'
import { UpstreamError } from '../usecases/errors'
import { decodeEntities, htmlToText } from './apodHtml'

// APOD moved to science.nasa.gov in September 2026. The legacy
// api.nasa.gov/planetary/apod still answers 200, but scrapes the new page wrong and
// returns the NASA logo titled "NASA Science" for every date. Not read from env on
// purpose: a stale deploy variable would silently keep the broken API alive.
const APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic'
// Larger values are ignored and silently return 25.
const PAGE_SIZE = 25

// NASA's generic stand-in, sent as `hdurl` when an entry has no featured image of its
// own (most of the early archive, many video days). It is not the APOD.
const PLACEHOLDER_IMAGE = '/cosmic-origins/images/misc/news-thumbnail'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
// "2026-10-04" -> "261004", the only date format the endpoint accepts.
const toApodDate = (iso: string) => iso.slice(2).replaceAll('-', '')

// Raw apod-basic response shape (their snake_case names). Mapped to the domain
// ApodEntry here, so NASA's JSON naming and HTML never reach the core.
interface NasaApodDto {
    date: string
    title: string
    explanation: string
    media_type: string
    permalink: string
    hdurl?: string | null
    copyright?: string | null
    // `url` in the JSON is the article link, not the media, so the real image or
    // video source is only found in this legacy single-page markup.
    basic_html?: string | null
}

const realImage = (url?: string | null) => (url && !url.includes(PLACEHOLDER_IMAGE) ? url : undefined)

// The first <img>, <iframe> or <source> in the legacy page is the featured media:
// the header above it carries none, the explanation sits below it.
function mediaSource(html?: string | null): string | undefined {
    const src = html?.match(/<(?:img|iframe|source)\b[^>]*?\bsrc="([^"]+)"/i)?.[1]
    if (!src) return undefined
    const url = decodeEntities(src)
    return url.startsWith('//') ? `https:${url}` : url
}

function youtubeThumbnail(url: string): string | undefined {
    const id = url.match(/youtube\.com\/embed\/([\w-]{11})/)?.[1]
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined
}

// Notes like "Tomorrow's picture" follow the text after a double line break. They
// belong to the day's page, and embedding them would pull every answer toward them.
const NOTES_BREAK = /<br\s*\/?>\s*<br\s*\/?>/i

const toExplanation = (html: string) =>
    htmlToText(html.split(NOTES_BREAK)[0] ?? html).replace(/^Explanation:\s*/i, '')

// The field holds every credit, but only one labelled "Copyright" (or a bare name,
// how current entries are written) is a copyright. "Image Credit: NASA" is public
// domain and stays unset, which is what isReusableAsPreview relies on.
function toCopyright(html?: string | null): string | undefined {
    const text = htmlToText(html ?? '')
    const label = text.match(/^[^:]*\bcredit\b[^:]*:\s*/i)?.[0]
    if (label && !/copyright/i.test(label)) return undefined
    return text.slice(label?.length ?? 0).trim() || undefined
}

function toEntry(dto: NasaApodDto): ApodEntry {
    const preview = realImage(dto.hdurl)
    const source = mediaSource(dto.basic_html)
    const media = dto.media_type === 'image' ? source ?? preview : source
    // A few days lost their media in the migration (the markup is empty). Without
    // something to show they are no image or video for us, so isUsableApod drops them.
    const mediaType = media && (dto.media_type === 'image' || dto.media_type === 'video') ? dto.media_type : 'other'

    return {
        date: dto.date,
        title: decodeEntities(dto.title),
        url: media ?? dto.permalink,
        explanation: toExplanation(dto.explanation),
        mediaType,
        thumbnailUrl: mediaType === 'video' ? preview ?? (source && youtubeThumbnail(source)) : undefined,
        copyright: toCopyright(dto.copyright)
    }
}

// ApodCatalog adapter for NASA's apod-basic endpoint. Walks the pages of a date range
// with a short retry on transient errors and maps the raw DTOs to domain entries,
// oldest first like the legacy API (the endpoint pages newest first). A hard failure
// surfaces as an UpstreamError, like the other adapters.
export function nasaApodCatalog(): ApodCatalog {
    async function fetchPage(from: string, to: string, page: number, attempt = 1): Promise<{ dtos: NasaApodDto[], totalPages: number }> {
        const url = `${APOD_URL}?date_from=${from}&date_to=${to}&per_page=${PAGE_SIZE}&page=${page}`
        const response = await fetch(url)
        if (!response.ok) {
            const transient = response.status === 503 || response.status === 500 || response.status === 429
            if (transient && attempt < 4) {
                await sleep(attempt * 2000)
                return fetchPage(from, to, page, attempt + 1)
            }
            throw new UpstreamError('nasa', response.status, `NASA API returned ${response.status} for ${from}..${to} page ${page}`)
        }
        const totalPages = Number(response.headers.get('x-wp-totalpages') ?? 1)
        return { dtos: await response.json(), totalPages }
    }

    return {
        async fetchRange(startDate, endDate) {
            const from = toApodDate(startDate)
            const to = toApodDate(endDate)
            const dtos: NasaApodDto[] = []
            let page = 1
            let totalPages: number
            do {
                const result = await fetchPage(from, to, page)
                dtos.push(...result.dtos)
                totalPages = result.totalPages
                page++
            } while (page <= totalPages)
            return dtos.map(toEntry).sort((a, b) => a.date.localeCompare(b.date))
        }
    }
}
