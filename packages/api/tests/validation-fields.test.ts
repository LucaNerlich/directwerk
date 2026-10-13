import {describe, expect, it} from 'vitest'

import {
    isValidEmail,
    isValidPassword,
    parseLoginInput,
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

describe('parseLoginInput', () => {
    // #301: the 12-character rule is a registration policy; signing in must accept any
    // non-empty password the backend accepts (its own minimum is 8).
    it('accepts a valid 8-character password', () => {
        expect(parseLoginInput({email: 'user@example.com', password: 'a'.repeat(8)})).toEqual({
            email: 'user@example.com',
            password: 'a'.repeat(8),
        })
    })

    it('still rejects an empty or over-long password', () => {
        expect(parseLoginInput({email: 'user@example.com', password: ''})).toBeNull()
        expect(
            parseLoginInput({email: 'user@example.com', password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1)}),
        ).toBeNull()
    })

    it('keeps the registration minimum on the register parser', () => {
        expect(isValidPassword('a'.repeat(11))).toBe(false)
    })
})
