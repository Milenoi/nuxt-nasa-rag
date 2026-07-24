import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

// The RAG use case, kept out of the route handler. Plan A ranked a JSON shelf
// with hand-written cosine (see search.ts); it now runs on Upstash Vector.
export async function answerQuestion(question: string, threshold: number) {
    // 1. Embed the question (same model as the ingest).
    const questionVector = await embed(question)

    // 2. Retrieve the closest sources; Upstash ranks them by cosine similarity.
    const index = Index.fromEnv()
    const matches = await index.query<ApodMetadata>({
        vector: questionVector,
        topK: 5,
        includeMetadata: true
    })
    const top = matches.map((match) => {
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

    // 3. Only sources above the threshold feed Gemini. We return all of `top` so
    // the UI can dim the weak ones.
    const strong = top.filter((record) => record.score >= threshold)
    if (strong.length === 0) {
        return {
            answer: "I couldn't find anything about that in the APOD texts.",
            sources: [],
            topScore: top[0]?.score ?? 0
        }
    }

    // 4. Grounded generation: answer only from the retrieved texts.
    const context = strong.map((record) => `${record.title} (${record.date})\n${record.explanation}`).join('\n\n')
    const prompt = `You are an astronomy assistant. Answer the user's question using ONLY the APOD descriptions below. If the answer isn't in them, say you don't know instead of guessing. Keep it concise and mention which picture(s) you used. Answer in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`

    const ai = new GoogleGenAI({ apiKey: useRuntimeConfig().geminiApiKey })
    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
    })

    return { answer: response.text, sources: top, topScore: top[0]?.score ?? 0 }
}
