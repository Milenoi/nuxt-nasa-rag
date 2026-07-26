import { GoogleGenAI } from '@google/genai'
import type { QueryRewriter } from '../usecases/ports'

// QueryRewriter adapter for Gemini: turns the raw question into a tighter search
// query (fix typos + spelling, keep the meaning) before it is embedded. Falls back
// to the original if the model returns nothing usable.
export function geminiQueryRewriter(apiKey: string): QueryRewriter {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async rewrite(question) {
            const prompt = `Rewrite the input into a short, clear astronomy search query: fix typos and spelling, keep the original meaning, expand only if it clearly helps retrieval. Return ONLY the rewritten query, no quotes and no explanation.

Input: ${question}`
            const response = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: prompt
            })
            return (response.text ?? '').trim() || question
        }
    }
}
