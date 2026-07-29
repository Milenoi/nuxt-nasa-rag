import { loadRagConfig } from '../infrastructure/config'
import { suggestQueries } from '../usecases/suggestQueries'
import { geminiQuerySuggester } from '../infrastructure/geminiQuerySuggester'
import { toHttpError } from '../infrastructure/upstreamError'
import { suggestResponseSchema } from '#shared/contracts/ask'

// Thin controller / composition root for the "did you mean?" step: build the
// suggester, run the use case, map upstream errors. Same shape as ask.post.ts.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    const config = loadRagConfig()
    try {
        const suggestions = await suggestQueries(question, {
            suggester: geminiQuerySuggester(config.geminiApiKey)
        })
        return suggestResponseSchema.parse({ suggestions })
    } catch (err) {
        throw toHttpError(err)
    }
})
