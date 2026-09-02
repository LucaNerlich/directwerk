function hasFileExtension(segment: string): boolean {
    const dot = segment.lastIndexOf('.')
    if (dot < 0) {
        return false
    }
    const suffix = segment.slice(dot + 1)
    return suffix.length > 0 && /[^.]/.test(suffix)
}

export function filenameFromImportUrl(url: string, fallback: string): string {
    const trimmed = url.trim()
    if (trimmed.length === 0) {
        return fallback
    }
    try {
        const parsed = new URL(trimmed)
        const slash = parsed.pathname.lastIndexOf('/')
        const last = slash >= 0 ? parsed.pathname.slice(slash + 1) : parsed.pathname
        return hasFileExtension(last) ? last : fallback
    } catch {
        const slash = trimmed.lastIndexOf('/')
        let last = slash >= 0 ? trimmed.slice(slash + 1) : trimmed
        const query = last.indexOf('?')
        if (query >= 0) {
            last = last.slice(0, query)
        }
        return hasFileExtension(last) ? last : fallback
    }
}
