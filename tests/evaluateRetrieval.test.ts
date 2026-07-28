import { describe, it, expect } from 'vitest'
import { reciprocalRank, recallAtK, mrr } from '../server/usecases/evaluateRetrieval'
import type { EvalCaseResult } from '../server/usecases/evaluateRetrieval'

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
