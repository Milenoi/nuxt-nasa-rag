// Technical configuration the adapters need. Read ONCE at a composition root and
// injected into the adapters, so no adapter reaches into the environment behind
// the scenes. process.env is populated everywhere we run: the Nitro server, the
// ingest tsx script, and the Netlify function, so one loader fits all callers.
export interface RagConfig {
    geminiApiKey: string
    upstashUrl: string
    upstashToken: string
}

export function loadRagConfig(): RagConfig {
    const geminiApiKey = process.env.GEMINI_API_KEY
    const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL
    const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not set')
    if (!upstashUrl || !upstashToken) throw new Error('UPSTASH_VECTOR_REST_URL / UPSTASH_VECTOR_REST_TOKEN is not set')
    return { geminiApiKey, upstashUrl, upstashToken }
}

// NASA APOD access, needed only by the ingest paths (not the query path).
export interface NasaConfig {
    apiKey: string
    apodUrl: string
}

export function loadNasaConfig(): NasaConfig {
    const apiKey = process.env.NASA_API_KEY
    const apodUrl = process.env.NUXT_NASA_APOD_API_URL
    if (!apiKey) throw new Error('NASA_API_KEY is not set')
    if (!apodUrl) throw new Error('NUXT_NASA_APOD_API_URL is not set')
    return { apiKey, apodUrl }
}
