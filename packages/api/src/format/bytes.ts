/**
 * Formats a byte count as a human-readable size.
 *
 * @param bytes - The byte count to format
 * @returns A formatted size string, or `null` for `null` or negative values
 */
export function formatBytes(bytes: number | null): string | null {
    if (bytes === null || bytes < 0) {
        return null
    }
    if (bytes < 1024) {
        return `${bytes} B`
    }
    if (bytes < 1024 * 1024) {
        return `${Math.max(1, Math.round(bytes / 1024))} KB`
    }
    const mb = bytes / (1024 * 1024)
    return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`
}
