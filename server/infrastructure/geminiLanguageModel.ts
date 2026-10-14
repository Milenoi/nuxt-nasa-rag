import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type { LanguageModel } from '../usecases/ports/gateways'
import { runUpstream } from './upstreamError'

// Free tier swamps single Flash models for weeks (3.7 in Sept, 3.6 in Oct: 503 on every call),
// so each retry moves down this list; the lite models kept answering when flash did not.
const LAST_RESORT_MODEL = 'gemini-3.1-flash-lite'
const GEMINI_TEXT_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', LAST_RESORT_MODEL] as const

// Attempts beyond the list stay on the last model, never back to the busy first one.
export const geminiModelFor = (attempt: number) => GEMINI_TEXT_MODELS[attempt - 1] ?? LAST_RESORT_MODEL

// LanguageModel adapter for Gemini. The API key is injected, not read here, so the
// adapter stays context-free. It turns the injected Zod schema into Gemini's JSON
// schema, calls the model in JSON mode, and validates the reply with the same
// schema. Doing the parse + validate inside runUpstream means an SDK failure, a
// broken JSON body, or a schema mismatch all surface as one typed UpstreamError.
export function geminiLanguageModel(apiKey: string): LanguageModel {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async generate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
            return runUpstream('gemini-generate', async (attempt) => {
                const response = await ai.models.generateContent({
                    model: geminiModelFor(attempt),
                    contents: prompt,
                    config: {
                        responseMimeType: 'application/json',
                        responseJsonSchema: z.toJSONSchema(schema)
                    }
                })
                return schema.parse(JSON.parse(response.text ?? ''))
            })
        }
    }
}
