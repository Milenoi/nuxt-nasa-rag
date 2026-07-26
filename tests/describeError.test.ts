import { describe, it, expect } from 'vitest'
import { describeError } from '../app/utils/describeError'

describe('describeError', () => {
    it('names the Gemini quota limit on a 429 status code', () => {
        expect(describeError({ statusCode: 429 })).toMatch(/free-tier limit/i)
    })

    it('detects a 429 inside the error data or message', () => {
        expect(describeError({ message: 'Request failed with status code 429' })).toMatch(/free-tier limit/i)
        expect(describeError({ data: { error: 'HTTP 429 Too Many Requests' } })).toMatch(/free-tier limit/i)
    })

    it('detects quota wording without a numeric code', () => {
        expect(describeError({ message: 'quota exceeded' })).toMatch(/free-tier limit/i)
        expect(describeError({ data: { reason: 'rate limit reached' } })).toMatch(/free-tier limit/i)
    })

    it('reports other HTTP status codes with the number', () => {
        expect(describeError({ statusCode: 500 })).toBe('The answer service failed (HTTP 500).')
    })

    it('falls back to a connection message when there is no status code', () => {
        expect(describeError(new Error('network down'))).toMatch(/check your connection/i)
        expect(describeError(undefined)).toMatch(/check your connection/i)
    })
})
