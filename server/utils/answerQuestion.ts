import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

// The RAG use case, kept out of the route handler. Plan A ranked a JSON shelf
// with handwritten cosine (see search.ts); it now runs on Upstash Vector.
export async function answerQuestion(question: string, threshold: number) {
    // 1. Embed the question (same model as to ingest).
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
    const prompt = `You are an astronomy assistant. Answer the user's question using ONLY the APOD descriptions below. If they do not contain the answer, reply with exactly NO_MATCH and nothing else. Otherwise keep it concise and mention which picture(s) you used. Answer in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`

    const ai = new GoogleGenAI({ apiKey: useRuntimeConfig().geminiApiKey })
    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
    })

    // NO_MATCH sentinel: the sources don't cover the question (off-topic or
    // nonsense). Treat it as empty so the UI shows the empty state + roast rather
    // than a mismatched hero with an "I don't know" answer.
    const answer = (response.text ?? '').trim()
    if (/^NO_MATCH/i.test(answer)) {
        return { answer: '', sources: [], topScore: top[0]?.score ?? 0, offTopic: true }
    }

    return { answer, sources: top, topScore: top[0]?.score ?? 0 }
}
