/**
 * Formats a byte count using bytes, kilobytes, or megabytes.
 *
 * @param sizeBytes - The byte count, or `null` when unavailable
 * @returns A formatted size string, or `—` for null or nonpositive values
 */
export function formatBytes(sizeBytes: number | null): string {
    if (sizeBytes === null || sizeBytes <= 0) {
        return '—'
    }
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
