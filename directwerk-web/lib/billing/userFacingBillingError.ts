const STRIPE_UNAVAILABLE_CODES = new Set([
    'STRIPE_NOT_IMPLEMENTED',
    'STRIPE_NOT_CONNECTED',
])

/**
 * Maps API billing errors to subscriber-friendly German copy.
 */
export function userFacingBillingError(
    error: unknown,
    context: 'checkout' | 'portal',
): string {
    if (!(error instanceof Error)) {
        return context === 'checkout'
            ? 'Checkout ist noch nicht verfügbar.'
            : 'Kundenportal konnte nicht geöffnet werden.'
    }

    const message = error.message
    if (
        STRIPE_UNAVAILABLE_CODES.has(message) ||
        message.toLowerCase().includes('not implemented')
    ) {
        return context === 'checkout'
            ? 'Online-Zahlung ist noch nicht aktiv. Du kannst das Produkt merken und später zurückkommen — oder die Redaktion schaltet dich im Studio frei.'
            : 'Stripe ist auf diesem Server noch nicht eingerichtet.'
    }

    return message
}
