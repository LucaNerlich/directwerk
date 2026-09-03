import {describe, expect, it} from 'vitest'

import {
    userFacingAccountError,
    userFacingBillingError,
    userFacingDownloadsError,
    userFacingFeedsError,
    userFacingGeneralError,
} from './userFacingBillingError'

describe('userFacingBillingError', () => {
    it('maps Stripe-not-configured codes for checkout', () => {
        expect(
            userFacingBillingError(new Error('STRIPE_NOT_IMPLEMENTED'), 'checkout'),
        ).toContain('Online-Zahlung ist noch nicht aktiv')
    })

    it('maps Stripe-not-configured codes for portal', () => {
        expect(
            userFacingBillingError(new Error('STRIPE_NOT_CONNECTED'), 'portal'),
        ).toContain('Stripe ist auf diesem Server')
    })

    it('passes through other error messages', () => {
        expect(
            userFacingBillingError(new Error('Karte abgelehnt'), 'checkout'),
        ).toBe('Karte abgelehnt')
    })

    it('maps English transport errors to the feeds fallback', () => {
        expect(
            userFacingBillingError(
                new Error('The server returned an invalid feed list.'),
                'feeds',
            ),
        ).toBe('Feeds konnten nicht geladen werden. Bitte versuche es später erneut.')
    })

    it('maps backend codes to the per-context fallback', () => {
        expect(userFacingFeedsError(new Error('FEED_LIMIT_REACHED'))).toBe(
            'Feeds konnten nicht geladen werden. Bitte versuche es später erneut.',
        )
        expect(userFacingDownloadsError(new Error('Failed to fetch'))).toBe(
            'Bonusdateien konnten nicht geladen werden. Bitte versuche es später erneut.',
        )
        expect(userFacingAccountError(new Error('HTTP 500'))).toBe(
            'Konto konnte nicht geladen werden. Bitte versuche es später erneut.',
        )
    })

    it('passes German subscriber messages through', () => {
        expect(
            userFacingFeedsError(new Error('Bitte erneut anmelden.')),
        ).toBe('Bitte erneut anmelden.')
    })

    it('maps non-errors to the context fallback', () => {
        expect(userFacingBillingError('kaputt', 'downloads')).toBe(
            'Bonusdateien konnten nicht geladen werden. Bitte versuche es später erneut.',
        )
    })
})

describe('userFacingGeneralError', () => {
    it('uses the caller fallback for technical errors', () => {
        expect(
            userFacingGeneralError(
                new Error('The server returned an invalid response.'),
                'Später erneut versuchen.',
            ),
        ).toBe('Später erneut versuchen.')
    })

    it('passes German messages through', () => {
        expect(
            userFacingGeneralError(
                new Error('Konto-E-Mail ist nicht verfügbar.'),
                'Später erneut versuchen.',
            ),
        ).toBe('Konto-E-Mail ist nicht verfügbar.')
    })
})
