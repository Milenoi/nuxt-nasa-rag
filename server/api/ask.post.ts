import { GoogleGenAI } from '@google/genai'
import type { ApodRecord } from '#shared/apod.ts'

// Load the shelf once, then reuse it (don't re-read on every call). The file is
// bundled as a Nitro server asset (see nitro.serverAssets in nuxt.config), so it
// works in a serverless function where the project's data/ path isn't available.
let records: ApodRecord[] | null = null

async function loadRecords(): Promise<ApodRecord[]> {
    if (records) return records

    const raw = await useStorage('assets:data').getItem('apod-vectors.json')
    if (!raw) throw createError({ statusCode: 500, statusMessage: 'Vector shelf not found' })

    // Server assets come back as a string (or an already-parsed object, depending
    // on the storage driver) — handle both.
    const loaded: ApodRecord[] = typeof raw === 'string' ? JSON.parse(raw) : (raw as ApodRecord[])
    records = loaded
    return loaded
}

export default defineEventHandler(async (event) => {
    // Read the question from the POST body.
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    const shelf = await loadRecords()

    // Embed the user's question into a vector (same embed() as ingest, now with the query).
    const questionVector = await embed(question)

    // Score every shelf entry: cosine similarity between the question vector and each stored vector.
    const ranked = shelf.map((record) => ({
        date: record.date,
        title: record.title,
        imageUrl: record.imageUrl,
        explanation: record.explanation,
        score: cosineSimilarity(questionVector, record.vector)
    }))

    // Take the best matches as our sources.
    ranked.sort((a, b) => b.score - a.score)
    const top = ranked.slice(0, 5)

    const RELEVANCE_THRESHOLD = 0.3

    // If even the best match is weak, don't pretend we found something relevant.
    const best = top[0]
    if (!best || best.score < RELEVANCE_THRESHOLD) {
        return {
            question,
            answer: "I couldn't find anything about that in the APOD texts.",
            sources: [],
            // Best similarity we saw — lets the UI tell "close but no match" apart
            // from "clearly not space-related at all".
            topScore: best?.score ?? 0
        }
    }


    // Build a context block from the retrieved APOD texts.
    const context = top.map((record) => `${record.title} (${record.date})\n${record.explanation}`).join('\n\n')

    // The grounding prompt: tell the model to answer ONLY from these texts.
    const prompt = `You are an astronomy assistant. Answer the user's question using ONLY the APOD descriptions below. If the answer isn't in them, say you don't know instead of guessing. Keep it concise and mention which picture(s) you used. Answer in the same language as the user's question.

APOD descriptions:
${context}

Question: ${question}`

    // Call Gemini.
    const config = useRuntimeConfig()
    const apiKey = config.geminiApiKey

    const ai = new GoogleGenAI({ apiKey })

    const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
      contents: prompt
    })

    return { question, answer: response.text, sources: top }
})
