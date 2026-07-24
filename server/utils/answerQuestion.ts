import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

// Retrieve the closest APOD sources; `strong` clears the relevance threshold.
export async function retrieveSources(question: string, threshold: number) {
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
    const strong = sources.filter((s) => s.score >= threshold)
    return { sources, strong, topScore: sources[0]?.score ?? 0 }
}

// Stream a grounded answer. Replies NO_MATCH when the sources don't cover it.
export async function* streamAnswer(question: string, strong: { title: string; date: string; explanation: string }[]) {
    const context = strong.map((r) => `${r.title} (${r.date})\n${r.explanation}`).join('\n\n')
    const prompt = `You are an astronomy assistant. Answer the user's question using ONLY the APOD descriptions below. If they do not contain the answer, reply with exactly NO_MATCH and nothing else. Otherwise keep it concise and mention which picture(s) you used. Answer in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`

    const ai = new GoogleGenAI({ apiKey: useRuntimeConfig().geminiApiKey })
    const stream = await ai.models.generateContentStream({
        model: 'gemini-flash-latest',
        contents: prompt
    })
    for await (const chunk of stream) {
        if (chunk.text) yield chunk.text
    }
}
