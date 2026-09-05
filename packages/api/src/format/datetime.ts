/**
 * Formats a publication date for display.
 *
 * @param value - The date string to format, or `null` when no date is available
 * @returns The localized date and time, `"Unbekanntes Datum"` for `null`, or the original string when it is invalid
 */
export function formatPublishedAt(value: string | null): string {
    if (value === null) {
        return 'Unbekanntes Datum'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}

/**
 * Formats a timestamp for display.
 *
 * @param value - The timestamp value to format
 * @returns A localized date/time string, the original value when parsing fails, or `—` when no value is provided
 */
export function formatTimestamp(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return '—'
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString()
}
