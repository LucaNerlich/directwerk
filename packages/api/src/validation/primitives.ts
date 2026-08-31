import type {ApiEnvelope} from '../types'

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isBoundedString(value: unknown, maxLength = 255): value is string {
    return typeof value === 'string' && value.length <= maxLength
}

export function isNullableString(
    value: unknown,
    maxLength = 2048,
): value is string | null {
    return value === null || isBoundedString(value, maxLength)
}

export function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length <= 100 &&
        value.every((item) => isBoundedString(item))
    )
}

export function isValidEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

export function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value)
}

export function isNonNegativeSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isNullableSafeInteger(value: unknown): value is number | null {
    return value === null || isSafeInteger(value)
}

export function isNullableNonNegativeSafeInteger(
    value: unknown,
): value is number | null {
    return value === null || (isSafeInteger(value) && value >= 0)
}

export function isValidHttpStatus(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 100 &&
        value <= 599
    )
}

/** Parses an array with a hard length cap; null when any element fails. */
export function parseBoundedArray<T>(
    data: unknown,
    maxLength: number,
    parseItem: (item: unknown) => T | null,
): T[] | null {
    if (!Array.isArray(data) || data.length > maxLength) {
        return null
    }

    const parsed: T[] = []
    for (const item of data) {
        const value = parseItem(item)
        if (value === null) {
            return null
        }
        parsed.push(value)
    }

    return parsed
}

/**
 * Validates `{statusCode, statusMessage, data}` envelopes and rebuilds them
 * with empty `errors`/`metadata`, exactly like every app-side tower did.
 */
export function parseEnvelope<T>(
    value: unknown,
    parseData: (data: unknown) => T | null,
): ApiEnvelope<T> | null {
    if (!isRecord(value) || !isValidHttpStatus(value.statusCode)) {
        return null
    }

    const data = parseData(value.data)
    if (data === null) {
        return null
    }

    return {
        statusCode: value.statusCode,
        statusMessage: isBoundedString(value.statusMessage) ? value.statusMessage : '',
        data,
        errors: [],
        metadata: {},
    }
}

/** True when a URL is safe to accept from the API (https, or http on loopback). */
export function isAllowedFeedUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        if (parsed.protocol === 'https:') {
            return true
        }
        if (parsed.protocol === 'http:') {
            const hostname = parsed.hostname.trim().toLowerCase()
            const loopback =
                hostname === 'localhost' ||
                hostname === '127.0.0.1' ||
                hostname === '[::1]' ||
                hostname.endsWith('.localhost')
            return loopback
        }
        return false
    } catch {
        return false
    }
}
