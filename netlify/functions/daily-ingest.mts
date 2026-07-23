import { Index } from '@upstash/vector'
import { isUsableApod, toVectorItem } from '../../server/utils/apodVector'

// Daily top-up: fetch today's APOD, embed its explanation, upsert into Upstash.
// The big historical backfill stays in scripts/ingest.ts (run manually); this
// only ever adds the single new day APOD publishes, so no batching/pausing is
// needed. Upsert is idempotent on the date id, so a re-run is harmless.
//
// NOT YET ACTIVE: the `schedule` in the `config` export at the bottom is
// commented out, so this deploys as a plain (manually callable) function, not a
// cron. To turn the daily job on: uncomment `config`, confirm NASA / GEMINI /
// UPSTASH env vars are set in the Netlify dashboard, and redeploy. Keep it off
// until the 3-year backfill is fully in the DB, so the top-up doesn't overlap
// the staged backfill.

const NASA_API_KEY = process.env.NASA_API_KEY
const NASA_APOD_API_URL = process.env.NUXT_NASA_APOD_API_URL

export default async () => {
    if (!NASA_API_KEY || !NASA_APOD_API_URL) {
        return new Response('Missing NASA env vars', { status: 500 })
    }

    // No date param = today's APOD. thumbs=true yields video thumbnails too.
    const res = await fetch(`${NASA_APOD_API_URL}?api_key=${NASA_API_KEY}&thumbs=true`)
    if (!res.ok) {
        return new Response(`NASA API returned ${res.status}`, { status: 502 })
    }
    const entry = await res.json()

    // Skip days we can't ground on (no explanation) or can't show (not image/video).
    if (!isUsableApod(entry)) {
        return new Response(`Skipped ${entry.date} (${entry.media_type}, nothing to index)`, { status: 200 })
    }

    // toVectorItem embeds + builds the record; upsert the single day.
    const index = Index.fromEnv()
    await index.upsert([await toVectorItem(entry)])

    return new Response(`Upserted ${entry.date}: ${entry.title}`, { status: 200 })
}

// Uncomment to activate the daily cron (08:00 UTC, after APOD publishes):
// export const config = {
//     schedule: '0 8 * * *'
// }
