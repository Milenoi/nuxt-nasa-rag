import type { QuerySuggester } from './ports/gateways'

interface Deps {
    suggester: QuerySuggester
}

// Up to 3 cleaned-up alternatives for the raw question, with the original and any
// duplicates removed, so the UI only ever shows genuinely different suggestions.
export async function suggestQueries(question: string, deps: Deps): Promise<string[]> {
    const raw = await deps.suggester.suggest(question)
    const original = question.trim().toLowerCase()
    const seen = new Set<string>()
    return raw
        .map((s) => s.trim())
        .filter((s) => s && s.toLowerCase() !== original && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
        .slice(0, 3)
}
