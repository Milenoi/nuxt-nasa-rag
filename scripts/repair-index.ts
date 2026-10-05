import 'dotenv/config'
import { Index } from '@upstash/vector'
import { loadRagConfig } from '../server/infrastructure/config'
import { nasaApodCatalog } from '../server/infrastructure/nasaApodCatalog'
import { isUsableApod } from '../server/domain/apod'
import type { ApodMetadata } from '../server/usecases/ports/repositories'

// One-off repair after APOD's move to science.nasa.gov (Sept 2026). Days ingested from
// the broken legacy API have a wrong text and thus a wrong vector: deleted, so the next
// `npm run ingest` re-adds them. All other records only point at dead apod.nasa.gov
// media; their text is unchanged, so patching the metadata saves re-embedding three years.
const apply = process.argv.includes('--apply')

const isBroken = (m: ApodMetadata) => m.title === 'NASA Science' || m.imageUrl.includes('nasa-logo')

async function main() {
    const config = loadRagConfig()
    const index = new Index<ApodMetadata>({ url: config.upstashUrl, token: config.upstashToken })

    const records: { id: string, metadata: ApodMetadata }[] = []
    let cursor = '0'
    while (cursor !== '') {
        const page = await index.range({ cursor, limit: 1000, includeMetadata: true })
        for (const v of page.vectors) records.push({ id: String(v.id), metadata: v.metadata! })
        cursor = page.nextCursor
    }
    const dates = records.map((r) => r.id).sort()
    console.log(`Index: ${records.length} records, ${dates[0]}..${dates.at(-1)}.`)

    const entries = await nasaApodCatalog().fetchRange(dates[0]!, dates.at(-1)!)
    const byDate = new Map(entries.map((e) => [e.date, e]))

    const toDelete: string[] = []
    const toPatch: { id: string, imageUrl: string, thumbnailUrl: string }[] = []
    for (const { id, metadata } of records) {
        const entry = byDate.get(id)
        if (isBroken(metadata) || !entry || !isUsableApod(entry)) {
            toDelete.push(id)
            continue
        }
        const thumbnailUrl = entry.thumbnailUrl ?? ''
        if (metadata.imageUrl !== entry.url || metadata.thumbnailUrl !== thumbnailUrl) {
            toPatch.push({ id, imageUrl: entry.url, thumbnailUrl })
        }
    }

    console.log(`Delete ${toDelete.length}: ${toDelete.join(', ') || '-'}`)
    console.log(`Patch media URLs of ${toPatch.length} records.`)
    if (!apply) {
        console.log('Dry run, nothing written. Re-run with --apply.')
        return
    }

    if (toDelete.length) await index.delete(toDelete)
    for (const [i, p] of toPatch.entries()) {
        await index.update({ id: p.id, metadata: { imageUrl: p.imageUrl, thumbnailUrl: p.thumbnailUrl }, metadataUpdateMode: 'PATCH' })
        if ((i + 1) % 100 === 0) console.log(`Patched ${i + 1}/${toPatch.length}.`)
    }
    console.log('Done. Run `npm run ingest` to re-add the deleted days.')
}

main()
