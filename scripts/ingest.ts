import 'dotenv/config'
import { loadRagConfig, loadNasaConfig } from '../server/infrastructure/config'
import { geminiEmbedder } from '../server/infrastructure/geminiEmbedder'
import { nasaApodCatalog } from '../server/infrastructure/nasaApodCatalog'
import { upstashKnowledgeIndex } from '../server/infrastructure/upstashKnowledgeIndex'
import { ingestApodRange } from '../server/usecases/ingestApod'

const DAYS_BACK = 1095 // how far back from today to fetch (1095 ≈ three years)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const toIso = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
    const config = loadRagConfig()
    const nasa = loadNasaConfig()

    const today = new Date()
    const start = new Date()
    start.setDate(today.getDate() - DAYS_BACK)

    // Composition root: build the adapters, run the use case over the whole span.
    const report = await ingestApodRange(toIso(start), toIso(today), {
        catalog: nasaApodCatalog(nasa.apiKey, nasa.apodUrl),
        embedder: geminiEmbedder(config.geminiApiKey),
        index: upstashKnowledgeIndex(config.upstashUrl, config.upstashToken)
    }, {
        batchSize: 50,
        // Backfill-specific pacing: log each batch and pause 30s to stay under the
        // per-minute limit. This is exactly the "onBatch" hook we injected.
        onBatch: async (added, total) => {
            console.log(`Upserted ${added}/${total} new entries.`)
            if (added < total) {
                console.log('Pausing 30s before next batch...')
                await sleep(30_000)
            }
        }
    })

    console.log(`Done! fetched ${report.fetched}, usable ${report.usable}, skipped ${report.skipped}, added ${report.added}.`)
}

main()
