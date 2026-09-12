import {describe, expect, it} from 'vitest'

import {
    emailFieldError,
    hasFieldErrors,
    passwordFieldError,
    tokenFieldError,
} from './authFields'

describe('authFields', () => {
    it('flags empty and malformed e-mails', () => {
        expect(emailFieldError('')).toBeDefined()
        expect(emailFieldError('nope')).toBeDefined()
        expect(emailFieldError('reader@example.com')).toBeUndefined()
    })

    it('flags passwords below the shared policy', () => {
        expect(passwordFieldError('')).toBeDefined()
        expect(passwordFieldError('short')).toBeDefined()
        expect(passwordFieldError('a'.repeat(12))).toBeUndefined()
    })

    it('flags empty tokens only', () => {
        expect(tokenFieldError('   ')).toBeDefined()
        expect(tokenFieldError('abc')).toBeUndefined()
    })

    it('detects whether any field carries an error', () => {
        expect(hasFieldErrors({})).toBe(false)
        expect(hasFieldErrors({email: undefined, password: undefined})).toBe(false)
        expect(hasFieldErrors({email: 'Bitte prüfen.'})).toBe(true)
    })
})
