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

export function billingIntervalLabel(interval: string | null | undefined): string {
    switch (interval) {
        case 'MONTH':
            return 'Monatlich'
        case 'YEAR':
            return 'Jährlich'
        case 'ONE_TIME':
            return 'Einmalig'
        default:
            return interval ?? '—'
    }
}

export function offeringTypeLabel(offeringType: string | null | undefined): string {
    switch (offeringType) {
        case 'LEVEL':
            return 'Stufe'
        case 'PACKAGE':
            return 'Paket'
        default:
            return offeringType ?? '—'
    }
}

export function productScopeLabel(scopeType: string): string {
    switch (scopeType) {
        case 'ALL_PODCASTS':
            return 'Alle Podcasts'
        case 'PODCAST_SERIES':
            return 'Sendung'
        case 'FORMAT':
            return 'Format'
        case 'CATEGORY':
            return 'Kategorie'
        case 'DIGITAL_ASSET':
            return 'Bonusdatei'
        default:
            return scopeType
    }
}

export function assetTypeLabel(assetType: string): string {
    switch (assetType) {
        case 'AUDIO':
            return 'Audio'
        case 'IMAGE':
            return 'Bild'
        case 'VIDEO':
            return 'Video'
        case 'DOCUMENT':
            return 'Dokument'
        default:
            return assetType
    }
}

export function mediaStatusLabel(status: string): string {
    switch (status) {
        case 'PENDING':
            return 'Ausstehend'
        case 'READY':
            return 'Bereit'
        case 'PENDING_DELETE':
            return 'Wird gelöscht'
        case 'ARCHIVED':
            return 'Archiviert'
        default:
            return status
    }
}

export function visibilityLabel(visibility: string | null | undefined): string {
    switch (visibility) {
        case 'PUBLIC':
            return 'Öffentlich'
        case 'PRIVATE':
            return 'Privat'
        default:
            return visibility ?? '—'
    }
}
