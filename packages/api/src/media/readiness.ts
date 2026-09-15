import type {MediaAsset} from '../types'

/**
 * The one media-readiness rule: an asset can be shown/embedded publicly when it
 * finished processing, is public, and has a stable CDN URL. Mirrors the server
 * `MediaAssetViewMapper` eligibility so pickers stop re-deriving it.
 */
export function isPubliclyRenderable(asset: MediaAsset): boolean {
    return (
        asset.status === 'READY' &&
        asset.visibility === 'PUBLIC' &&
        typeof asset.cdnUrl === 'string' &&
        asset.cdnUrl.length > 0
    )
}

/** READY and public, without requiring a resolved CDN URL. */
export function isPubliclySelectable(asset: MediaAsset): boolean {
    return asset.status === 'READY' && asset.visibility === 'PUBLIC'
}

/** Finished processing, regardless of visibility. */
export function isReadyAsset(asset: MediaAsset): boolean {
    return asset.status === 'READY'
}
