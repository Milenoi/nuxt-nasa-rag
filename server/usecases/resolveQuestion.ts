import { z } from 'zod'
import type { RetrievedSource, AskResult } from '../domain/ask'
import type { Embedder, LanguageModel } from './ports/gateways'
import type { VectorStore } from './ports/repositories'

// Below this cosine score even the closest match is unrelated, so we skip the
// model. Only a coarse pre-filter: embedding scores can't tell gibberish from a
// real question (random input often scores high), so the real call is the model's.
const MIN_RETRIEVAL_SCORE = 0.48

// The "form" we ask Gemini to fill instead of writing free-text sentinels.
const answerReply = z.object({
    decision: z.enum(['answer', 'nonsense', 'noMatch']),
    answer: z.string(),
    remark: z.string(),
    sourceIds: z.array(z.string())
})

interface Deps {
    embedder: Embedder
    vectorStore: VectorStore
    model: LanguageModel
}

interface Options {
    playful: boolean
}

// The grounded prompt. `playful` adds the Star Trek voice + quips; off keeps it
// neutral and factual. The model fills the form fields instead of writing markers.
function buildPrompt(question: string, sources: RetrievedSource[], playful: boolean) {
    const context = sources
        .map((r) => `[id: ${r.date}] ${r.title} (${r.date})\n${r.explanation}`)
        .join('\n\n')
    const intro = playful
        ? `You are an astronomy assistant who speaks like a Star Trek bridge officer: playful asides carry that flavour (a wink to captain's-log lines, "fascinating", "make it so"), without overdoing it.`
        : `You are an astronomy assistant with a neutral, factual tone: no personality, no preamble.`
    const decisionRules = `Set "decision" in this order:
- "nonsense": the search is random characters or keyboard mashing with no recognisable word (like "asdfgh", "qwerty", "aaaa"). Any real word or name, even a proper noun like "thor", is NOT nonsense. Do not judge whether the word is astronomical; relevance is decided by the descriptions below, not your own knowledge.
- "noMatch": a real search, but the descriptions below do not cover it.
- "answer": the descriptions cover the search.`
    const fieldRules = playful
        ? `Then fill:
- "answer": for "answer", reply using ONLY the descriptions below, concise, opening with one short Star Trek-flavoured line; empty string for "nonsense" and "noMatch".
- "remark": for "nonsense", one short cheeky Star Trek line teasing what they typed; for "noMatch", one short warm Star Trek line crediting the search; for "answer", empty string.
- "sourceIds": for "answer", the ids of the descriptions you actually used; otherwise an empty array.`
        : `Then fill:
- "answer": for "answer", reply using ONLY the descriptions below, factual and concise; empty string for "nonsense" and "noMatch".
- "remark": always an empty string.
- "sourceIds": for "answer", the ids of the descriptions you actually used; otherwise an empty array.`
    return `${intro}
${decisionRules}
${fieldRules}
Write "answer" and "remark" in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`
}

// The full RAG pipeline for one question: embed, retrieve, pre-filter, generate,
// map. Technology-free: it only talks to the injected ports.
export async function resolveQuestion(question: string, options: Options, deps: Deps): Promise<AskResult> {
    const vector = await deps.embedder.embed(question)
    const sources = await deps.vectorStore.query(vector, 5)
    const topScore = sources[0]?.score ?? 0
    if (topScore < MIN_RETRIEVAL_SCORE) {
        return { state: 'invalidInput', sources: [], topScore, answer: '', remark: '' }
    }
    const reply = await deps.model.generate(buildPrompt(question, sources, options.playful), answerReply)
    if (reply.decision === 'nonsense') {
        return { state: 'invalidInput', sources: [], topScore, answer: '', remark: reply.remark }
    }
    if (reply.decision === 'noMatch') {
        return { state: 'outOfScope', sources, topScore, answer: '', remark: reply.remark }
    }
    return { state: 'answered', sources, topScore, answer: reply.answer, remark: reply.remark }
}
