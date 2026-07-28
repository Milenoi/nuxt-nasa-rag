import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import type { LanguageModel } from '../usecases/ports/gateways'
import { runUpstream } from './upstreamError'

// LanguageModel adapter for Gemini. The API key is injected, not read here, so the
// adapter stays context-free. It turns the injected Zod schema into Gemini's JSON
// schema, calls the model in JSON mode, and validates the reply with the same
// schema. Doing the parse + validate inside runUpstream means an SDK failure, a
// broken JSON body, or a schema mismatch all surface as one typed UpstreamError.
export function geminiLanguageModel(apiKey: string): LanguageModel {
    const ai = new GoogleGenAI({ apiKey })
    return {
        async generate<T>(prompt: string, schema: z.ZodType<T>): Promise<T> {
            return runUpstream('gemini-generate', async () => {
                const response = await ai.models.generateContent({
                    model: 'gemini-flash-latest',
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
