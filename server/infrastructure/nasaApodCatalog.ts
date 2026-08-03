import type { ApodCatalog } from '../usecases/ports/repositories'
import type { ApodEntry } from '../domain/apod'
import { UpstreamError } from '../usecases/errors'

const CHUNK_DAYS = 90 // NASA 500s on very large ranges, so fetch in windows this size
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const toIso = (d: Date) => d.toISOString().slice(0, 10)

// Raw NASA APOD response shape (their snake_case names). Mapped to the domain ApodEntry
// here, so NASA's JSON naming never reaches the core.
interface NasaApodDto {
    date: string
    title: string
    url: string
    explanation: string
    media_type: string
    thumbnail_url?: string
    copyright?: string
}

function toEntry(dto: NasaApodDto): ApodEntry {
    return {
        date: dto.date,
        title: dto.title,
        url: dto.url,
        explanation: dto.explanation,
        mediaType: dto.media_type === 'image' || dto.media_type === 'video' ? dto.media_type : 'other',
        thumbnailUrl: dto.thumbnail_url,
        copyright: dto.copyright
    }
}

// ApodCatalog adapter for the NASA APOD API. Splits a large range into windows
// (NASA rejects very large ones), fetches each with a short retry on transient
// errors, maps the raw DTOs to domain entries, and concatenates. A hard failure
// surfaces as an UpstreamError, like the other adapters.
export function nasaApodCatalog(apiKey: string, apodUrl: string): ApodCatalog {
    // Fetch ONE window, retrying a few times on transient errors (500/503/429).
    async function fetchWindow(startIso: string, endIso: string, attempt = 1): Promise<NasaApodDto[]> {
        const url = `${apodUrl}?api_key=${apiKey}&start_date=${startIso}&end_date=${endIso}&thumbs=true`
        const response = await fetch(url)
        if (!response.ok) {
            const transient = response.status === 503 || response.status === 500 || response.status === 429
            if (transient && attempt < 4) {
                await sleep(attempt * 2000)
                return fetchWindow(startIso, endIso, attempt + 1)
            }
            throw new UpstreamError('nasa', response.status, `NASA API returned ${response.status} for ${startIso}..${endIso}`)
        }
        return response.json()
    }

    return {
        async fetchRange(startDate, endDate) {
            const end = new Date(endDate)
            const windowStart = new Date(startDate)
            const dtos: NasaApodDto[] = []
            while (windowStart <= end) {
                const windowEnd = new Date(windowStart)
                windowEnd.setUTCDate(windowStart.getUTCDate() + CHUNK_DAYS - 1)
                if (windowEnd > end) windowEnd.setTime(end.getTime())
                dtos.push(...(await fetchWindow(toIso(windowStart), toIso(windowEnd))))
                windowStart.setUTCDate(windowStart.getUTCDate() + CHUNK_DAYS)
            }
            return dtos.map(toEntry)
        }
    }
}
