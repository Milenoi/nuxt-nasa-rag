import { describe, it, expect } from 'vitest'
import { resolveQuestion } from '../server/usecases/resolveQuestion'
import type { RetrievedSource } from '../server/domain/types'
import type { Embedder, VectorStore, LanguageModel, QueryRewriter } from '../server/usecases/ports'

// The use case never inspects the vector itself, so a fixed one is fine.
const embedder: Embedder = { embed: async () => [0.1, 0.2, 0.3] }

// A rewriter that returns the input unchanged (for tests where rewrite is off).
const identityRewriter: QueryRewriter = { rewrite: async (q) => q }

// A vector store that returns whatever sources the test hands it.
function vectorStore(sources: RetrievedSource[]): VectorStore {
    return { query: async () => sources }
}

// A language model stub: fixed reply, and it records whether/how it was called.
function languageModel(reply: string) {
    const state = { calls: 0, lastPrompt: '' }
    const model: LanguageModel = {
        async generate(prompt) {
            state.calls++
            state.lastPrompt = prompt
            return reply
        }
    }
    return { model, state }
}

// A rewriter stub: returns a fixed rewrite, records if/what it was asked to rewrite.
function queryRewriter(rewritten: string) {
    const state = { calls: 0, lastInput: '' }
    const rewriter: QueryRewriter = {
        async rewrite(question) {
            state.calls++
            state.lastInput = question
            return rewritten
        }
    }
    return { rewriter, state }
}

// One source with a given similarity score.
function source(score: number): RetrievedSource {
    return {
        date: '2024-01-01',
        title: 'The Lion Nebula',
        imageUrl: '',
        explanation: 'A nebula shaped like a lion.',
        mediaType: 'image',
        thumbnailUrl: '',
        score
    }
}

describe('resolveQuestion', () => {
    it('returns nonsense and never calls the model when the top score is below the cutoff', async () => {
        const llm = languageModel('unused')
        const result = await resolveQuestion('???', { playful: false, rewrite: false }, {
            embedder,
            vectorStore: vectorStore([source(0.4)]),
            model: llm.model,
            rewriter: identityRewriter
        })
        expect(result.state).toBe('nonsense')
        expect(result.sources).toEqual([])
        expect(llm.state.calls).toBe(0)
    })

    it('maps the model NONSENSE sentinel to the nonsense state and extracts the quip', async () => {
        const llm = languageModel('NONSENSE :: That is a cat walking across the keyboard, captain.')
        const result = await resolveQuestion('aqqwqqq', { playful: true, rewrite: false }, {
            embedder,
            vectorStore: vectorStore([source(0.75)]),
            model: llm.model,
            rewriter: identityRewriter
        })
        expect(result.state).toBe('nonsense')
        expect(result.remark).toBe('That is a cat walking across the keyboard, captain.')
        expect(result.sources).toEqual([])
    })

    it('maps NO_MATCH to noAnswer, keeping the sources as closest matches', async () => {
        const llm = languageModel('NO_MATCH :: Fascinating question, here is what came closest.')
        const result = await resolveQuestion('what looks like a cat', { playful: true, rewrite: false }, {
            embedder,
            vectorStore: vectorStore([source(0.7), source(0.6)]),
            model: llm.model,
            rewriter: identityRewriter
        })
        expect(result.state).toBe('noAnswer')
        expect(result.sources).toHaveLength(2)
        expect(result.answer).toBe('')
        expect(result.remark).toBe('Fascinating question, here is what came closest.')
    })

    it('returns a grounded answer for a normal reply', async () => {
        const llm = languageModel('The Lion Nebula (Sh2-132) resembles a big cat.')
        const result = await resolveQuestion('what looks like a cat', { playful: false, rewrite: false }, {
            embedder,
            vectorStore: vectorStore([source(0.8)]),
            model: llm.model,
            rewriter: identityRewriter
        })
        expect(result.state).toBe('answer')
        expect(result.answer).toBe('The Lion Nebula (Sh2-132) resembles a big cat.')
        expect(result.remark).toBe('')
    })

    it('puts the Star Trek voice in the prompt only when playful is on', async () => {
        const playful = languageModel('answer')
        await resolveQuestion('q', { playful: true, rewrite: false }, { embedder, vectorStore: vectorStore([source(0.8)]), model: playful.model, rewriter: identityRewriter })
        expect(playful.state.lastPrompt).toMatch(/Star Trek/)

        const plain = languageModel('answer')
        await resolveQuestion('q', { playful: false, rewrite: false }, { embedder, vectorStore: vectorStore([source(0.8)]), model: plain.model, rewriter: identityRewriter })
        expect(plain.state.lastPrompt).not.toMatch(/Star Trek/)
    })

    it('rewrites the query before embedding when rewrite is on', async () => {
        const rw = queryRewriter('Thor helmet nebula')
        let embedded = ''
        const spyEmbedder: Embedder = { embed: async (t) => { embedded = t; return [0.1] } }
        await resolveQuestion('Tohr', { playful: false, rewrite: true }, {
            embedder: spyEmbedder,
            vectorStore: vectorStore([source(0.8)]),
            model: languageModel('answer').model,
            rewriter: rw.rewriter
        })
        expect(rw.state.calls).toBe(1)
        expect(rw.state.lastInput).toBe('Tohr')
        expect(embedded).toBe('Thor helmet nebula')
    })

    it('skips the rewriter and embeds the original query when rewrite is off', async () => {
        const rw = queryRewriter('should not be used')
        let embedded = ''
        const spyEmbedder: Embedder = { embed: async (t) => { embedded = t; return [0.1] } }
        await resolveQuestion('nebula', { playful: false, rewrite: false }, {
            embedder: spyEmbedder,
            vectorStore: vectorStore([source(0.8)]),
            model: languageModel('answer').model,
            rewriter: rw.rewriter
        })
        expect(rw.state.calls).toBe(0)
        expect(embedded).toBe('nebula')
    })
})
