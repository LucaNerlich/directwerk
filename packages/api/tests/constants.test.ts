import {describe, expect, it} from 'vitest'

import {HTML_SLUG_PATTERN, SLUG_PATTERN} from '../src/constants'

describe('slug patterns', () => {
    it('accepts valid slugs in JS validation', () => {
        expect(SLUG_PATTERN.test('hello-world')).toBe(true)
        expect(SLUG_PATTERN.test('bad slug')).toBe(false)
    })

    it('compiles for HTML pattern validation with the RegExp v flag', () => {
        const pattern = new RegExp(HTML_SLUG_PATTERN, 'v')
        expect(pattern.test('hello-world')).toBe(true)
        expect(pattern.test('bad slug')).toBe(false)
    })
})
