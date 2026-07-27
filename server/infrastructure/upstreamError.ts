import { UpstreamError } from '../usecases/errors'

// Extract an HTTP-ish status from a raw SDK / fetch error (Gemini, Upstash, NASA).
// This is the ONE place that knows what those error shapes look like.
function statusOf(err: unknown): number {
    const e = err as { status?: number; code?: number; statusCode?: number; message?: string }
    const fromMsg = Number(/\b(4\d\d|5\d\d)\b/.exec(e?.message ?? '')?.[1])
    const status = e?.status ?? e?.code ?? e?.statusCode ?? (fromMsg || 502)
    return status >= 400 && status < 600 ? status : 502
}

// Run an external-service call and, on failure, rethrow it as an UpstreamError tagged
// with the service + its status. Adapters wrap their SDK calls in this, so the raw SDK
// error shape never leaves the infrastructure layer.
export async function runUpstream<T>(service: string, fn: () => Promise<T>): Promise<T> {
    try {
        return await fn()
    } catch (err) {
        if (err instanceof UpstreamError) throw err
        throw new UpstreamError(service, statusOf(err), `${service} request failed`, err)
    }
}

// Map an UpstreamError (or any stray error) to a client HTTP error, so describeError
// can name the cause (429 quota, 403, ...). Controllers use this; they never inspect
// an SDK error shape themselves.
export function toHttpError(err: unknown) {
    const status = err instanceof UpstreamError ? err.status : 502
    return createError({ statusCode: status, statusMessage: `Upstream service failed (${status})` })
}
