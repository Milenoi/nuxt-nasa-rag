import { describe, it, expect } from 'vitest'
import { suggestQueries } from '../server/usecases/suggestQueries'
import type { QuerySuggester } from '../server/usecases/ports'

// A suggester stub returning a fixed list, recording what it was asked.
function suggester(list: string[]) {
    const state = { calls: 0, lastInput: '' }
    const s: QuerySuggester = {
        async suggest(question) {
            state.calls++
            state.lastInput = question
            return list
        }
    }
    return { suggester: s, state }
}

describe('suggestQueries', () => {
    it('passes the raw question to the suggester', async () => {
        const s = suggester(['Thor helmet nebula'])
        await suggestQueries('Tohr', { suggester: s.suggester })
        expect(s.state.calls).toBe(1)
        expect(s.state.lastInput).toBe('Tohr')
    })

    it('drops the original question from the suggestions (case-insensitive, trimmed)', async () => {
        const s = suggester(['  nebula  ', 'Thor helmet nebula'])
        const result = await suggestQueries('NEBULA', { suggester: s.suggester })
        expect(result).toEqual(['Thor helmet nebula'])
    })

    it('removes duplicates, keeping the first occurrence', async () => {
        const s = suggester(['Thor helmet nebula', 'thor helmet nebula', 'Ghost nebula'])
        const result = await suggestQueries('x', { suggester: s.suggester })
        expect(result).toEqual(['Thor helmet nebula', 'Ghost nebula'])
    })

    it('caps the list at three', async () => {
        const s = suggester(['a', 'b', 'c', 'd', 'e'])
        const result = await suggestQueries('x', { suggester: s.suggester })
        expect(result).toHaveLength(3)
        expect(result).toEqual(['a', 'b', 'c'])
    })

    it('returns an empty list when the suggester returns nothing usable', async () => {
        const s = suggester(['', '   '])
        const result = await suggestQueries('x', { suggester: s.suggester })
        expect(result).toEqual([])
    })
})
