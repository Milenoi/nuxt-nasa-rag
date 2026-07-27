import { loadRagConfig } from '../infrastructure/config'
import { resolveQuestion } from '../usecases/resolveQuestion'
import { geminiEmbedder } from '../infrastructure/geminiEmbedder'
import { upstashVectorStore } from '../infrastructure/upstashVectorStore'
import { geminiLanguageModel } from '../infrastructure/geminiLanguageModel'
import { toHttpError } from '../infrastructure/upstreamError'

// Thin controller / composition root: build the adapters, run the use case, map
// upstream errors. This is the only place that knows which concrete tech is used.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Star Trek personality toggle; defaults off.
    const playful = body?.starTrek === true

    // Composition root: read config once, wire the concrete adapters into the use case.
    const config = loadRagConfig()
    const deps = {
        embedder: geminiEmbedder(config.geminiApiKey),
        vectorStore: upstashVectorStore(config.upstashUrl, config.upstashToken),
        model: geminiLanguageModel(config.geminiApiKey)
    }

    try {
        return { question, ...(await resolveQuestion(question, { playful }, deps)) }
    } catch (err) {
        throw toHttpError(err)
    }
})
