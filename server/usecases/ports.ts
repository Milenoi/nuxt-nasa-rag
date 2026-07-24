import type { RetrievedSource } from '../domain/types'

// Ports: what the use case NEEDS from the outside, as contracts. The use case owns
// these; infrastructure adapters implement them (Dependency Inversion). The core
// never learns it is Gemini or Upstash behind them.

// Turns text into an embedding vector.
export interface Embedder {
    embed(text: string): Promise<number[]>
}

// Returns the closest stored sources for a query vector.
export interface VectorStore {
    query(vector: number[], topK: number): Promise<RetrievedSource[]>
}

// Turns a prompt into generated text.
export interface LanguageModel {
    generate(prompt: string): Promise<string>
}

// Rewrites a raw question into a cleaner search query (fixes typos, tightens
// vague wording) before it is embedded.
export interface QueryRewriter {
    rewrite(question: string): Promise<string>
}
