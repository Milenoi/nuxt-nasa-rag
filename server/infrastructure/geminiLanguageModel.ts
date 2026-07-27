import { GoogleGenAI } from '@google/genai'
import type { LanguageModel } from '../usecases/ports/gateways'
import { runUpstream } from './upstreamError'

// LanguageModel adapter for Gemini. The API key is injected, not read from
// useRuntimeConfig here, so the adapter stays context-free and the composition
// root decides where the key comes from. runUpstream turns a Gemini failure into an
// UpstreamError at this boundary.
export function geminiLanguageModel(apiKey: string): LanguageModel {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async generate(prompt) {
            const response = await runUpstream('gemini-generate', () =>
                ai.models.generateContent({
                    model: 'gemini-flash-latest',
                    contents: prompt
                })
            )
            return response.text ?? ''
        }
    }
}
