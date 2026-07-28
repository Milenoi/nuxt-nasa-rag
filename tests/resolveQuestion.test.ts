import { describe, it, expect } from 'vitest'
import { resolveQuestion } from '../server/usecases/resolveQuestion'
import type { RetrievedSource } from '../server/domain/ask'
import type { Embedder, LanguageModel } from '../server/usecases/ports/gateways'
import type { VectorStore } from '../server/usecases/ports/repositories'

// The use case never inspects the vector itself, so a fixed one is fine.
const embedder: Embedder = { embed: async () => [0.1, 0.2, 0.3] }

// A vector store that returns whatever sources the test hands it.
function vectorStore(sources: RetrievedSource[]): VectorStore {
    return { query: async () => sources }
}

// The structured reply the model now returns (the "filled form").
type Reply = {
    decision: 'answer' | 'nonsense' | 'noMatch'
    answer: string
    remark: string
    sourceIds: string[]
}

// A language model stub: fixed structured reply, records whether/how it was called.
// The whole object is cast to the port so the test needn't reimplement the generic.
function languageModel(reply: Reply) {
    const state = { calls: 0, lastPrompt: '' }
    const model = {
        async generate(prompt: string) {
            state.calls++
            state.lastPrompt = prompt
            return reply
        }
    } as unknown as LanguageModel
    return { model, state }
}

// One source with a given similarity score (and optional date = its id).
function source(score: number, date = '2024-01-01'): RetrievedSource {
    return {
        date,
        title: 'The Lion Nebula',
        imageUrl: '',
        explanation: 'A nebula shaped like a lion.',
        mediaType: 'image',
        thumbnailUrl: '',
        score
    }
}

describe('resolveQuestion', () => {
    it('returns invalidInput and never calls the model when the top score is below the cutoff', async () => {
        const llm = languageModel({ decision: 'answer', answer: 'unused', remark: '', sourceIds: [] })
        const result = await resolveQuestion('???', { playful: false }, {
            embedder,
            vectorStore: vectorStore([source(0.4)]),
            model: llm.model
        })
        expect(result.state).toBe('invalidInput')
        expect(result.sources).toEqual([])
        expect(llm.state.calls).toBe(0)
    })

    it('maps a nonsense decision to invalidInput and keeps the quip', async () => {
        const llm = languageModel({ decision: 'nonsense', answer: '', remark: 'That is a cat walking across the keyboard, captain.', sourceIds: [] })
        const result = await resolveQuestion('aqqwqqq', { playful: true }, {
            embedder,
            vectorStore: vectorStore([source(0.75)]),
            model: llm.model
        })
        expect(result.state).toBe('invalidInput')
        expect(result.remark).toBe('That is a cat walking across the keyboard, captain.')
        expect(result.sources).toEqual([])
    })

    it('maps a noMatch decision to outOfScope, keeping the sources as closest matches', async () => {
        const llm = languageModel({ decision: 'noMatch', answer: '', remark: 'Fascinating question, here is what came closest.', sourceIds: [] })
        const result = await resolveQuestion('what looks like a cat', { playful: true }, {
            embedder,
            vectorStore: vectorStore([source(0.7), source(0.6)]),
            model: llm.model
        })
        expect(result.state).toBe('outOfScope')
        expect(result.sources).toHaveLength(2)
        expect(result.answer).toBe('')
        expect(result.remark).toBe('Fascinating question, here is what came closest.')
    })

    it('returns a grounded answer for an answer decision', async () => {
        const llm = languageModel({ decision: 'answer', answer: 'The Lion Nebula (Sh2-132) resembles a big cat.', remark: '', sourceIds: [] })
        const result = await resolveQuestion('what looks like a cat', { playful: false }, {
            embedder,
            vectorStore: vectorStore([source(0.8)]),
            model: llm.model
        })
        expect(result.state).toBe('answered')
        expect(result.answer).toBe('The Lion Nebula (Sh2-132) resembles a big cat.')
        expect(result.remark).toBe('')
    })

    it('puts the Star Trek voice in the prompt only when playful is on', async () => {
        const playful = languageModel({ decision: 'answer', answer: 'answer', remark: '', sourceIds: [] })
        await resolveQuestion('q', { playful: true }, { embedder, vectorStore: vectorStore([source(0.8)]), model: playful.model })
        expect(playful.state.lastPrompt).toMatch(/Star Trek/)

        const plain = languageModel({ decision: 'answer', answer: 'answer', remark: '', sourceIds: [] })
        await resolveQuestion('q', { playful: false }, { embedder, vectorStore: vectorStore([source(0.8)]), model: plain.model })
        expect(plain.state.lastPrompt).not.toMatch(/Star Trek/)
    })

    it('keeps only real cited ids and orders the cited sources first', async () => {
        const a = source(0.9, '2024-01-01')
        const b = source(0.8, '2024-01-02')
        const c = source(0.7, '2024-01-03')
        const llm = languageModel({ decision: 'answer', answer: 'x', remark: '', sourceIds: ['2024-01-03', '9999-99-99'] })
        const result = await resolveQuestion('q', { playful: false }, {
            embedder,
            vectorStore: vectorStore([a, b, c]),
            model: llm.model
        })
        expect(result.state).toBe('answered')
        // cited source (c) moves first; the invented id is ignored; all three stay.
        expect(result.sources.map((s) => s.date)).toEqual(['2024-01-03', '2024-01-01', '2024-01-02'])
    })
})
