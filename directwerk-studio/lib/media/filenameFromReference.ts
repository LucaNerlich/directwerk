import {suggestSlug} from '@/lib/api/studioHelpers'

/**
 * Returns the file extension including the leading dot (e.g. `.mp3`),
 * or an empty string when the name has no usable extension.
 */
export function extensionOfFilename(filename: string | null | undefined): string {
    if (filename === null || filename === undefined) {
        return ''
    }
    const base = filename.replaceAll('\\', '/').split('/').pop() ?? filename
    const dot = base.lastIndexOf('.')
    if (dot <= 0 || dot === base.length - 1) {
        return ''
    }
    return base.slice(dot)
}

/**
 * Client mirror of backend {@code MediaUploadRules.sanitizeFilename} character
 * replacement (`[^a-zA-Z0-9._-]+` → `_`). Used only to decide whether a
 * rename-from-reference would change the stored name; the API remains authoritative.
 */
export function sanitizeFilenameMirror(filename: string): string {
    const trimmed = filename.trim()
    const base = trimmed.replaceAll('\\', '/').split('/').pop() ?? trimmed
    return base.replace(/[^a-zA-Z0-9._-]+/g, '_')
}

/**
 * Builds a URL-safe display filename from a content reference title while keeping
 * the current asset's extension. Slugifies the title via {@link suggestSlug}
 * (ASCII kebab-case) before appending the extension. The backend still sanitizes
 * authoritatively on rename.
 *
 * Caps the stem so the full name stays under the backend's 180-character limit.
 */
export function filenameFromReferenceTitle(
    currentFilename: string | null | undefined,
    title: string,
): string {
    const slug = suggestSlug(title)
    const stem = slug.length > 0 ? slug : 'asset'
    const ext = extensionOfFilename(currentFilename)
    const maxStem = Math.max(1, 180 - ext.length)
    const capped = stem.length > maxStem ? stem.slice(0, maxStem).replace(/-+$/, '') : stem
    const safeStem = capped.length > 0 ? capped : 'asset'
    return `${safeStem}${ext}`
}

/**
 * Proposed rename-from-reference filename, or {@code null} when the action should
 * not be offered: no references, or the URL-safe proposal already matches the
 * stored {@code originalFilename} (after the same sanitize mirror the API uses).
 *
 * Not limited to generic names like {@code download.mp3} — any differing name qualifies.
 */
export function proposedRenameFromReference(
    currentFilename: string | null | undefined,
    references: ReadonlyArray<{id: number; title: string}>,
): string | null {
    if (references.length === 0) {
        return null
    }
    const first = references[0]!
    const derived = filenameFromReferenceTitle(
        currentFilename,
        first.title || `ref-${first.id}`,
    )
    if (sanitizeFilenameMirror(derived) === (currentFilename ?? '').trim()) {
        return null
    }
    return derived
}
