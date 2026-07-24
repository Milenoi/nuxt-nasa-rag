// Cheap pre-filter: if even the closest match is this weak, skip the Gemini call
// and go straight to nonsense. The real gibberish-vs-question judgement is left to
// Gemini (NONSENSE vs NO_MATCH); embedding scores alone can't tell them apart
// (random input like "aqqwqqq" often scores high).
const NONSENSE_CUTOFF = 0.48

// Thin controller: embed the question, retrieve sources, decide the state.
export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    const { sources, topScore } = await retrieveSources(question)

    // Nothing in the archive comes close: don't spend a Gemini call on it.
    if (topScore < NONSENSE_CUTOFF) {
        return { question, answer: '', sources: [], topScore, state: 'nonsense' as const }
    }

    let raw: string
    try {
        raw = await generateAnswer(question, sources)
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
