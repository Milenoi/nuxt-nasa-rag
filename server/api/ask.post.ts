import { loadRagConfig } from '../infrastructure/config'
import { resolveQuestion } from '../usecases/resolveQuestion'
import { geminiEmbedder } from '../infrastructure/geminiEmbedder'
import { upstashVectorStore } from '../infrastructure/upstashVectorStore'
import { geminiLanguageModel } from '../infrastructure/geminiLanguageModel'

// Map an upstream Gemini/Upstash failure to a client error carrying its real
// status (429 quota, 403 forbidden, ...), so describeError can name the cause
// instead of a generic 500 that reads as a connection drop.
function upstreamError(err: unknown) {
    const e = err as { status?: number; code?: number; statusCode?: number; message?: string }
    const fromMsg = Number(/\b(4\d\d|5\d\d)\b/.exec(e?.message ?? '')?.[1])
    const status = e?.status ?? e?.code ?? e?.statusCode ?? (fromMsg || 502)
    const code = status >= 400 && status < 600 ? status : 502
    return createError({ statusCode: code, statusMessage: `Answer service failed (${code})` })
}

// Thin controller / composition root: build the adapters, run the use case, map
// upstream errors. This is the only place that knows which concrete tech is used.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Star Trek personality toggle from the client; default off.
    const playful = body?.starTrek === true

    // Composition root: read config once, wire the concrete adapters into the use case.
    const config = loadRagConfig()
    const deps = {
        embedder: geminiEmbedder(config.geminiApiKey),
        vectorStore: upstashVectorStore(config.upstashUrl, config.upstashToken),
        model: geminiLanguageModel(config.geminiApiKey)
    }

    try {
        return { question, ...(await resolveQuestion(question, playful, deps)) }
    } catch (err) {
        throw upstreamError(err)
    }
})
