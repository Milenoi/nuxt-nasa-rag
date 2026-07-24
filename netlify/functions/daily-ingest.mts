import { Index } from '@upstash/vector'
import { isUsableApod, toVectorItem } from '../../server/utils/apodVector'
import { embed } from '../../server/utils/embed'
import { loadRagConfig, loadNasaConfig } from '../../server/infrastructure/config'

// Daily top-up: fetch today's APOD and upsert it. The historical backfill stays
// in scripts/ingest.ts; this only ever adds the one new day. Idempotent on the
// date id, so re-runs are harmless.
export default async () => {
    const nasa = loadNasaConfig()

    // No date param = today. thumbs=true yields video thumbnails.
    const res = await fetch(`${nasa.apodUrl}?api_key=${nasa.apiKey}&thumbs=true`)
    if (!res.ok) {
        return new Response(`NASA API returned ${res.status}`, { status: 502 })
    }
    const entry = await res.json()

    if (!isUsableApod(entry)) {
        return new Response(`Skipped ${entry.date} (${entry.media_type})`, { status: 200 })
    }

    const config = loadRagConfig()
    const index = new Index({ url: config.upstashUrl, token: config.upstashToken })
    await index.upsert([await toVectorItem(entry, (text) => embed(text, config.geminiApiKey))])
    return new Response(`Upserted ${entry.date}: ${entry.title}`, { status: 200 })
}

// Daily at 08:00 UTC, after APOD publishes.
export const config = {
    schedule: '0 8 * * *'
}
