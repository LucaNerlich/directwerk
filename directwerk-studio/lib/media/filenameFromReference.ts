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
 * Builds a display filename from a content reference title while keeping the
 * current asset's extension. The backend sanitizes authoritatively on rename.
 *
 * Caps the stem so the full name stays under the backend's 180-character limit.
 */
export function filenameFromReferenceTitle(
    currentFilename: string | null | undefined,
    title: string,
): string {
    const trimmed = title.trim()
    const stem = trimmed.length > 0 ? trimmed : 'asset'
    const ext = extensionOfFilename(currentFilename)
    const maxStem = Math.max(1, 180 - ext.length)
    const capped = stem.length > maxStem ? stem.slice(0, maxStem) : stem
    return `${capped}${ext}`
}
