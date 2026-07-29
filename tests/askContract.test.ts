import { describe, it, expect } from 'vitest'
import { askResponseSchema, suggestResponseSchema } from '#shared/contracts/ask'

const validResponse = {
    question: 'what is the andromeda galaxy',
    state: 'answered',
    sources: [
        {
            date: '2024-09-08',
            title: 'M31: The Andromeda Galaxy',
            imageUrl: 'https://example.com/m31.jpg',
            explanation: 'The Andromeda galaxy is the nearest large spiral.',
            mediaType: 'image',
            thumbnailUrl: 'https://example.com/m31-thumb.jpg',
            score: 0.86
        }
    ],
    topScore: 0.86,
    answer: 'Andromeda is the nearest large spiral galaxy to the Milky Way.',
    remark: ''
}

describe('askResponseSchema', () => {
    it('accepts a well-formed response', () => {
        expect(() => askResponseSchema.parse(validResponse)).not.toThrow()
    })
    it('rejects an invalid decision state', () => {
        expect(() => askResponseSchema.parse({ ...validResponse, state: 'bogus' })).toThrow()
    })
    it('rejects a response with a missing field', () => {
        expect(() => askResponseSchema.parse({ ...validResponse, answer: undefined })).toThrow()
    })
})

describe('suggestResponseSchema', () => {
    it('accepts a suggestions list', () => {
        expect(() => suggestResponseSchema.parse({ suggestions: [] })).not.toThrow()
        expect(() => suggestResponseSchema.parse({ suggestions: ['a', 'b'] })).not.toThrow()
    })
})
