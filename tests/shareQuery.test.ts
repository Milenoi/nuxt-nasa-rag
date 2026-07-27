import { describe, it, expect } from 'vitest'
import { shareQuery } from '../app/utils/shareQuery'

describe('shareQuery', () => {
    it('encodes the question and both toggles', () => {
        expect(shareQuery({ q: 'nebula', hero: 0, starTrek: true, rewrite: false })).toEqual({
            q: 'nebula',
            st: '1',
            rw: '0'
        })
    })

    it('omits hero at 0 (the top match) and includes it otherwise', () => {
        expect(shareQuery({ q: 'q', hero: 0, starTrek: false, rewrite: false })).not.toHaveProperty('hero')
        expect(shareQuery({ q: 'q', hero: 3, starTrek: false, rewrite: false }).hero).toBe('3')
    })

    it('maps the toggles to 1/0 strings', () => {
        const on = shareQuery({ q: 'q', hero: 0, starTrek: true, rewrite: true })
        expect(on.st).toBe('1')
        expect(on.rw).toBe('1')
        const off = shareQuery({ q: 'q', hero: 0, starTrek: false, rewrite: false })
        expect(off.st).toBe('0')
        expect(off.rw).toBe('0')
    })
})
