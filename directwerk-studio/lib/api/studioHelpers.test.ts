import {describe, expect, it} from 'vitest'

import {suggestSlug} from './studioHelpers'

describe('suggestSlug', () => {
    it('normalizes uppercase sharp s', () => {
        expect(suggestSlug('GROẞE')).toBe('grosse')
    })

    it('does not leave a trailing hyphen after truncation', () => {
        const slug = suggestSlug('a'.repeat(62) + ' b')

        expect(slug.length).toBeLessThanOrEqual(63)
        expect(slug).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
    })
})
