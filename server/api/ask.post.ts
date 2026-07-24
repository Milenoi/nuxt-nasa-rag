// Thin controller: read the body, hand off to askStream.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Clamp the slider's cutoff to [0,1]; default 0.55.
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold ?? 0.55)))

    setResponseHeader(event, 'content-type', 'application/x-ndjson; charset=utf-8')
    return askStream(question, threshold)
})
