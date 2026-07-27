import { loadRagConfig, loadNasaConfig } from '../../server/infrastructure/config'
import { geminiEmbedder } from '../../server/infrastructure/geminiEmbedder'
import { nasaApodCatalog } from '../../server/infrastructure/nasaApodCatalog'
import { upstashKnowledgeIndex } from '../../server/infrastructure/upstashKnowledgeIndex'
import { ingestApodRange } from '../../server/usecases/ingestApod'

const toIso = (d: Date) => d.toISOString().slice(0, 10)

// Daily top-up: ingest just today's APOD. Same use case as the backfill, called with
// a one-day range and no onBatch (there is only one entry, so nothing to pace).
export default async () => {
    const config = loadRagConfig()
    const nasa = loadNasaConfig()
    const today = toIso(new Date())

    try {
        const report = await ingestApodRange(today, today, {
            catalog: nasaApodCatalog(nasa.apiKey, nasa.apodUrl),
            embedder: geminiEmbedder(config.geminiApiKey),
            index: upstashKnowledgeIndex(config.upstashUrl, config.upstashToken)
        })
        return new Response(`Ingested ${today}: fetched ${report.fetched}, added ${report.added}.`, { status: 200 })
    } catch (err) {
        return new Response(`Ingest failed: ${(err as Error).message}`, { status: 502 })
    }
}

// Daily at 08:00 UTC, after APOD publishes.
export const config = { schedule: '0 8 * * *' }
