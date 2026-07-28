import 'dotenv/config'
import { loadRagConfig } from '../server/infrastructure/config'
import { geminiEmbedder } from '../server/infrastructure/geminiEmbedder'
import { upstashVectorStore } from '../server/infrastructure/upstashVectorStore'
import { evaluateRetrieval } from '../server/usecases/evaluateRetrieval'
import { evalCases } from './eval-cases'

const TOP_K = 5

async function main() {
    const config = loadRagConfig()

    // Composition root: wire the real adapters, run the retrieval eval.
    const report = await evaluateRetrieval(evalCases, {
        embedder: geminiEmbedder(config.geminiApiKey),
        vectorStore: upstashVectorStore(config.upstashUrl, config.upstashToken)
    }, { topK: TOP_K })

    for (const r of report.results) {
        const kind = r.expectedIds.length === 0 ? 'neg ' : (r.hit ? 'HIT ' : 'miss')
        const rank = r.reciprocalRank > 0 ? `rank ${Math.round(1 / r.reciprocalRank)}` : '-'
        const expected = r.expectedIds.join(', ') || '(none)'
        console.log(`[${kind}] top=${r.topScore.toFixed(3)} ${rank.padEnd(7)} expected=${expected}  "${r.question}"`)
    }
    console.log(`\nRecall@${report.topK}: ${(report.recallAtK * 100).toFixed(0)}%   MRR: ${report.mrr.toFixed(3)}`)
}

main()
