import { GoogleGenAI } from '@google/genai'
import type { LanguageModel } from '../usecases/ports/gateways'

// LanguageModel adapter for Gemini. The API key is injected, not read from
// useRuntimeConfig here, so the adapter stays context-free and the composition
// root decides where the key comes from.
export function geminiLanguageModel(apiKey: string): LanguageModel {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async generate(prompt) {
            const response = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: prompt
            })
            return response.text ?? ''
        }
    }
}
