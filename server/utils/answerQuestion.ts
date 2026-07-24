import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

// Below this cosine score even the closest match is unrelated, so we skip the
// model. Only a coarse pre-filter: embedding scores can't tell gibberish from a
// real question (random input often scores high), so the real call is the
// model's, via the NONSENSE / NO_MATCH sentinels below.
const NONSENSE_CUTOFF = 0.48

// Retrieve the closest APOD sources by cosine similarity (top 5, best first).
export async function retrieveSources(question: string) {
    const questionVector = await embed(question)
    const index = Index.fromEnv()
    const matches = await index.query<ApodMetadata>({
        vector: questionVector,
        topK: 5,
        includeMetadata: true
    })
    const sources = matches.map((match) => {
        const m = match.metadata!
        return {
            date: m.date,
            title: m.title,
            imageUrl: m.imageUrl,
            explanation: m.explanation,
            mediaType: m.mediaType,
            thumbnailUrl: m.thumbnailUrl,
            score: match.score
        }
    })
    return { sources, topScore: sources[0]?.score ?? 0 }
}

// The grounded prompt. `playful` adds the Star Trek voice + trailing quips; off
// keeps it neutral and factual (bare sentinels, no preamble).
function buildPrompt(question: string, sources: { title: string; date: string; explanation: string }[], playful: boolean) {
    const context = sources.map((r) => `${r.title} (${r.date})\n${r.explanation}`).join('\n\n')
    const intro = playful
        ? `You are an astronomy assistant who speaks like a Star Trek bridge officer: your playful asides carry that flavour (a wink to captain's-log lines, "fascinating", "make it so"), without overdoing it.`
        : `You are an astronomy assistant with a neutral, factual tone: no personality, no preamble.`
    const rules = playful
        ? `- If the input is not a real question (gibberish, random characters, or nothing meaningful is asked), reply with exactly: NONSENSE :: followed by one short, cheeky Star Trek-flavoured line teasing what they typed.
- If it is a real question but the descriptions below do not answer it, reply with exactly: NO_MATCH :: followed by one short, warm Star Trek-flavoured line that credits the question before we show the closest pictures.
- Otherwise open with one short Star Trek-flavoured line that shows you enjoyed the question, then answer using ONLY the descriptions below, keep it concise, and mention which picture(s) you used.`
        : `- If the input is not a real question (gibberish, random characters, or nothing meaningful is asked), reply with exactly NONSENSE and nothing else.
- If it is a real question but the descriptions below do not answer it, reply with exactly NO_MATCH and nothing else.
- Otherwise answer using ONLY the descriptions below, factually and concisely, and mention which picture(s) you used.`
    return `${intro} You get APOD descriptions and a user's question. Decide in this order:
${rules}
Write everything in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`
}

// Ask Gemini and classify its reply. The NONSENSE / NO_MATCH sentinels (and the
// optional quip after them) are known only here, next to the prompt that emits them.
async function classifyAnswer(question: string, sources: { title: string; date: string; explanation: string }[], playful: boolean) {
    const ai = new GoogleGenAI({ apiKey: useRuntimeConfig().geminiApiKey })
    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: buildPrompt(question, sources, playful)
    })
    const raw = (response.text ?? '').trimStart()
    if (/^NONSENSE\b/i.test(raw)) return { verdict: 'nonsense' as const, answer: '', remark: raw.replace(/^NONSENSE\b[:\s]*/i, '').trim() }
    if (/^NO_MATCH\b/i.test(raw)) return { verdict: 'noAnswer' as const, answer: '', remark: raw.replace(/^NO_MATCH\b[:\s]*/i, '').trim() }
    return { verdict: 'answer' as const, answer: raw, remark: '' }
}

// The full RAG pipeline for one question: retrieve, pre-filter, generate,
// classify. Returns the state the API response and the UI share.
export async function resolveQuestion(question: string, playful: boolean) {
    const { sources, topScore } = await retrieveSources(question)
    if (topScore < NONSENSE_CUTOFF) {
        return { state: 'nonsense' as const, sources: [], topScore, answer: '', remark: '' }
    }
    const { verdict, answer, remark } = await classifyAnswer(question, sources, playful)
    if (verdict === 'nonsense') return { state: 'nonsense' as const, sources: [], topScore, answer: '', remark }
    if (verdict === 'noAnswer') return { state: 'noAnswer' as const, sources, topScore, answer: '', remark }
    return { state: 'answer' as const, sources, topScore, answer, remark }
}
