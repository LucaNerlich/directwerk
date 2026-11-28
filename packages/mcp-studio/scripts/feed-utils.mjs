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
