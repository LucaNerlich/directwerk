import {defaultLocale, isLocale, type Locale, locales} from './config'

interface LanguageRange {
    tag: string
    quality: number
}

/**
 * Hand-rolled Accept-Language negotiation (no Negotiator / formatjs deps).
 * Prefers an exact or primary-subtag match among `de` | `en`, else `de`.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
    if (acceptLanguage === null || acceptLanguage === undefined) {
        return defaultLocale
    }
    const trimmed = acceptLanguage.trim()
    if (trimmed.length === 0) {
        return defaultLocale
    }

    const ranges = trimmed
        .split(',')
        .map((part) => parseRange(part.trim()))
        .filter((range): range is LanguageRange => range !== null)
        .sort((a, b) => b.quality - a.quality)

    for (const range of ranges) {
        if (range.tag === '*') {
            return defaultLocale
        }
        if (isLocale(range.tag)) {
            return range.tag
        }
        const primary = range.tag.split('-')[0]
        if (primary !== undefined && isLocale(primary)) {
            return primary
        }
    }

    return defaultLocale
}

function parseRange(part: string): LanguageRange | null {
    if (part.length === 0) {
        return null
    }
    const [tagPart, ...params] = part.split(';')
    const tag = tagPart?.trim().toLowerCase()
    if (tag === undefined || tag.length === 0) {
        return null
    }
    let quality = 1
    for (const param of params) {
        const [key, value] = param.split('=').map((item) => item.trim())
        if (key === 'q' && value !== undefined) {
            const parsed = Number.parseFloat(value)
            if (!Number.isNaN(parsed)) {
                quality = parsed
            }
        }
    }
    if (quality <= 0) {
        return null
    }
    return {tag, quality}
}

export function supportedLocales(): readonly Locale[] {
    return locales
}
