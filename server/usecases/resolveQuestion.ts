import type { RetrievedSource, AskResult } from '../domain/types'
import type { Embedder, VectorStore, LanguageModel, QueryRewriter } from './ports'

// Below this cosine score even the closest match is unrelated, so we skip the
// model. Only a coarse pre-filter: embedding scores can't tell gibberish from a
// real question (random input often scores high), so the real call is the model's,
// via the NONSENSE / NO_MATCH sentinels below.
const NONSENSE_CUTOFF = 0.48

interface Deps {
    embedder: Embedder
    vectorStore: VectorStore
    model: LanguageModel
    rewriter: QueryRewriter
}

interface Options {
    playful: boolean
    rewrite: boolean
}

// The grounded prompt. `playful` adds the Star Trek voice + trailing quips; off
// keeps it neutral and factual (bare sentinels, no preamble).
function buildPrompt(question: string, sources: RetrievedSource[], playful: boolean) {
    const context = sources.map((r) => `${r.title} (${r.date})\n${r.explanation}`).join('\n\n')
    const intro = playful
        ? `You are an astronomy assistant who speaks like a Star Trek bridge officer: your playful asides carry that flavour (a wink to captain's-log lines, "fascinating", "make it so"), without overdoing it.`
        : `You are an astronomy assistant with a neutral, factual tone: no personality, no preamble.`
    const rules = playful
        ? `- Reply with exactly: NONSENSE :: followed by one short, cheeky Star Trek-flavoured line teasing what they typed, ONLY for genuine gibberish (random characters with no recognisable word, like "asdfgh"). Any real word or name, even a proper noun like "thor", counts as a valid search, not gibberish. Do NOT judge whether the word is "astronomical", whether it is relevant is decided by the descriptions below, not by your own knowledge of the word.
- If the descriptions below do not cover the search, reply with exactly: NO_MATCH :: followed by one short, warm Star Trek-flavoured line that credits the search before we show the closest pictures.
- Otherwise open with one short Star Trek-flavoured line that shows you enjoyed the search, then answer using ONLY the descriptions below, keep it concise, and mention which picture(s) you used.`
        : `- Reply with exactly NONSENSE and nothing else ONLY for genuine gibberish (random characters with no recognisable word, like "asdfgh"). Any real word or name, even a proper noun like "thor", counts as a valid search, not gibberish. Do NOT judge whether the word is "astronomical", whether it is relevant is decided by the descriptions below, not by your own knowledge of the word.
- If the descriptions below do not cover the search, reply with exactly NO_MATCH and nothing else.
- Otherwise answer using ONLY the descriptions below, factually and concisely, and mention which picture(s) you used.`
    return `${intro} You get APOD descriptions and a user's question. Decide in this order:
${rules}
Write everything in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`
}

// Classify the model's reply. The NONSENSE / NO_MATCH sentinels (and the optional
// quip after them) are known only here, right next to the prompt that emits them.
function classify(raw: string, sources: RetrievedSource[], topScore: number): AskResult {
    const text = raw.trimStart()
    if (/^NONSENSE\b/i.test(text)) {
        return { state: 'nonsense', sources: [], topScore, answer: '', remark: text.replace(/^NONSENSE\b[:\s]*/i, '').trim() }
    }
    if (/^NO_MATCH\b/i.test(text)) {
        return { state: 'noAnswer', sources, topScore, answer: '', remark: text.replace(/^NO_MATCH\b[:\s]*/i, '').trim() }
    }
    return { state: 'answer', sources, topScore, answer: text, remark: '' }
}

// The full RAG pipeline for one question: embed, retrieve, pre-filter, generate,
// classify. Technology-free: it only talks to the injected ports.
export async function resolveQuestion(question: string, options: Options, deps: Deps): Promise<AskResult> {
    // Optionally clean up the raw question (typos, vague wording) before searching.
    const searchQuery = options.rewrite ? await deps.rewriter.rewrite(question) : question
    const vector = await deps.embedder.embed(searchQuery)
    const sources = await deps.vectorStore.query(vector, 5)
    const topScore = sources[0]?.score ?? 0
    if (topScore < NONSENSE_CUTOFF) {
        return { state: 'nonsense', sources: [], topScore, answer: '', remark: '' }
    }
    const raw = await deps.model.generate(buildPrompt(searchQuery, sources, options.playful))
    return classify(raw, sources, topScore)
}
