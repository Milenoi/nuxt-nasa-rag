import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { toHttpError, runUpstream } from '../server/infrastructure/upstreamError'
import { UpstreamError } from '../server/usecases/errors'

// toHttpError calls Nitro's auto-imported createError, absent in plain vitest.
// Stub it to return its options so we can assert the mapping.
beforeEach(() => {
    vi.stubGlobal('createError', (opts: unknown) => opts)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
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

    it('passes a 503 through so the UI can say "busy, try again" instead of "broken"', () => {
        const http = toHttpError(new UpstreamError('gemini-generate', 503, 'high demand')) as {
            statusCode: number
            statusMessage: string
        }
        expect(http.statusCode).toBe(503)
        expect(http.statusMessage).toBe('Upstream gemini-generate failed (503)')
    })

    it('reports a timed-out upstream as 503, so the UI says "busy" rather than "broken"', () => {
        const http = toHttpError(new UpstreamError('gemini-generate', 504, 'stalled')) as {
            statusCode: number
            statusMessage: string
        }
        expect(http.statusCode).toBe(503)
        expect(http.statusMessage).toBe('Upstream gemini-generate failed (504)')
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

// Build an error shaped like the ones the Gemini / Upstash SDKs throw.
const sdkError = (status: number, message: string) => Object.assign(new Error(message), { status })

// Let the retry backoff elapse without waiting in real time, and swallow the
// rejection up front so an in-flight retry never trips an unhandled rejection.
async function settle<T>(promise: Promise<T>) {
    const caught = promise.catch((err: unknown) => err)
    await vi.runAllTimersAsync()
    return caught
}

describe('runUpstream', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns the value untouched when the call succeeds', async () => {
        const call = vi.fn().mockResolvedValue('answer')
        await expect(settle(runUpstream('gemini-generate', call))).resolves.toBe('answer')
        expect(call).toHaveBeenCalledTimes(1)
    })

    it('retries a 503 and succeeds once the model has capacity again', async () => {
        const call = vi
            .fn()
            .mockRejectedValueOnce(sdkError(503, 'This model is currently experiencing high demand'))
            .mockResolvedValueOnce('answer')

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toBe('answer')
        expect(call).toHaveBeenCalledTimes(2)
    })

    it('passes the attempt number on each retry, so an adapter can fall back to another model', async () => {
        const call = vi
            .fn()
            .mockRejectedValueOnce(sdkError(503, 'high demand'))
            .mockRejectedValueOnce(sdkError(503, 'high demand'))
            .mockResolvedValueOnce('answer')

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toBe('answer')
        expect(call.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3])
    })

    it('aborts an attempt that stalls and retries it as a 504, so a slow model cannot eat the function limit', async () => {
        const stall = (_attempt: number, signal: AbortSignal) =>
            new Promise<string>((_resolve, reject) => {
                signal.addEventListener('abort', () => reject(signal.reason))
            })
        const call = vi.fn().mockImplementationOnce(stall).mockResolvedValueOnce('answer')

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toBe('answer')
        expect(call).toHaveBeenCalledTimes(2)
        expect(call.mock.calls[0][1].aborted).toBe(true)
    })

    it('caps each attempt at 8 seconds, no earlier', async () => {
        let signal: AbortSignal | undefined
        const call = vi.fn((_attempt: number, s: AbortSignal) => {
            signal = s
            return new Promise<string>(() => {})
        })

        void runUpstream('gemini-generate', call).catch(() => {})
        await vi.advanceTimersByTimeAsync(7999)
        expect(signal?.aborted).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        expect(signal?.aborted).toBe(true)
    })

    it('keeps the real status of a slow failure that ignored the signal, so a late 429 is not retried', async () => {
        const call = vi.fn(
            () =>
                new Promise<string>((_resolve, reject) => {
                    setTimeout(() => reject(sdkError(429, 'You exceeded your current quota')), 9000)
                })
        )

        await expect(settle(runUpstream('gemini-embed', call))).resolves.toMatchObject({ status: 429 })
        expect(call).toHaveBeenCalledTimes(1)
    })

    it('leaves no timer behind once an attempt has answered', async () => {
        await settle(runUpstream('gemini-generate', vi.fn().mockResolvedValue('answer')))
        expect(vi.getTimerCount()).toBe(0)
    })

    it('reports a 504 once every attempt has stalled', async () => {
        const call = vi.fn(
            (_attempt: number, signal: AbortSignal) =>
                new Promise<string>((_resolve, reject) => {
                    signal.addEventListener('abort', () => reject(signal.reason))
                })
        )

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toMatchObject({ status: 504 })
        expect(call).toHaveBeenCalledTimes(3)
    })

    it('gives up after the retry budget and reports the real upstream status', async () => {
        const call = vi.fn().mockRejectedValue(sdkError(503, 'high demand'))

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toMatchObject({
            name: 'UpstreamError',
            service: 'gemini-generate',
            status: 503
        })
        expect(call).toHaveBeenCalledTimes(3)
    })

    it('does not retry a 429: the daily quota will not recover in a second and every attempt spends one', async () => {
        const call = vi.fn().mockRejectedValue(sdkError(429, 'You exceeded your current quota'))

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toMatchObject({ status: 429 })
        expect(call).toHaveBeenCalledTimes(1)
    })

    it('does not retry a rejected key, which fails identically every time', async () => {
        const call = vi.fn().mockRejectedValue(sdkError(400, 'API key not valid'))

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toMatchObject({ status: 400 })
        expect(call).toHaveBeenCalledTimes(1)
    })

    it('does not retry a schema mismatch, so a deterministic bug cannot burn the quota three times over', async () => {
        const call = vi.fn().mockRejectedValue(new Error('invalid_type: expected string, received number'))

        await expect(settle(runUpstream('gemini-generate', call))).resolves.toMatchObject({ status: 502 })
        expect(call).toHaveBeenCalledTimes(1)
    })

    it('passes an UpstreamError from a nested adapter straight through without re-wrapping or retrying', async () => {
        const call = vi.fn().mockRejectedValue(new UpstreamError('nasa', 503, 'already typed'))

        await expect(settle(runUpstream('outer', call))).resolves.toMatchObject({ service: 'nasa' })
        expect(call).toHaveBeenCalledTimes(1)
    })
})
