import { Index } from '@upstash/vector'
import { isUsableApod, toVectorItem } from '../../server/utils/apodVector'

// Daily top-up: fetch today's APOD and upsert it. The historical backfill stays
// in scripts/ingest.ts; this only ever adds the one new day. Idempotent on the
// date id, so re-runs are harmless.
const NASA_API_KEY = process.env.NASA_API_KEY
const NASA_APOD_API_URL = process.env.NUXT_NASA_APOD_API_URL

export default async () => {
    if (!NASA_API_KEY || !NASA_APOD_API_URL) {
        return new Response('Missing NASA env vars', { status: 500 })
    }

    // No date param = today. thumbs=true yields video thumbnails.
    const res = await fetch(`${NASA_APOD_API_URL}?api_key=${NASA_API_KEY}&thumbs=true`)
    if (!res.ok) {
        return new Response(`NASA API returned ${res.status}`, { status: 502 })
    }
    const entry = await res.json()

    if (!isUsableApod(entry)) {
        return new Response(`Skipped ${entry.date} (${entry.media_type})`, { status: 200 })
    }

    const index = Index.fromEnv()
    await index.upsert([await toVectorItem(entry)])
    return new Response(`Upserted ${entry.date}: ${entry.title}`, { status: 200 })
}

// Daily at 08:00 UTC, after APOD publishes.
export const config = {
    schedule: '0 8 * * *'
}
