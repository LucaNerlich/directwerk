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

    it('does not expose unapproved payment messages', () => {
        expect(
            userFacingBillingError(new Error('Karte abgelehnt'), 'checkout'),
        ).toContain('Checkout ist noch nicht verfügbar')
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

    it('does not expose arbitrary localized backend messages', () => {
        expect(
            userFacingFeedsError(new Error('Bitte erneut anmelden.')),
        ).toBe('Feeds konnten nicht geladen werden. Bitte versuche es später erneut.')
    })

    it('does not expose unrecognized backend diagnostics', () => {
        expect(
            userFacingBillingError(
                new Error('database connection refused for billing-db.internal'),
                'checkout',
            ),
        ).toContain('Checkout ist noch nicht verfügbar')
    })

    it('maps non-errors to the context fallback', () => {
        expect(userFacingBillingError('kaputt', 'downloads')).toBe(
            'Bonusdateien konnten nicht geladen werden. Bitte versuche es später erneut.',
        )
    })

    it('maps FEATURE_NOT_ENABLED to descriptive copy per context', () => {
        const coded = (message: string) =>
            Object.assign(new Error(message), {
                code: 'FEATURE_NOT_ENABLED',
                status: 403,
            })
        const backendMessage = 'Module SUBSCRIPTION is not active for this tenant'

        expect(userFacingAccountError(coded(backendMessage))).toBe(
            'Mitgliedschaften sind bei diesem Anbieter deaktiviert. Profil, Zugang und Feeds bleiben verfügbar.',
        )
        expect(userFacingFeedsError(coded(backendMessage))).toBe(
            'Private Feeds sind bei diesem Anbieter deaktiviert.',
        )
        expect(userFacingDownloadsError(coded(backendMessage))).toBe(
            'Bonusdateien sind bei diesem Anbieter deaktiviert.',
        )
        expect(userFacingBillingError(coded(backendMessage), 'checkout')).toBe(
            'Abos sind bei diesem Anbieter deaktiviert. Wende dich für Zugang an die Redaktion.',
        )
    })

    it('does not leak the raw backend message for disabled features', () => {
        const error = Object.assign(
            new Error('Module SUBSCRIPTION is not active for this tenant'),
            {code: 'FEATURE_NOT_ENABLED', status: 403},
        )

        expect(userFacingAccountError(error)).not.toContain('Module SUBSCRIPTION')
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

    it('does not expose arbitrary messages', () => {
        expect(
            userFacingGeneralError(
                new Error('Konto-E-Mail ist nicht verfügbar.'),
                'Später erneut versuchen.',
            ),
        ).toBe('Später erneut versuchen.')
    })
})
