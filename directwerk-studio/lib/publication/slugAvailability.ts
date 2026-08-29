export interface SlugEntry {
    id: number
    slug: string
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
