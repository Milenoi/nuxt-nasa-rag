// Thin controller for the Ask page: read the question + relevance threshold from
// the POST body, hand off to the answerQuestion use case, return its result. All
// the RAG work (embed, retrieve, ground, generate) lives in answerQuestion so this
// handler only deals with the request/response.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // The slider sends its cutoff too. Default 0.55, clamped to [0,1] so a stray
    // value can't break the comparison inside the use case.
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold ?? 0.55)))

    const result = await answerQuestion(question, threshold)
    return { question, threshold, ...result }
})
