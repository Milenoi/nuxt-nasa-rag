import { GoogleGenAI } from '@google/genai'
import { Index } from '@upstash/vector'
import type { ApodMetadata } from '../utils/apodVector'

// import type { ApodRecord } from '#shared/apod.ts'
// Import the vector shelf directly so it's bundled straight into the function.
// A runtime file path / server-asset lookup isn't reliable across build presets
// (Netlify); at ~7 MB the inlined JSON stays well within the function limit.
// import shelfData from '../../data/apod-vectors.json'

// const shelf: ApodRecord[] = shelfData as ApodRecord[]

export default defineEventHandler(async (event) => {
    // Read the question from the POST body.
    const body = await readBody(event)
    const question = body?.question

    // The slider sends its value too. Default 0.55, clamped to [0,1] so a stray
    // value can't break the comparison below.
    const threshold = Math.min(1, Math.max(0, Number(body?.threshold ?? 0.55)))

    if (!question) throw createError({ statusCode: 400, statusMessage: 'Missing question' })

    // Embed the user's question into a vector (same embed() as ingest, now with the query).
    const questionVector = await embed(question)

    // Score every shelf entry: cosine similarity between the question vector and each stored vector.
    /*
    const ranked = shelf.map((record) => ({
        date: record.date,
        title: record.title,
        imageUrl: record.imageUrl,
        explanation: record.explanation,
        mediaType: record.mediaType,
        thumbnailUrl: record.thumbnailUrl,
        score: cosineSimilarity(questionVector, record.vector)
    }))
    */

    // Take the best matches as our sources.
    /*
    ranked.sort((a, b) => b.score - a.score)
    const top = ranked.slice(0, 5)
    */

    const index = Index.fromEnv()

    const matches = await index.query({
        vector: questionVector,
        topK: 5,
        includeMetadata: true
    })
    const top = matches.map((match) => {
        // Upstash types metadata loosely; we wrote it via ApodMetadata, so read
        // it back as that. Concrete fields, unlike the old Record<string,string>.
        const m = match.metadata as unknown as ApodMetadata
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

    // Only sources that clear the threshold feed Gemini. We still return all of top below, so the UI can show the weak ones dimmed.
    const strong = top.filter((record) => record.score >= threshold)

    // If nothing clears the bar, it's an empty result.
    if (strong.length === 0) {
        return {
            question,
            answer: "I couldn't find anything about that in the APOD texts.",
            sources: [],
            topScore: top[0]?.score ?? 0,
            threshold
        }
    }

    // Build a context block from the retrieved APOD texts.
    const context = strong.map((record) => `${record.title} (${record.date})\n${record.explanation}`).join('\n\n')

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

    return { question, answer: response.text, sources: top, threshold }
})
