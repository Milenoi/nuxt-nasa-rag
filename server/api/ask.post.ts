import { GoogleGenAI } from '@google/genai'
import type { ApodRecord } from '#shared/apod.ts'
// Import the vector shelf directly so it's bundled straight into the function.
// A runtime file path / server-asset lookup isn't reliable across build presets
// (Netlify); at ~7 MB the inlined JSON stays well within the function limit.
import shelfData from '../../data/apod-vectors.json'

const shelf: ApodRecord[] = shelfData as ApodRecord[]

export default defineEventHandler(async (event) => {
    // Read the question from the POST body.
    const body = await readBody(event)
    const question = body?.question
    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

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

    // Tuned for gemini-embedding-001: real astronomy questions score ~0.63+,
    // while unrelated/nonsense queries top out around ~0.48 — so 0.55 sits in
    // the gap and keeps gibberish from being treated as a real match.
    const RELEVANCE_THRESHOLD = 0.55

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
