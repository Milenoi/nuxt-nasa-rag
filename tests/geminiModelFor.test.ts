import { describe, it, expect } from 'vitest'
import { geminiModelFor } from '../server/infrastructure/geminiLanguageModel'

describe('geminiModelFor', () => {
    it('moves down the fallback list with each attempt', () => {
        expect(geminiModelFor(1)).toBe('gemini-3.6-flash')
        expect(geminiModelFor(2)).toBe('gemini-3.5-flash-lite')
        expect(geminiModelFor(3)).toBe('gemini-3.1-flash-lite')
    })

    it('stays on the last model past the end of the list, never back to the busy first one', () => {
        expect(geminiModelFor(4)).toBe('gemini-3.1-flash-lite')
    })
})
