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

// Map an UpstreamError to a client HTTP error: a 429 passes through (the user can
// retry), anything else becomes 502 (a server-side upstream problem, not the client's,
// so no raw 403/500 leaks out). The real service + status stay in statusMessage.
export function toHttpError(err: unknown) {
    if (err instanceof UpstreamError) {
        // Log server-side so upstream failures are visible in the function logs
        // (service + status). The client only ever sees the sanitised HTTP error.
        console.error(`[upstream] ${err.service} failed with status ${err.status}: ${err.message}`, err.original ?? '')
        const status = err.status === 429 ? 429 : 502
        return createError({ statusCode: status, statusMessage: `Upstream ${err.service} failed (${err.status})` })
    }
    console.error('[upstream] unexpected non-UpstreamError reached toHttpError', err)
    return createError({ statusCode: 502, statusMessage: 'Upstream service failed' })
}
