import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'node:fs'
import { embed } from '../server/utils/embed'
import type { ApodRecord } from '../shared/apod'

const NASA_API_KEY = process.env.NASA_API_KEY
const NASA_APOD_API_URL = process.env.NUXT_NASA_APOD_API_URL

const DAYS_BACK = 365 // how far back from today to fetch (365 ≈ one year)
const CHUNK_DAYS = 90 // NASA 500s on very large ranges, so fetch in windows this size

// APOD expects dates as YYYY-MM-DD.
const toIso = (d: Date) => d.toISOString().slice(0, 10)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Embedding now hits the Gemini API, so be resilient to transient rate limits
// (429 / quota) with a short backoff before giving up.
async function embedWithRetry(text: string, attempt = 1): Promise<number[]> {
    try {
        return await embed(text)
    } catch (err) {
        const message = String((err as Error)?.message ?? err)
        const rateLimited = message.includes('429') || /quota|rate|exhausted/i.test(message)
        if (rateLimited && attempt < 5) {
            const wait = attempt * 4000
            console.log(`  embed rate-limited — retry ${attempt} in ${wait}ms`)
            await sleep(wait)
            return embedWithRetry(text, attempt + 1)
        }
        throw err
    }
}

// Fetch one date-range window, retrying a few times on transient errors.
async function fetchRange(startIso: string, endIso: string, attempt = 1) {
    const url = `${NASA_APOD_API_URL}?api_key=${NASA_API_KEY}&start_date=${startIso}&end_date=${endIso}&thumbs=true`
    const response = await fetch(url)

    if (!response.ok) {
        const transient = response.status === 503 || response.status === 500 || response.status === 429
        if (transient && attempt < 4) {
            const wait = attempt * 2000
            console.log(`  ${response.status} for ${startIso}..${endIso} — retry ${attempt} in ${wait}ms`)
            await sleep(wait)
            return fetchRange(startIso, endIso, attempt + 1)
        }
        // Don't blindly JSON.parse an error page — surface a readable message.
        throw new Error(`NASA API returned ${response.status} for ${startIso}..${endIso}`)
    }

    return response.json()
}

async function main() {
    if (!NASA_API_KEY) throw new Error('NASA_API_KEY missing in .env')
    if (!NASA_APOD_API_URL) throw new Error('NUXT_NASA_APOD_API_URL missing in .env')

    // 1. Fetch the whole [today - DAYS_BACK, today] span in CHUNK_DAYS windows.
    const today = new Date()
    const chunkStart = new Date()
    chunkStart.setDate(today.getDate() - DAYS_BACK)

    const entries = []
    while (chunkStart <= today) {
        const chunkEnd = new Date(chunkStart)
        chunkEnd.setDate(chunkStart.getDate() + CHUNK_DAYS - 1)
        if (chunkEnd > today) chunkEnd.setTime(today.getTime())

        console.log(`Fetching ${toIso(chunkStart)}..${toIso(chunkEnd)}...`)
        const chunk = await fetchRange(toIso(chunkStart), toIso(chunkEnd))
        entries.push(...chunk)

        // Advance to the next window (day after this window's end).
        chunkStart.setDate(chunkStart.getDate() + CHUNK_DAYS)
    }

    // 2. Keep only image entries that actually have an explanation text.
   const usable = entries.filter((e) => (e.media_type === 'image' || e.media_type === 'video') && e.explanation)
    console.log(`Got ${usable.length} usable images from ${entries.length} entries. Embedding...`)

    // 3. Embed each explanation and build our records.
    const records: ApodRecord[] = []
    for (let i = 0; i < usable.length; i++) {
        const entry = usable[i]
        const vector = await embedWithRetry(entry.explanation)
        await sleep(120) // gentle pacing so we stay under the per-minute limit
        records.push({
            date: entry.date,
            title: entry.title,
            imageUrl: entry.url,
            explanation: entry.explanation,
            mediaType: entry.media_type,
            thumbnailUrl: entry.thumbnail_url,
            vector
        })
        console.log(`  ${i + 1}/${usable.length}: ${entry.title}`)
    }

    // 4. Write the filled shelf to disk.
    mkdirSync('data', { recursive: true })
    writeFileSync('data/apod-vectors.json', JSON.stringify(records, null, 2))
    console.log(`Done! Wrote ${records.length} records to data/apod-vectors.json`)
}

main()
