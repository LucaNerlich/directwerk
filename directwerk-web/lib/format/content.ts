import type {AccessPolicy} from '@directwerk/api/types'

export function accessPolicyLabel(policy: AccessPolicy): string {
    return policy === 'PAID' ? 'Bezahlt' : 'Frei'
}

/**
 * Entitlement-aware badge state. `isEntitled` reflects whether the viewer can
 * actually consume the item right now (e.g. playable audio / readable body),
 * not just the `SUBSCRIBER` role — see asset-storage access-control docs.
 */
export type EntitlementState = 'free' | 'included' | 'locked'

export function entitlementState(
    policy: AccessPolicy,
    isEntitled: boolean,
): EntitlementState {
    if (policy === 'FREE') {
        return 'free'
    }
    return isEntitled ? 'included' : 'locked'
}

/**
 * User-facing entitlement label shown on badges. Replaces the bare
 * `accessPolicyLabel` ("Bezahlt") wherever the viewer cares about access:
 * "Frei" / "Enthalten" / "Mitgliedschaft nötig".
 */
export function entitlementLabel(
    policy: AccessPolicy,
    isEntitled = false,
): 'Frei' | 'Enthalten' | 'Mitgliedschaft nötig' {
    switch (entitlementState(policy, isEntitled)) {
        case 'free':
            return 'Frei'
        case 'included':
            return 'Enthalten'
        case 'locked':
            return 'Mitgliedschaft nötig'
    }
}

export function formatDuration(seconds: number | null): string | null {
    if (seconds === null || seconds <= 0) {
        return null
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

export function formatFileSize(bytes: number | null): string | null {
    if (bytes === null || bytes <= 0) {
        return null
    }
    if (bytes < 1024) {
        return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`
    }
    const mb = bytes / (1024 * 1024)
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}

export function assetTypeLabel(assetType: string): string {
    switch (assetType.toUpperCase()) {
        case 'PDF':
            return 'PDF'
        case 'IMAGE':
            return 'Bild'
        case 'AUDIO':
            return 'Audio'
        case 'VIDEO':
            return 'Video'
        case 'DOCUMENT':
            return 'Dokument'
        default:
            return assetType
    }
}

export function subscriptionStatusLabel(status: string): string {
    switch (status) {
        case 'ACTIVE':
            return 'Aktiv'
        case 'PAST_DUE':
            return 'Zahlungsrückstand'
        case 'CANCELED':
            return 'Beendet'
        case 'INCOMPLETE':
            return 'Unvollständig'
        default:
            return status
    }
}

export function billingSourceLabel(source: string): string {
    switch (source) {
        case 'STRIPE':
            return 'Stripe'
        case 'PATREON':
            return 'Patreon'
        case 'STEADY':
            return 'Steady'
        case 'MANUAL':
            return 'Freischaltung'
        default:
            return source
    }
}
