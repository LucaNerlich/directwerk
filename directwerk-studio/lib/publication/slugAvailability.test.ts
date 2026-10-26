import {describe, expect, it} from 'vitest'

import {isSlugTaken, toSlugEntries} from './slugAvailability'

describe('toSlugEntries', () => {
    it('keeps only id and slug', () => {
        expect(
            toSlugEntries([
                {
                    id: 1,
                    slug: 'a',
                    body: '<p>huge</p>',
                    description: 'notes',
                } as {id: number; slug: string; body: string; description: string},
            ]),
        ).toEqual([{id: 1, slug: 'a'}])
    })
})

describe('isSlugTaken', () => {
    const entries = [
        {id: 1, slug: 'alpha'},
        {id: 2, slug: 'Beta'},
    ]

    it('matches case-insensitively and trims', () => {
        expect(isSlugTaken(entries, '  BETA  ')).toBe(true)
        expect(isSlugTaken(entries, 'gamma')).toBe(false)
    })

    it('excludes the current publication id', () => {
        expect(isSlugTaken(entries, 'alpha', 1)).toBe(false)
        expect(isSlugTaken(entries, 'alpha', 2)).toBe(true)
    })
})
