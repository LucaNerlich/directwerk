'use client'

import {parseCheckoutSessionEnvelope, parseSubscriptionListEnvelope} from '@directwerk/api/validation/public'

import type {
    SubscriptionSummary,
} from '@directwerk/api/types'
import {
    authenticatedRequest,
    envelopeResult,
} from './transport'

export async function createCheckoutSession(
    tenantHost: string,
    productSlug: string,
): Promise<string | null> {
    const value = await authenticatedRequest(
        '/api/proxy/me/billing/checkout-sessions',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({productSlug}),
        },
    )
    return parseCheckoutSessionEnvelope(value)
}

export async function listMySubscriptions(
    tenantHost: string,
): Promise<SubscriptionSummary[]> {
    return envelopeResult(
        parseSubscriptionListEnvelope,
        await authenticatedRequest('/api/proxy/me/subscriptions', tenantHost),
        'Der Server hat eine ungültige Abo-Liste geliefert.',
    ).data
}

export async function createPortalSession(
    tenantHost: string,
    returnUrl: string,
): Promise<string | null> {
    const value = await authenticatedRequest(
        '/api/proxy/me/billing/portal',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({returnUrl}),
        },
    )
    return parseCheckoutSessionEnvelope(value)
}
