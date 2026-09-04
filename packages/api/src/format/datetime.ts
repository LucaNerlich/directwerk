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
