import {describe, expect, it} from 'vitest'

import {suggestSlug} from './studioHelpers'

describe('suggestSlug', () => {
    it('normalizes uppercase sharp s', () => {
        expect(suggestSlug('GROẞE')).toBe('grosse')
    })
})
