import { GoogleGenAI } from '@google/genai'

// We cache the client here so it's created only ONCE, not on every call.
let ai: GoogleGenAI | null = null

// Multilingual embedding model (100+ languages) so German questions still match
// the English APOD texts. We reduce the vector to 768 dimensions (the default is
// 3072) to keep the shelf small. IMPORTANT: query and shelf must use this exact
// same model + dimension, or the cosine comparison is meaningless.
const MODEL = 'gemini-embedding-001'
const DIMENSIONS = 768

// L2-normalize a vector to unit length. Reduced-dimension Gemini embeddings are
// NOT normalized automatically (only the full 3072-dim output is), so we do it
// here, so the cosine similarity in Upstash stays correct.
function normalize(vector: number[]): number[] {
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    return length === 0 ? vector : vector.map((value) => value / length)
}

// Turn a piece of text into a normalized 768-dimension vector via Gemini. The API
// key is passed in (the caller owns config), so this runs the same in Nuxt and in
// the standalone ingest/Netlify contexts.
export async function embed(text: string, apiKey: string): Promise<number[]> {
    if (!ai) {
        ai = new GoogleGenAI({ apiKey })
    }

    // Embed the single text. The response holds one embedding per input, so ours
    // is the only entry, at [0].
    const response = await ai.models.embedContent({
        model: MODEL,
        contents: text,
        config: { outputDimensionality: DIMENSIONS }
    })

    const values = response.embeddings?.[0]?.values
    if (!values) throw new Error('Gemini returned no embedding for the input text')

    return normalize(values)
}
