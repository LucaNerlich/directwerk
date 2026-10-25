import type {MediaAsset} from '@directwerk/api/types'

/** Display label used for list rows and filename search. */
export function assetLabel(asset: MediaAsset): string {
    return asset.originalFilename ?? `Asset ${asset.id}`
}

/**
 * Case-insensitive substring match on {@link assetLabel}.
 * Empty needle matches everything (same behavior as Mediathek pickers).
 */
export function matchesQuery(asset: MediaAsset, needle: string): boolean {
    if (needle.length === 0) {
        return true
    }
    return assetLabel(asset).toLowerCase().includes(needle)
}
