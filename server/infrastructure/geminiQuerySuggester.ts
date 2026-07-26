import { GoogleGenAI } from '@google/genai'
import type { QuerySuggester } from '../usecases/ports'

// QuerySuggester adapter for Gemini: proposes corrected astronomy search queries
// (fix typos + spelling, keep the meaning). Returns them raw, one per line parsed
// into a list; the use case filters out the original and duplicates.
export function geminiQuerySuggester(apiKey: string): QuerySuggester {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async suggest(question) {
            const prompt = `Suggest up to 3 corrected astronomy search queries for the input: fix typos and spelling, keep the original meaning, expand only if it clearly helps retrieval. One per line, no numbering, no quotes, no explanation. If the input is already a clean query, return nothing.

Input: ${question}`
            const response = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: prompt
            })
            return (response.text ?? '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
        }
    }
}
