import { describe, it, expect } from 'vitest'
import { resolveSharePreview } from '../server/usecases/resolveSharePreview'
import type { Embedder } from '../server/usecases/ports/gateways'
import type { ApodCatalog, VectorStore } from '../server/usecases/ports/repositories'
import type { ApodEntry } from '../server/domain/apod'
import type { RetrievedSource } from '../server/domain/ask'

function source(date: string, score: number): RetrievedSource {
    return {
        date,
        title: `APOD ${date}`,
        imageUrl: `https://apod.nasa.gov/apod/image/${date}-thumb.jpg`,
        explanation: 'text',
        mediaType: 'image',
        thumbnailUrl: '',
        score
    }
}

function entry(date: string, partial: Partial<ApodEntry> = {}): ApodEntry {
    return {
        date,
        title: `APOD ${date}`,
        url: `https://apod.nasa.gov/apod/image/${date}.jpg`,
        explanation: 'text',
        mediaType: 'image',
        ...partial
    }
}

// Stubs recording what each port was asked for, so the test can assert the wiring
// (which vector, which day) without reaching for real Gemini, Upstash or NASA.
function deps(matches: RetrievedSource[], entries: ApodEntry[]) {
    const state = { embedded: '', topK: 0, range: ['', ''] as [string, string], embedCalls: 0 }
    const embedder: Embedder = {
        async embed(text) {
            state.embedCalls++
            state.embedded = text
            return [0.1, 0.2]
        }
    }
    const vectorStore: VectorStore = {
        async query(_vector, topK) {
            state.topK = topK
            return matches
        }
    }
    const catalog: ApodCatalog = {
        async fetchRange(startDate, endDate) {
            state.range = [startDate, endDate]
            return entries
        }
    }
    return { deps: { embedder, vectorStore, catalog }, state }
}

describe('resolveSharePreview', () => {
    it('embeds the trimmed question and asks for the single best match', async () => {
        const d = deps([source('2026-07-22', 0.7)], [entry('2026-07-22')])
        await resolveSharePreview('  the crab nebula  ', d.deps)
        expect(d.state.embedded).toBe('the crab nebula')
        expect(d.state.topK).toBe(1)
    })

    it('returns the picture of the top match', async () => {
        const d = deps([source('2026-07-22', 0.7)], [entry('2026-07-22', { title: 'Corona Australis' })])
        const result = await resolveSharePreview('nebula', d.deps)
        expect(result).toEqual({
            url: 'https://apod.nasa.gov/apod/image/2026-07-22.jpg',
            date: '2026-07-22',
            title: 'Corona Australis'
        })
    })

    it('re-checks ownership for exactly the matched day', async () => {
        const d = deps([source('2026-07-22', 0.7)], [entry('2026-07-22')])
        await resolveSharePreview('nebula', d.deps)
        expect(d.state.range).toEqual(['2026-07-22', '2026-07-22'])
    })

    it('falls back to null when the matched picture belongs to a photographer', async () => {
        const d = deps([source('2026-08-01', 0.7)], [entry('2026-08-01', { copyright: 'A Photographer' })])
        expect(await resolveSharePreview('nebula', d.deps)).toBeNull()
    })

    it('falls back to null when the match is a video', async () => {
        const d = deps([source('2026-07-26', 0.7)], [entry('2026-07-26', { mediaType: 'video' })])
        expect(await resolveSharePreview('nebula', d.deps)).toBeNull()
    })

    it('ignores a match too weak to be related, without asking NASA', async () => {
        const d = deps([source('2026-07-22', 0.3)], [entry('2026-07-22')])
        expect(await resolveSharePreview('asdfgh', d.deps)).toBeNull()
        expect(d.state.range).toEqual(['', ''])
    })

    it('returns null when nothing was retrieved at all', async () => {
        const d = deps([], [])
        expect(await resolveSharePreview('nebula', d.deps)).toBeNull()
    })

    it('skips the embedding call entirely for a blank question', async () => {
        const d = deps([source('2026-07-22', 0.7)], [entry('2026-07-22')])
        expect(await resolveSharePreview('   ', d.deps)).toBeNull()
        expect(d.state.embedCalls).toBe(0)
    })

    it('does not accept a NASA entry for a different day than the match', async () => {
        const d = deps([source('2026-07-22', 0.7)], [entry('2026-07-21')])
        expect(await resolveSharePreview('nebula', d.deps)).toBeNull()
    })
})
