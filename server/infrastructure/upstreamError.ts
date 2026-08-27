import { UpstreamError } from '../usecases/errors'

// Only statuses that mean "busy", never "wrong". 429 is excluded on purpose: the
// daily quota does not recover within seconds and each attempt spends one of the
// few calls left. So is 502, which statusOf also returns for errors carrying no
// status at all (schema mismatch, bad JSON), which reproduce identically.
const RETRY_STATUSES = [500, 503, 504]
const MAX_ATTEMPTS = 3

// Short by necessity: this runs inside a serverless request that still owes the
// user an answer, not a background job that can afford minutes.
const backoffMs = (attempt: number) => attempt * 300

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Extract an HTTP-ish status from a raw SDK / fetch error (Gemini, Upstash, NASA).
// This is the ONE place that knows what those error shapes look like.
function statusOf(err: unknown): number {
    const e = err as { status?: number; code?: number; statusCode?: number; message?: string }
    const fromMsg = Number(/\b(4\d\d|5\d\d)\b/.exec(e?.message ?? '')?.[1])
    const status = e?.status ?? e?.code ?? e?.statusCode ?? (fromMsg || 502)
    return status >= 400 && status < 600 ? status : 502
}

// Run an external-service call, retrying the handful of statuses that mean "busy,
// try again" and, on final failure, rethrowing as an UpstreamError tagged with the
// service + its status. Adapters wrap their SDK calls in this, so the raw SDK error
// shape never leaves the infrastructure layer.
export async function runUpstream<T>(service: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await fn()
        } catch (err) {
            // An adapter deeper down already typed and retried this one.
            if (err instanceof UpstreamError) throw err

            const status = statusOf(err)
            if (!RETRY_STATUSES.includes(status) || attempt >= MAX_ATTEMPTS) {
                throw new UpstreamError(service, status, `${service} request failed`, err)
            }
            console.warn(`[upstream] ${service} returned ${status}, retry ${attempt}/${MAX_ATTEMPTS - 1}`)
            await sleep(backoffMs(attempt))
        }
    }
}

// Map an UpstreamError to a client HTTP error: 429 (quota) and 503 (upstream busy)
// pass through, because both are worth retrying and the UI phrases them differently.
// Anything else becomes 502 (a server-side upstream problem, not the client's, so no
// raw 403/500 leaks out). The real service + status stay in statusMessage.
export function toHttpError(err: unknown) {
    if (err instanceof UpstreamError) {
        // Log server-side so upstream failures are visible in the function logs
        // (service + status). The client only ever sees the sanitised HTTP error.
        console.error(`[upstream] ${err.service} failed with status ${err.status}: ${err.message}`, err.original ?? '')
        const status = err.status === 429 || err.status === 503 ? err.status : 502
        return createError({ statusCode: status, statusMessage: `Upstream ${err.service} failed (${err.status})` })
    }
    console.error('[upstream] unexpected non-UpstreamError reached toHttpError', err)
    return createError({ statusCode: 502, statusMessage: 'Upstream service failed' })
}
