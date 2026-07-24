import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

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

// Generate a grounded answer. Returns NO_MATCH when the sources don't cover it.
export async function generateAnswer(question: string, sources: { title: string; date: string; explanation: string }[]) {
    const context = sources.map((r) => `${r.title} (${r.date})\n${r.explanation}`).join('\n\n')
    const prompt = `You are an astronomy assistant who speaks like a Star Trek bridge officer: your playful asides carry that flavour (a wink to captain's-log lines, "fascinating", "make it so"), without overdoing it. You get APOD descriptions and a user's question. Decide in this order:
- If the input is not a real question (gibberish, random characters, or nothing meaningful is asked), reply with exactly: NONSENSE :: followed by one short, cheeky Star Trek-flavoured line teasing what they typed.
- If it is a real question but the descriptions below do not answer it, reply with exactly: NO_MATCH :: followed by one short, warm Star Trek-flavoured line that credits the question before we show the closest pictures.
- Otherwise open with one short Star Trek-flavoured line that shows you enjoyed the question, then answer using ONLY the descriptions below, keep it concise, and mention which picture(s) you used.
Write everything in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`

    const ai = new GoogleGenAI({ apiKey: useRuntimeConfig().geminiApiKey })
    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
    })
    return response.text ?? ''
}
