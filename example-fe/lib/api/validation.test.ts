import {describe, expect, it} from 'vitest'

import {
    parseAcceptInviteInput,
    parseForgotPasswordInput,
    parseJsonText,
    parseLoginInput,
    parseRegisterInput,
    parseResetPasswordInput,
} from './validation'

describe('JSON request validation', () => {
    it('parses JSON within the request size limit', () => {
        expect(parseJsonText('{"email":"subscriber@example.com"}')).toEqual({
            email: 'subscriber@example.com',
        })
    })

    it('rejects malformed JSON', () => {
        expect(parseJsonText('{')).toBeNull()
    })
})

describe('login input validation', () => {
    it('normalizes a valid email without modifying the password', () => {
        expect(
            parseLoginInput({
                email: ' Subscriber@Example.COM ',
                password: ' Strong password 123! ',
            }),
        ).toEqual({
            email: 'subscriber@example.com',
            password: ' Strong password 123! ',
        })
    })

    it.each([
        null,
        {},
        {email: 'not-an-email', password: 'Strong password 123!'},
        {email: 'subscriber@example.com', password: 'short'},
        {email: 'subscriber@example.com', password: 'a'.repeat(129)},
    ])('rejects invalid login input %#', (input) => {
        expect(parseLoginInput(input)).toBeNull()
    })
})

describe('registration input validation', () => {
    it('accepts a valid optional display name', () => {
        expect(
            parseRegisterInput({
                email: 'subscriber@example.com',
                password: 'Strong password 123!',
                name: '  Example Subscriber  ',
            }),
        ).toEqual({
            email: 'subscriber@example.com',
            password: 'Strong password 123!',
            name: 'Example Subscriber',
        })
    })

    it.each([
        {email: 'subscriber@example.com', password: 'Strong password 123!', name: 42},
        {email: 'subscriber@example.com', password: 'Strong password 123!', name: 'a'.repeat(256)},
        {email: 'subscriber@example.com', password: 'Strong password 123!', name: '   '},
    ])('rejects an invalid display name %#', (input) => {
        expect(parseRegisterInput(input)).toBeNull()
    })
})

describe('accept-invite input validation', () => {
    it('accepts a token, password, and optional name', () => {
        expect(
            parseAcceptInviteInput({
                token: '  invite-token  ',
                password: 'Strong password 123!',
                name: '  Invited User  ',
            }),
        ).toEqual({
            token: 'invite-token',
            password: 'Strong password 123!',
            name: 'Invited User',
        })
    })

    it('accepts a token and password without a name', () => {
        const result = parseAcceptInviteInput({
            token: '  invite-token  ',
            password: 'Strong password 123!',
        })

        expect(result).toEqual({
            token: 'invite-token',
            password: 'Strong password 123!',
        })
        expect(result).not.toHaveProperty('name')
    })

    it.each([
        null,
        {},
        {token: '', password: 'Strong password 123!'},
        {token: 'invite-token', password: 'short'},
        {token: 'a'.repeat(513), password: 'Strong password 123!'},
        {token: 'invite-token', password: 'Strong password 123!', name: '   '},
    ])('rejects invalid accept-invite input %#', (input) => {
        expect(parseAcceptInviteInput(input)).toBeNull()
    })
})

describe('forgot-password input validation', () => {
    it('normalizes a valid email', () => {
        expect(
            parseForgotPasswordInput({email: '  Subscriber@Example.COM '}),
        ).toEqual({email: 'subscriber@example.com'})
    })

    it.each([null, {}, {email: 'not-an-email'}, {email: ''}])(
        'rejects invalid forgot-password input %#',
        (input) => {
            expect(parseForgotPasswordInput(input)).toBeNull()
        },
    )
})

describe('reset-password input validation', () => {
    it('accepts a token and new password', () => {
        expect(
            parseResetPasswordInput({
                token: '  reset-token  ',
                newPassword: 'Strong password 123!',
            }),
        ).toEqual({
            token: 'reset-token',
            newPassword: 'Strong password 123!',
        })
    })

    it.each([
        null,
        {},
        {token: '', newPassword: 'Strong password 123!'},
        {token: 'reset-token', newPassword: 'short'},
        {token: 'a'.repeat(513), newPassword: 'Strong password 123!'},
    ])('rejects invalid reset-password input %#', (input) => {
        expect(parseResetPasswordInput(input)).toBeNull()
    })
})
