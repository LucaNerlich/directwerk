import type {AccessPolicy} from '@directwerk/api/types'

import type {Dictionary} from '@/lib/i18n/dictionary'

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
 * User-facing entitlement label shown on badges wherever the viewer cares
 * about access.
 */
export function entitlementLabel(
    policy: AccessPolicy,
    isEntitled: boolean,
    format: Dictionary['format'],
): string {
    switch (entitlementState(policy, isEntitled)) {
        case 'free':
            return format.entitlementFree
        case 'included':
            return format.entitlementIncluded
        case 'locked':
            return format.entitlementLocked
    }
}

/** Clock-style duration, shared with the studio import wizard. */
export {formatDuration} from '@directwerk/api/format/duration'

/** Converts an asset type to its localized display label; returns `assetType` when unrecognized. */
export function assetTypeLabel(
    assetType: string,
    format: Dictionary['format'],
): string {
    switch (assetType.toUpperCase()) {
        case 'PDF':
            return format.assetPdf
        case 'IMAGE':
            return format.assetImage
        case 'AUDIO':
            return format.assetAudio
        case 'VIDEO':
            return format.assetVideo
        case 'DOCUMENT':
            return format.assetDocument
        default:
            return assetType
    }
}

export function subscriptionStatusLabel(
    status: string,
    format: Dictionary['format'],
): string {
    switch (status) {
        case 'ACTIVE':
            return format.subscriptionActive
        case 'PAST_DUE':
            return format.subscriptionPastDue
        case 'CANCELED':
            return format.subscriptionCanceled
        case 'INCOMPLETE':
            return format.subscriptionIncomplete
        default:
            return status
    }
}

export function billingSourceLabel(
    source: string,
    format: Dictionary['format'],
): string {
    switch (source) {
        case 'STRIPE':
            return format.billingStripe
        case 'PATREON':
            return format.billingPatreon
        case 'STEADY':
            return format.billingSteady
        case 'MANUAL':
            return format.billingManual
        default:
            return source
    }
}
