import type { Embedder } from './ports/gateways'
import type { ApodCatalog, VectorStore } from './ports/repositories'
import { isReusableAsPreview } from '../domain/apod'
import type { ApodPreview } from './resolveApodPreview'

interface Deps {
    embedder: Embedder
    vectorStore: VectorStore
    catalog: ApodCatalog
}

// Same coarse floor as resolveQuestion: below it the closest match is unrelated, and
// illustrating a shared link with an unrelated picture is worse than showing none.
const MIN_RETRIEVAL_SCORE = 0.48

// The picture for a shared result link (/?q=...), so the card shows what was found
// rather than the generic site preview. Retrieval only, no language model: the top
// match already carries the image, which keeps a crawler hit cheap.
export async function resolveSharePreview(question: string, deps: Deps): Promise<ApodPreview | null> {
    const trimmed = question.trim()
    if (!trimmed) return null

    const vector = await deps.embedder.embed(trimmed)
    const [match] = await deps.vectorStore.query(vector, 1)
    if (!match || match.score < MIN_RETRIEVAL_SCORE) return null

    // The index does not store `copyright`, so ownership is re-checked for that one day.
    const entries = await deps.catalog.fetchRange(match.date, match.date)
    const owned = entries.find((entry) => entry.date === match.date && isReusableAsPreview(entry))
    return owned ? { url: owned.url, date: owned.date, title: owned.title } : null
}
