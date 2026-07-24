import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from './apodVector'

// Retrieve the closest APOD sources for a question. Upstash ranks by cosine
// similarity; `strong` is the subset that clears the relevance threshold.
// Plan A ranked a JSON shelf with handwritten cosine (see search.ts).
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

// Stream a grounded answer token by token. If the sources don't cover the
// question the model replies with the NO_MATCH sentinel (the caller detects it).
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

// Orchestrate the streamed NDJSON response so the route handler stays thin:
// sources first, then the answer token by token. Tokens are held back until the
// NO_MATCH sentinel is ruled out, so it never reaches the client.
export function askStream(question: string, threshold: number): ReadableStream {
    const encoder = new TextEncoder()
    const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + '\n')
    return new ReadableStream({
        async start(controller) {
            try {
                const { sources, strong, topScore } = await retrieveSources(question, threshold)
                controller.enqueue(line({ type: 'meta', question, threshold, sources, topScore }))
                if (strong.length === 0) {
                    controller.enqueue(line({ type: 'empty' }))
                    return controller.close()
                }
                let buffer = ''
                let decided = false
                for await (const text of streamAnswer(question, strong)) {
                    if (!decided) {
                        buffer += text
                        const seen = buffer.trimStart()
                        if (/^NO_MATCH/i.test(seen)) {
                            controller.enqueue(line({ type: 'offtopic' }))
                            return controller.close()
                        }
                        if (seen.length < 8) continue // not enough to rule out NO_MATCH yet
                        decided = true
                        controller.enqueue(line({ type: 'delta', text: buffer }))
                        buffer = ''
                        continue
                    }
                    controller.enqueue(line({ type: 'delta', text }))
                }
                if (buffer) controller.enqueue(line({ type: 'delta', text: buffer }))
                controller.enqueue(line({ type: 'done' }))
                controller.close()
            } catch (err) {
                controller.enqueue(line({ type: 'error', message: String((err as Error)?.message ?? err) }))
                controller.close()
            }
        }
    })
}
