'use client'

import {
    parseNewsletterSubscribeInput,
    parseNewsletterTokenInput,
    type NewsletterSubscribeInput,
    type NewsletterTokenInput,
} from '@directwerk/api/validation/input'

import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {postJson} from './transport'

export async function subscribeToNewsletter(
    input: NewsletterSubscribeInput,
): Promise<void> {
    const parsed = parseNewsletterSubscribeInput(input)
    if (parsed === null) {
        throw new Error('Ungültige Eingabe.')
    }
    await postJson('/api/newsletter/subscribe', getWebClientTenantHost(), parsed)
}

export async function confirmNewsletterSubscription(
    input: NewsletterTokenInput,
): Promise<void> {
    const parsed = parseNewsletterTokenInput(input)
    if (parsed === null) {
        throw new Error('Ungültiger Token.')
    }
    await postJson('/api/newsletter/confirm', getWebClientTenantHost(), parsed)
}

export async function unsubscribeFromNewsletter(
    input: NewsletterTokenInput,
): Promise<void> {
    const parsed = parseNewsletterTokenInput(input)
    if (parsed === null) {
        throw new Error('Ungültiger Token.')
    }
    await postJson('/api/newsletter/unsubscribe', getWebClientTenantHost(), parsed)
}
