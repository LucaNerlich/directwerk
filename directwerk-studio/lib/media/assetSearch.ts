import {fuzzyFilter} from '@directwerk/ui/lib/fuzzy'

import type {MediaAsset} from '@directwerk/api/types'

/** Display label used for list rows and filename search. */
export function assetLabel(asset: MediaAsset): string {
    return asset.originalFilename ?? `Asset ${asset.id}`
}

const ASSET_SEARCH_KEYS = [
    {name: 'label', getFn: (asset: MediaAsset) => assetLabel(asset)},
] as const

/**
 * Fuzzy-match media assets by {@link assetLabel} via shared Fuse helper.
 * Empty / whitespace query returns `assets` unchanged.
 */
export function filterAssetsByQuery(
    assets: readonly MediaAsset[],
    query: string,
): MediaAsset[] {
    return fuzzyFilter(assets, query, {keys: [...ASSET_SEARCH_KEYS]})
}

/** True when `query` is empty or fuzzy-matches {@link assetLabel}. */
export function matchesQuery(asset: MediaAsset, query: string): boolean {
    if (query.trim().length === 0) {
        return true
    }
    return filterAssetsByQuery([asset], query).length > 0
}
