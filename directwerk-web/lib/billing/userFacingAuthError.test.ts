import {describe, expect, it} from 'vitest'

import {testDictionary} from '@/lib/i18n/testDictionary'

import {userFacingAuthError} from './userFacingBillingError'

describe('userFacingAuthError', () => {
    it('maps failed logins to German copy', () => {
        expect(userFacingAuthError(new Error('invalid_grant'), 'login', testDictionary.errors)).toContain(
            'E-Mail oder Passwort falsch',
        )
        expect(
            userFacingAuthError(new Error('INVALID_CREDENTIALS'), 'login', testDictionary.errors),
        ).toContain('E-Mail oder Passwort falsch')
    })

    it('maps rate limits to a German wait-and-retry hint', () => {
        expect(
            userFacingAuthError(new Error('RATE_LIMIT_EXCEEDED'), 'login', testDictionary.errors),
        ).toContain('Zu viele Versuche')
        expect(
            userFacingAuthError(
                new Error('Request failed with status 429.'),
                'register',
                testDictionary.errors,
            ),
        ).toContain('Zu viele Versuche')
    })

    it('maps taken emails for registration', () => {
        expect(
            userFacingAuthError(new Error('CONFLICT'), 'register', testDictionary.errors),
        ).toContain('bereits registriert')
    })

    it('maps expired links for reset and invite flows', () => {
        expect(
            userFacingAuthError(new Error('reset token expired'), 'reset', testDictionary.errors),
        ).toContain('abgelaufen oder ungültig')
        expect(
            userFacingAuthError(new Error('invalid invite token'), 'invite', testDictionary.errors),
        ).toContain('abgelaufen oder ungültig')
    })

    it('falls back to German copy for technical English messages', () => {
        expect(
            userFacingAuthError(
                new Error('The server is temporarily unreachable.'),
                'forgot',
                testDictionary.errors,
            ),
        ).toContain('Reset-Link konnte nicht angefordert werden')
    })

    it('does not expose unrecognized backend messages', () => {
        expect(
            userFacingAuthError(
                new Error('database connection refused for auth-db.internal'),
                'login',
                testDictionary.errors,
            ),
        ).toContain('Anmeldung fehlgeschlagen')
    })
})
