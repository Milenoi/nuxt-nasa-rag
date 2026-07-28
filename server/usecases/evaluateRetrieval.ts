import type { Embedder } from './ports/gateways'
import type { VectorStore } from './ports/repositories'

// One test question with the APOD ids (dates) that should be retrieved. A negative
// case (gibberish or an uncovered topic) has an empty expectedIds.
export interface EvalCase {
    question: string
    expectedIds: string[]
}

export interface EvalCaseResult {
    question: string
    expectedIds: string[]
    retrieved: { id: string; score: number }[]
    hit: boolean            // false for negative cases
    reciprocalRank: number  // 0 for negative cases
    topScore: number
}

export interface EvalReport {
    topK: number
    results: EvalCaseResult[]
    recallAtK: number       // over positive cases only
    mrr: number             // over positive cases only
}

// 1 / (1-based position of the first retrieved id that is expected), else 0.
export function reciprocalRank(retrievedIds: string[], expectedIds: string[]): number {
    const expected = new Set(expectedIds)
    const pos = retrievedIds.findIndex((id) => expected.has(id))
    return pos === -1 ? 0 : 1 / (pos + 1)
}

// Fraction of positive cases (those with expected ids) that got at least one hit.
export function recallAtK(results: EvalCaseResult[]): number {
    const positive = results.filter((r) => r.expectedIds.length > 0)
    if (positive.length === 0) return 0
    return positive.filter((r) => r.hit).length / positive.length
}

// Mean reciprocal rank over the positive cases.
export function mrr(results: EvalCaseResult[]): number {
    const positive = results.filter((r) => r.expectedIds.length > 0)
    if (positive.length === 0) return 0
    return positive.reduce((sum, r) => sum + r.reciprocalRank, 0) / positive.length
}

interface Deps {
    embedder: Embedder
    vectorStore: VectorStore
}

interface Options {
    topK: number
}

// Run each case through the real retrieval path (embed then query) and score it.
// Sequential on purpose: one embed call at a time is gentle on the Gemini quota,
// the same reason the ingest embeds sequentially.
export async function evaluateRetrieval(cases: EvalCase[], deps: Deps, options: Options): Promise<EvalReport> {
    const results: EvalCaseResult[] = []
    for (const c of cases) {
        const vector = await deps.embedder.embed(c.question)
        const sources = await deps.vectorStore.query(vector, options.topK)
        const retrieved = sources.map((s) => ({ id: s.date, score: s.score }))
        const rr = reciprocalRank(retrieved.map((r) => r.id), c.expectedIds)
        results.push({
            question: c.question,
            expectedIds: c.expectedIds,
            retrieved,
            hit: c.expectedIds.length > 0 && rr > 0,
            reciprocalRank: rr,
            topScore: retrieved[0]?.score ?? 0
        })
    }
    return { topK: options.topK, results, recallAtK: recallAtK(results), mrr: mrr(results) }
}
