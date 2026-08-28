import {describe, expect, it} from 'vitest'

import {userFacingBillingError} from './userFacingBillingError'

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
})
