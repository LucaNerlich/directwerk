export function subscriptionSourceLabel(source: string): string {
    if (source === 'STRIPE') {
        return 'Stripe'
    }
    if (source === 'MANUAL' || source === 'SEED') {
        return 'Freischaltung'
    }
    return source
}

export function subscriptionStatusLabel(status: string): string {
    switch (status) {
        case 'ACTIVE':
            return 'Aktiv'
        case 'PAST_DUE':
            return 'Zahlungsrückstand'
        case 'INCOMPLETE':
            return 'Unvollständig'
        case 'CANCELED':
            return 'Gekündigt'
        case 'EXPIRED':
            return 'Abgelaufen'
        default:
            return status
    }
}
