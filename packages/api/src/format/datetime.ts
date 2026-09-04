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
