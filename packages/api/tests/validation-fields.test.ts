import {describe, expect, it} from 'vitest'

import {
    isValidEmail,
    isValidPassword,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
} from '../src/validation/input'

describe('isValidEmail', () => {
    it('accepts trimmed, normalizable addresses', () => {
        expect(isValidEmail('  Reader@Example.COM ')).toBe(true)
        expect(isValidEmail('a@b.co')).toBe(true)
    })

    it('rejects malformed addresses and non-strings', () => {
        expect(isValidEmail('not-an-email')).toBe(false)
        expect(isValidEmail('missing@domain')).toBe(false)
        expect(isValidEmail('   ')).toBe(false)
        expect(isValidEmail(undefined)).toBe(false)
    })
})

describe('isValidPassword', () => {
    it('requires the shared minimum length', () => {
        expect(PASSWORD_MIN_LENGTH).toBe(12)
        expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(true)
        expect(isValidPassword('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false)
    })

    it('rejects values over the shared maximum', () => {
        expect(isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH))).toBe(true)
        expect(isValidPassword('a'.repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false)
    })
})
