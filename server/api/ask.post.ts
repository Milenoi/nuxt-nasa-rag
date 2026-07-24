// Cheap pre-filter: if even the closest match is this weak, skip the Gemini call
// and go straight to nonsense. The real gibberish-vs-question judgement is left to
// Gemini (NONSENSE vs NO_MATCH); embedding scores alone can't tell them apart
// (random input like "aqqwqqq" often scores high).
const NONSENSE_CUTOFF = 0.48

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

// Thin controller: embed the question, retrieve sources, decide the state.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Embedding + retrieval; surface upstream failures (e.g. 403 bad key) cleanly.
    const { sources, topScore } = await retrieveSources(question).catch((e) => { throw upstreamError(e) })

    // Nothing in the archive comes close: don't spend a Gemini call on it.
    if (topScore < NONSENSE_CUTOFF) {
        return { question, answer: '', sources: [], topScore, state: 'nonsense' as const }
    }

    // Generation; same clean error handling as retrieval.
    const raw = await generateAnswer(question, sources).catch((e) => { throw upstreamError(e) })

    const trimmed = raw.trimStart()

    // Gibberish: Gemini appends its own cheeky line after the sentinel.
    if (/^NONSENSE\b/i.test(trimmed)) {
        const remark = trimmed.replace(/^NONSENSE\b[:\s]*/i, '').trim()
        return { question, answer: '', sources: [], topScore, state: 'nonsense' as const, remark }
    }

    // Real question the sources don't answer: hand them back as the closest
    // pictures, with Gemini's encouraging line.
    if (/^NO_MATCH\b/i.test(trimmed)) {
        const remark = trimmed.replace(/^NO_MATCH\b[:\s]*/i, '').trim()
        return { question, answer: '', sources, topScore, state: 'noAnswer' as const, remark }
    }

    return { question, answer: raw, sources, topScore, state: 'answer' as const }
})
