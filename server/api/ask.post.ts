// Thin controller: embed the question, retrieve sources, have Gemini answer.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Clamp the slider's cutoff to [0,1]; default 0.55.
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold ?? 0.55)))

    const { sources, strong, topScore } = await retrieveSources(question, threshold)
    // Nothing cleared the threshold: no grounded answer to attempt.
    if (strong.length === 0) {
        return { question, answer: '', sources, topScore, threshold, offTopic: false }
    }

    let raw: string
    try {
        raw = await generateAnswer(question, strong)
    } catch (err) {
        // Pass Gemini's real status through (esp. 429 quota) so the client can name
        // the cause, instead of a generic 500 that reads as a connection problem.
        const e = err as { status?: number; code?: number; message?: string }
        const is429 = e?.status === 429 || e?.code === 429 || /\b429\b/.test(e?.message ?? '')
        throw createError({
            statusCode: is429 ? 429 : 502,
            statusMessage: is429 ? 'Gemini quota exceeded' : 'Answer generation failed'
        })
    }

    // The model replies NO_MATCH when the sources don't cover the question.
    const offTopic = /^\s*NO_MATCH/i.test(raw)
    return { question, answer: offTopic ? '' : raw, sources, topScore, threshold, offTopic }
})
