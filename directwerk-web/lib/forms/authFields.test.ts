import {describe, expect, it} from 'vitest'

import {testDictionary} from '@/lib/i18n/testDictionary'

import {
    emailFieldError,
    hasFieldErrors,
    nameFieldError,
    passwordFieldError,
    tokenFieldError,
} from './authFields'

describe('authFields', () => {
    it('flags empty and malformed e-mails', () => {
        expect(emailFieldError('', testDictionary.auth)).toBeDefined()
        expect(emailFieldError('nope', testDictionary.auth)).toBeDefined()
        expect(emailFieldError('reader@example.com', testDictionary.auth)).toBeUndefined()
    })

    it('flags passwords below the shared policy', () => {
        expect(passwordFieldError('', testDictionary.auth)).toBeDefined()
        expect(passwordFieldError('short', testDictionary.auth)).toBeDefined()
        expect(passwordFieldError('a'.repeat(12), testDictionary.auth)).toBeUndefined()
    })

    it('flags empty tokens only', () => {
        expect(tokenFieldError('   ', testDictionary.auth)).toBeDefined()
        expect(tokenFieldError('abc', testDictionary.auth)).toBeUndefined()
    })

    it('rejects whitespace-only optional names', () => {
        expect(nameFieldError('', testDictionary.auth)).toBeUndefined()
        expect(nameFieldError('Luca', testDictionary.auth)).toBeUndefined()
        expect(nameFieldError('   ', testDictionary.auth)).toBeDefined()
    })

    it('detects whether any field carries an error', () => {
        expect(hasFieldErrors({})).toBe(false)
        expect(hasFieldErrors({email: undefined, password: undefined})).toBe(false)
        expect(hasFieldErrors({email: 'Bitte prüfen.'})).toBe(true)
    })
})
