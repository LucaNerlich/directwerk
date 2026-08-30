/**
 * Derives a filename hint from a remote import URL, falling back when the path is empty.
 */
export function filenameFromImportUrl(url: string, fallback: string): string {
    const trimmed = url.trim()
    if (trimmed.length === 0) {
        return fallback
    }
    try {
        const parsed = new URL(trimmed)
        const slash = parsed.pathname.lastIndexOf('/')
        const last = slash >= 0 ? parsed.pathname.slice(slash + 1) : parsed.pathname
        return last.length > 0 ? last : fallback
    } catch {
        const slash = trimmed.lastIndexOf('/')
        let last = slash >= 0 ? trimmed.slice(slash + 1) : trimmed
        const query = last.indexOf('?')
        if (query >= 0) {
            last = last.slice(0, query)
        }
        return last.length > 0 ? last : fallback
    }
}
