import type {AssetType, MediaUploadLimits} from '@directwerk/api/types'

import {formatBytes} from '@/lib/media/format'

interface MediaTypeLimit {
    maxBytes: number
    label: string
}

export type ResolvedMediaLimits = Record<AssetType, MediaTypeLimit>

/**
 * Platform-default per-type upload size limits. These mirror the Directwerk API
 * defaults (MediaUploadRules) and stay as the fallback until the tenant's
 * effective limits arrive from GET /api/v1/media/limits. Note the backend
 * default for video is 5 GB, not 1 GB — the label below matches the server.
 */
export const MEDIA_TYPE_LIMITS: Record<AssetType, MediaTypeLimit> = {
    AUDIO: {maxBytes: 5 * 1024 * 1024 * 1024, label: '5 GB'},
    IMAGE: {maxBytes: 10 * 1024 * 1024, label: '10 MB'},
    VIDEO: {maxBytes: 5 * 1024 * 1024 * 1024, label: '5 GB'},
    DOCUMENT: {maxBytes: 50 * 1024 * 1024, label: '50 MB'},
}

/** Renders a byte limit in the same style as the default labels. */
export function formatLimitLabel(bytes: number): string {
    if (bytes >= 1024 ** 3 && bytes % 1024 ** 3 === 0) {
        return `${bytes / 1024 ** 3} GB`
    }
    if (bytes >= 1024 ** 2 && bytes % 1024 ** 2 === 0) {
        return `${bytes / 1024 ** 2} MB`
    }
    return formatBytes(bytes)
}

/**
 * Resolves the tenant's effective limits (per-tenant overrides from the API)
 * into the same shape as the platform defaults.
 */
export function resolveMediaLimits(
    effective: MediaUploadLimits | null,
): ResolvedMediaLimits {
    if (effective === null) {
        return MEDIA_TYPE_LIMITS
    }
    return {
        AUDIO: {maxBytes: effective.maxAudioBytes, label: formatLimitLabel(effective.maxAudioBytes)},
        IMAGE: {maxBytes: effective.maxImageBytes, label: formatLimitLabel(effective.maxImageBytes)},
        VIDEO: {maxBytes: effective.maxVideoBytes, label: formatLimitLabel(effective.maxVideoBytes)},
        DOCUMENT: {
            maxBytes: effective.maxDocumentBytes,
            label: formatLimitLabel(effective.maxDocumentBytes),
        },
    }
}

export function mediaLimitLabel(assetType: AssetType): string {
    return MEDIA_TYPE_LIMITS[assetType].label
}

export function mediaLimitLabelFor(
    limits: ResolvedMediaLimits,
    assetType: AssetType,
): string {
    return limits[assetType].label
}

export function exceedsMediaLimit(assetType: AssetType, sizeBytes: number): boolean {
    return sizeBytes > MEDIA_TYPE_LIMITS[assetType].maxBytes
}

export function exceedsMediaLimitFor(
    limits: ResolvedMediaLimits,
    assetType: AssetType,
    sizeBytes: number,
): boolean {
    return sizeBytes > limits[assetType].maxBytes
}
