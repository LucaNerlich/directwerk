import type {PublicProduct} from '@directwerk/api/types'

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
 * Unlock target for paid content: `/pricing#<slug>` when a product is known,
 * plain `/pricing` otherwise.
 */
export function unlockHref(product: PublicProduct | null): string {
    return product === null ? '/pricing' : `/pricing#${product.slug}`
}
