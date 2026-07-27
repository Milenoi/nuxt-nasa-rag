// Application-level error: an external service (Gemini, Upstash, NASA) failed. It
// carries the upstream HTTP-ish status so a controller can map it to a response
// WITHOUT knowing any SDK's error shape. Adapters throw this at their boundary; the
// core and the controllers only ever see this type, never a raw SDK error.
export class UpstreamError extends Error {
    constructor(
        readonly service: string,
        readonly status: number,
        message: string,
        readonly original?: unknown
    ) {
        super(message)
        this.name = 'UpstreamError'
    }
}
