import type { ApodCatalog } from '../usecases/ports/repositories'
import type { ApodEntry } from '../domain/apod'

const CHUNK_DAYS = 90 // NASA 500s on very large ranges, so fetch in windows this size
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const toIso = (d: Date) => d.toISOString().slice(0, 10)

// ApodCatalog adapter for the NASA APOD API. Splits a large range into windows
// (NASA rejects very large ones), fetches each with a short retry on transient
// errors, and concatenates. The use case just asks for the whole range.
export function nasaApodCatalog(apiKey: string, apodUrl: string): ApodCatalog {
    // Fetch ONE window, retrying a few times on transient errors (500/503/429).
    async function fetchWindow(startIso: string, endIso: string, attempt = 1): Promise<ApodEntry[]> {
        const url = `${apodUrl}?api_key=${apiKey}&start_date=${startIso}&end_date=${endIso}&thumbs=true`
        const response = await fetch(url)
        if (!response.ok) {
            const transient = response.status === 503 || response.status === 500 || response.status === 429
            if (transient && attempt < 4) {
                await sleep(attempt * 2000)
                return fetchWindow(startIso, endIso, attempt + 1)
            }
            throw new Error(`NASA API returned ${response.status} for ${startIso}..${endIso}`)
        }
        return response.json()
    }

    return {
        async fetchRange(startDate, endDate) {
            const end = new Date(endDate)
            const windowStart = new Date(startDate)
            const entries: ApodEntry[] = []
            while (windowStart <= end) {
                const windowEnd = new Date(windowStart)
                windowEnd.setDate(windowStart.getDate() + CHUNK_DAYS - 1)
                if (windowEnd > end) windowEnd.setTime(end.getTime())
                entries.push(...(await fetchWindow(toIso(windowStart), toIso(windowEnd))))
                windowStart.setDate(windowStart.getDate() + CHUNK_DAYS)
            }
            return entries
        }
    }
}
