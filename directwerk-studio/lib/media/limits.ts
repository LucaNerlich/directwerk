export type MediaAssetType = 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'

interface MediaTypeLimit {
    maxBytes: number
    label: string
}

/**
 * Per-type upload size limits. Mirrors the authoritative allow-list enforced by
 * the Directwerk API (MediaUploadRules), so the studio UI can warn users before
 * the backend rejects an upload.
 */
export const MEDIA_TYPE_LIMITS: Record<MediaAssetType, MediaTypeLimit> = {
    AUDIO: {maxBytes: 500 * 1024 * 1024, label: '500 MB'},
    IMAGE: {maxBytes: 10 * 1024 * 1024, label: '10 MB'},
    VIDEO: {maxBytes: 1024 * 1024 * 1024, label: '1 GB'},
    DOCUMENT: {maxBytes: 50 * 1024 * 1024, label: '50 MB'},
}

export function mediaLimitLabel(assetType: MediaAssetType): string {
    return MEDIA_TYPE_LIMITS[assetType].label
}

export function exceedsMediaLimit(assetType: MediaAssetType, sizeBytes: number): boolean {
    return sizeBytes > MEDIA_TYPE_LIMITS[assetType].maxBytes
}
