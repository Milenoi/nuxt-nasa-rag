import type { ZodType } from 'zod'

// Gateway ports: outbound access to external capabilities (the Gemini services).
// Adapters implement these; the use cases know only these contracts, never the SDK.

// Turns text into an embedding vector.
export interface Embedder {
    embed(text: string): Promise<number[]>
}

// Turns a prompt into a structured reply that matches the given Zod schema.
export interface LanguageModel {
    generate<T>(prompt: string, schema: ZodType<T>): Promise<T>
}

// Suggests corrected search queries (fix typos, tighten vague wording) for the user
// to pick from before one is embedded.
export interface QuerySuggester {
    suggest(question: string): Promise<string[]>
}
