export interface SlugEntry {
    id: number
    slug: string
}

/** Drop bodies/descriptions — slug checks only need id + slug. */
export function toSlugEntries(
    items: ReadonlyArray<{id: number; slug: string}>,
): SlugEntry[] {
    return items.map((item) => ({id: item.id, slug: item.slug}))
}

export function isSlugTaken(
    entries: SlugEntry[],
    slug: string,
    excludeId?: number,
): boolean {
    const normalized = slug.trim().toLowerCase()
    if (normalized.length === 0) {
        return false
    }
    return entries.some(
        (entry) =>
            entry.id !== excludeId && entry.slug.trim().toLowerCase() === normalized,
    )
}
