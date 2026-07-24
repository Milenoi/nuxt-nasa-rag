import 'dotenv/config'
import { embed } from '../server/utils/embed'
import { isUsableApod, toVectorItem } from '../server/utils/apodVector'
import { Index } from '@upstash/vector'
import { loadRagConfig, loadNasaConfig } from '../server/infrastructure/config'

const config = loadRagConfig()
const nasa = loadNasaConfig()

const DAYS_BACK = 1095 // how far back from today to fetch (1095 ≈ three years)
const CHUNK_DAYS = 90 // NASA 500s on very large ranges, so fetch in windows this size

// APOD expects dates as YYYY-MM-DD.
const toIso = (d: Date) => d.toISOString().slice(0, 10)

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Embedding now hits the Gemini API, so be resilient to transient rate limits
// (429 / quota) with a short backoff before giving up.
async function embedWithRetry(text: string, attempt = 1): Promise<number[]> {
    try {
        return await embed(text, config.geminiApiKey)
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
    const url = `${nasa.apodUrl}?api_key=${nasa.apiKey}&start_date=${startIso}&end_date=${endIso}&thumbs=true`
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

    // 2. Keep only entries we can ground on and show (see apodVector).
    const usable = entries.filter(isUsableApod)
    console.log(`Got ${usable.length} usable entries (images and videos) from ${entries.length}. Embedding...`)

    // 3. Embed + upsert in small batches, skipping days already stored.
    const index = new Index({ url: config.upstashUrl, token: config.upstashToken })

    // Gather the day-IDs already in the DB (IDs are the APOD dates). A re-run
    // after an aborted ingest then only embeds the days it hasn't done yet, so
    // we never burn embedding quota re-doing finished days. Cursor starts at
    // "0"; an empty nextCursor means the last page.
    const existing = new Set<string>()
    let cursor = '0'
    while (cursor !== '') {
        const page = await index.range({ cursor, limit: 1000, includeMetadata: false })
        for (const v of page.vectors) existing.add(String(v.id))
        cursor = page.nextCursor
    }
    console.log(`${existing.size} entries already in the DB — skipping those.`)

    const pending = usable.filter((entry) => !existing.has(entry.date))
    console.log(`${pending.length} new entries to embed.`)

    // Each batch is embedded and upserted right away, so an abort on a quota
    // limit keeps everything up to the last finished batch. Pause between
    // batches to stay under the per-minute limit.
    const BATCH = 50
    const PAUSE_MS = 30_000

    let done = 0
    for (let start = 0; start < pending.length; start += BATCH) {
        const slice = pending.slice(start, start + BATCH)
        const items = []
        for (const entry of slice) {
            const item = await toVectorItem(entry, embedWithRetry)
            await sleep(120) // gentle pacing within a batch
            items.push(item)
            done++
            console.log(`  ${done}/${pending.length}: ${entry.title}`)
        }
        await index.upsert(items)
        console.log(`Upserted batch — ${done}/${pending.length} new entries done.`)
        if (start + BATCH < pending.length) {
            console.log(`Pausing ${PAUSE_MS / 1000}s before next batch...`)
            await sleep(PAUSE_MS)
        }
    }

    console.log(`Done! ${done} new vectors upserted (${existing.size + done} total in the DB).`)
}

main()
