import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toHttpError } from '../server/infrastructure/upstreamError'
import { UpstreamError } from '../server/usecases/errors'

// toHttpError calls Nitro's auto-imported createError, absent in plain vitest.
// Stub it to return its options so we can assert the mapping.
beforeEach(() => {
    vi.stubGlobal('createError', (opts: unknown) => opts)
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('toHttpError', () => {
    it('passes a 429 through so the user can retry, keeping service + status in the message', () => {
        const http = toHttpError(new UpstreamError('gemini', 429, 'rate limited')) as {
            statusCode: number
            statusMessage: string
        }
        expect(http.statusCode).toBe(429)
        expect(http.statusMessage).toBe('Upstream gemini failed (429)')
    })

    it('sanitises any other upstream status to 502 (no raw 403/500 leaks out)', () => {
        const http = toHttpError(new UpstreamError('upstash', 403, 'forbidden')) as {
            statusCode: number
            statusMessage: string
        }
        expect(http.statusCode).toBe(502)
        expect(http.statusMessage).toBe('Upstream upstash failed (403)')
    })

    it('maps an unknown (non-UpstreamError) error to a generic 502', () => {
        const http = toHttpError(new Error('boom')) as { statusCode: number; statusMessage: string }
        expect(http.statusCode).toBe(502)
        expect(http.statusMessage).toBe('Upstream service failed')
    })

    it('logs the failing service and status server-side', () => {
        const spy = vi.spyOn(console, 'error')
        toHttpError(new UpstreamError('nasa', 503, 'unavailable'))
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('nasa failed with status 503'),
            expect.anything()
        )
    })
})
