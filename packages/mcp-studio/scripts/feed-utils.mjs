/**
 * Pure helpers for the hosted-archive feed sync, kept in their own module so
 * the CLI can be tested without its environment and network dependencies.
 */

/** PAID shows keep their audio private; the publish workflow promotes only FREE audio. */
export function audioVisibility(show) {
    return (show.accessPolicy ?? 'PAID') === 'PAID' ? 'PRIVATE' : 'PUBLIC'
}

/** First ten characters of an ISO timestamp; '' for a missing value. */
export function day(value) {
    return typeof value === 'string' ? value.slice(0, 10) : ''
}

/** The date an existing episode was stored under: published first, then scheduled. */
export function storedDay(episode) {
    return day(episode?.publishedAt ?? episode?.scheduledAt ?? null)
}

/**
 * Parses an RSS pubDate. Returns an ISO string, or null when the value is
 * missing or unparseable so the caller can skip that item.
 */
export function parseFeedDate(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return null
    }
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** ASCII slug used for episode URLs (mirrors the server's rule). */
export function slugify(text) {
    const ascii = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    let slug = ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (slug.length > 56) {
        slug = slug.slice(0, 56).replace(/-[^-]*$/, '') || slug.slice(0, 56)
    }
    return slug || 'episode'
}

/**
 * Reserves a slug that is unique in the shared tenant-wide set. The same set must be
 * used for every show in a run: slugs are unique per tenant, not per series.
 */
export function allocateSlug(usedSlugs, title) {
    let slug = slugify(title)
    let suffix = 2
    while (usedSlugs.has(slug)) {
        slug = `${slugify(title).slice(0, 58)}-${suffix++}`
    }
    usedSlugs.add(slug)
    return slug
}
