import { describe, it, expect } from 'vitest'
import { reciprocalRank, recallAtK, mrr, evaluateRetrieval } from '../server/usecases/evaluateRetrieval'
import type { EvalCaseResult } from '../server/usecases/evaluateRetrieval'
import type { Embedder } from '../server/usecases/ports/gateways'
import type { VectorStore } from '../server/usecases/ports/repositories'
import type { RetrievedSource } from '../server/domain/ask'

// Build a minimal result row for the aggregate tests.
function result(expectedIds: string[], reciprocalRank: number): EvalCaseResult {
    return {
        question: 'q',
        expectedIds,
        retrieved: [],
        hit: expectedIds.length > 0 && reciprocalRank > 0,
        reciprocalRank,
        topScore: 0
    }
}

describe('reciprocalRank', () => {
    it('is 1 when an expected id is first', () => {
        expect(reciprocalRank(['a', 'b', 'c'], ['a'])).toBe(1)
    })
    it('is 1/2 when an expected id is second', () => {
        expect(reciprocalRank(['x', 'a', 'c'], ['a'])).toBe(0.5)
    })
    it('is 0 when no expected id appears', () => {
        expect(reciprocalRank(['x', 'y'], ['a'])).toBe(0)
    })
})

describe('recallAtK / mrr', () => {
    it('recallAtK counts only positive cases that hit', () => {
        const results = [result(['a'], 1), result(['b'], 0), result([], 0)]
        // 2 positive cases, 1 hit -> 0.5; the negative case is ignored
        expect(recallAtK(results)).toBe(0.5)
    })
    it('mrr averages reciprocal ranks over positive cases', () => {
        const results = [result(['a'], 1), result(['b'], 0.5), result([], 0)]
        expect(mrr(results)).toBeCloseTo(0.75)
    })
    it('are 0 when there are no positive cases', () => {
        expect(recallAtK([result([], 0)])).toBe(0)
        expect(mrr([result([], 0)])).toBe(0)
    })
})

const embedder: Embedder = { embed: async () => [0.1] }

function source(date: string, score: number): RetrievedSource {
    return { date, title: '', imageUrl: '', explanation: '', mediaType: 'image', thumbnailUrl: '', score }
}

// A vector store that returns a fixed list (top-k slice), ignoring the vector.
function vectorStore(sources: RetrievedSource[]): VectorStore {
    return { query: async (_vector, topK) => sources.slice(0, topK) }
}

describe('evaluateRetrieval', () => {
    it('computes per-case results and aggregates over positive cases', async () => {
        const cases = [
            { question: 'lion nebula', expectedIds: ['2024-01-01'] },
            { question: 'asdfgh', expectedIds: [] }
        ]
        const store = vectorStore([source('2024-01-01', 0.8), source('2024-01-02', 0.6)])
        const report = await evaluateRetrieval(cases, { embedder, vectorStore: store }, { topK: 5 })

        expect(report.results[0].hit).toBe(true)
        expect(report.results[0].reciprocalRank).toBe(1)
        expect(report.results[0].topScore).toBe(0.8)
        expect(report.results[1].hit).toBe(false)     // negative case
        expect(report.recallAtK).toBe(1)              // 1 positive case, hit
        expect(report.mrr).toBe(1)
    })
})
