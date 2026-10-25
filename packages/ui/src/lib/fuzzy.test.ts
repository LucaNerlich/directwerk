import {describe, expect, it} from 'vitest'

import {fuzzyFilter} from './fuzzy'

interface Row {
    name: string
    slug: string
    email?: string
}

const rows: Row[] = [
    {name: 'Alpha Podcast', slug: 'alpha-podcast', email: 'alpha@example.com'},
    {name: 'Beta Show', slug: 'beta-show', email: 'beta@example.com'},
    {name: 'Cover Art', slug: 'cover-art', email: 'cover@example.com'},
]

describe('fuzzyFilter', () => {
    it('returns the same items reference when the query is empty or whitespace', () => {
        expect(fuzzyFilter(rows, '', {keys: ['name']})).toBe(rows)
        expect(fuzzyFilter(rows, '   ', {keys: ['name']})).toBe(rows)
    })

    it('matches on configured keys', () => {
        const bySlug = fuzzyFilter(rows, 'beta-show', {keys: ['slug']})
        expect(bySlug.map((row) => row.slug)).toEqual(['beta-show'])

        const byEmail = fuzzyFilter(rows, 'cover@', {keys: ['email', 'name']})
        expect(byEmail.map((row) => row.name)).toEqual(['Cover Art'])
    })

    it('tolerates small typos', () => {
        const hits = fuzzyFilter(rows, 'covr art', {keys: ['name']})
        expect(hits.map((row) => row.name)).toContain('Cover Art')
    })

    it('returns an empty array when nothing matches', () => {
        expect(fuzzyFilter(rows, 'zzzz-not-a-hit', {keys: ['name', 'slug']})).toEqual([])
    })
})
