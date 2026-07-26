// Map an upstream Gemini/Upstash failure to a client error carrying its real
// status (429 quota, 403 forbidden, ...), so describeError can name the cause
// instead of a generic 500 that reads as a connection drop.
export function upstreamError(err: unknown) {
    const e = err as { status?: number; code?: number; statusCode?: number; message?: string }
    const fromMsg = Number(/\b(4\d\d|5\d\d)\b/.exec(e?.message ?? '')?.[1])
    const status = e?.status ?? e?.code ?? e?.statusCode ?? (fromMsg || 502)
    const code = status >= 400 && status < 600 ? status : 502
    return createError({ statusCode: code, statusMessage: `Answer service failed (${code})` })
}
