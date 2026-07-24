// Thin controller: read the body, delegate to the answerQuestion use case, return.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Clamp the slider's cutoff to [0,1]; default 0.55.
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold ?? 0.55)))

    const result = await answerQuestion(question, threshold)
    return { question, threshold, ...result }
})
