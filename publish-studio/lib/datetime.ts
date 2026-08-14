function pad(value: number): string {
    return String(value).padStart(2, '0')
}

/** Convert Instant ISO string to datetime-local value (local timezone). */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
    if (iso === null || iso === undefined || iso.length === 0) {
        return ''
    }

    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
        return ''
    }

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Convert datetime-local value to ISO Instant string. */
export function fromDatetimeLocalValue(value: string): string | null {
    if (value.trim().length === 0) {
        return null
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date.toISOString()
}
