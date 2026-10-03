import type {PublicProduct} from '@directwerk/api/types'

import type {Locale} from '@/lib/i18n/config'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Picks the membership product a locked row / detail gate should link to.
 * Only a `requiredLevelSortOrder` rank travels with catalog items (no product
 * id), so this prefers the entry-level `LEVEL` product by `sortOrder` and
 * falls back to the first product. The link always lands on `/pricing`, which
 * lists every tier — the slug fragment only preselects context.
 */
export function findUnlockProduct(
    products: PublicProduct[],
): PublicProduct | null {
    if (products.length === 0) {
        return null
    }
    const levels = products
        .filter((product) => product.offeringType === 'LEVEL')
        .sort((a, b) => a.sortOrder - b.sortOrder)
    return levels[0] ?? products[0] ?? null
}

/**
 * Unlock target for paid content: `/<lang>/pricing#<slug>` when a product is known,
 * plain `/pricing` otherwise.
 */
export function unlockHref(product: PublicProduct | null, lang: Locale): string {
    return localizedPath(
        lang,
        product === null ? '/pricing' : `/pricing#${product.slug}`,
    )
}
