// Domain entities: the plain data the ask flow passes around. No SDK, no Nuxt,
// no I/O. Innermost layer, depends on nothing.

// One APOD source retrieved for a question, with its cosine similarity score.
export interface RetrievedSource {
    date: string
    title: string
    imageUrl: string
    explanation: string
    mediaType: string
    thumbnailUrl: string
    score: number
}

// What the pipeline decided about a question.
export type AskState = 'answer' | 'noAnswer' | 'nonsense'

// The result the use case returns and the API/UI share.
export interface AskResult {
    state: AskState
    sources: RetrievedSource[]
    topScore: number
    answer: string
    remark: string
}
