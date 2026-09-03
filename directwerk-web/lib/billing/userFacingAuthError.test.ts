import {describe, expect, it} from 'vitest'

import {userFacingAuthError} from './userFacingBillingError'

describe('userFacingAuthError', () => {
    it('maps failed logins to German copy', () => {
        expect(userFacingAuthError(new Error('invalid_grant'), 'login')).toContain(
            'E-Mail oder Passwort falsch',
        )
        expect(
            userFacingAuthError(new Error('INVALID_CREDENTIALS'), 'login'),
        ).toContain('E-Mail oder Passwort falsch')
    })

    it('maps rate limits to a German wait-and-retry hint', () => {
        expect(
            userFacingAuthError(new Error('RATE_LIMIT_EXCEEDED'), 'login'),
        ).toContain('Zu viele Versuche')
        expect(
            userFacingAuthError(
                new Error('Request failed with status 429.'),
                'register',
            ),
        ).toContain('Zu viele Versuche')
    })

    it('maps taken emails for registration', () => {
        expect(
            userFacingAuthError(new Error('CONFLICT'), 'register'),
        ).toContain('bereits registriert')
    })

    it('maps expired links for reset and invite flows', () => {
        expect(
            userFacingAuthError(new Error('reset token expired'), 'reset'),
        ).toContain('abgelaufen oder ungültig')
        expect(
            userFacingAuthError(new Error('invalid invite token'), 'invite'),
        ).toContain('abgelaufen oder ungültig')
    })

    it('falls back to German copy for technical English messages', () => {
        expect(
            userFacingAuthError(
                new Error('The server is temporarily unreachable.'),
                'forgot',
            ),
        ).toContain('Reset-Link konnte nicht angefordert werden')
    })

    it('passes already-German messages through', () => {
        expect(
            userFacingAuthError(new Error('Karte abgelehnt'), 'login'),
        ).toBe('Karte abgelehnt')
    })
})
