function hasFileExtension(segment: string): boolean {
    const dot = segment.lastIndexOf('.')
    if (dot < 0) {
        return false
    }
    const suffix = segment.slice(dot + 1)
    return suffix.length > 0 && /[^.]/.test(suffix)
}

/**
 * Filename stems that carry no identifying information. Hosts often serve
 * enclosures from generic routes (e.g. `.../download.mp3`); importing those
 * verbatim fills the media library with indistinguishable names.
 */
const GENERIC_FILENAME_STEMS = new Set([
    'download',
    'downloads',
    'file',
    'audio',
    'video',
    'image',
    'media',
    'track',
    'episode',
    'podcast',
    'attachment',
    'cover',
])

export function isGenericFilenameStem(stem: string): boolean {
    return GENERIC_FILENAME_STEMS.has(stem.trim().toLowerCase())
}

function filenameOrFallback(segment: string, fallback: string): string {
    if (!hasFileExtension(segment)) {
        return fallback
    }
    const stem = segment.slice(0, segment.lastIndexOf('.'))
    return isGenericFilenameStem(stem) ? fallback : segment
}

/**
 * Derives an import filename from a remote URL.
 *
 * @param preferredStem - when provided (e.g. the episode-title slug), it always
 * wins and only the URL's real extension is kept; otherwise a meaningful URL
 * stem is kept and generic/extensionless segments fall back.
 */
export function filenameFromImportUrl(url: string, fallback: string, preferredStem?: string): string {
    const stem = preferredStem === undefined ? '' : preferredStem.trim()
    const fallbackExtension = (() => {
        const dot = fallback.lastIndexOf('.')
        return dot > 0 && dot < fallback.length - 1 ? fallback.slice(dot + 1) : 'bin'
    })()
    const withStem = (segment: string): string => {
        if (!hasFileExtension(segment)) {
            return stem.length > 0 ? `${stem}.${fallbackExtension}` : fallback
        }
        if (stem.length > 0) {
            return `${stem}${segment.slice(segment.lastIndexOf('.'))}`
        }
        return filenameOrFallback(segment, fallback)
    }
    const trimmed = url.trim()
    if (trimmed.length === 0) {
        return stem.length > 0 ? `${stem}.${fallbackExtension}` : fallback
    }
    try {
        const parsed = new URL(trimmed)
        const slash = parsed.pathname.lastIndexOf('/')
        const last = slash >= 0 ? parsed.pathname.slice(slash + 1) : parsed.pathname
        return withStem(last)
    } catch {
        const slash = trimmed.lastIndexOf('/')
        let last = slash >= 0 ? trimmed.slice(slash + 1) : trimmed
        const suffix = last.search(/[?#]/)
        if (suffix >= 0) {
            last = last.slice(0, suffix)
        }
        return withStem(last)
    }
}
