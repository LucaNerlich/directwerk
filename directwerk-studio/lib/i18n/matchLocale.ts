import {defaultLocale, isLocale, type Locale, locales} from './config'

/**
 * Hand-rolled Accept-Language matcher (no Negotiator / formatjs deps).
 * Picks the first supported tag by q-order; falls back to {@link defaultLocale}.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
    if (acceptLanguage === null || acceptLanguage === undefined || acceptLanguage.trim() === '') {
        return defaultLocale
    }

    const tags = acceptLanguage
        .split(',')
        .map((part) => {
            const [tagRaw, ...params] = part.trim().split(';')
            const tag = tagRaw.trim().toLowerCase()
            let q = 1
            for (const param of params) {
                const [key, value] = param.trim().split('=')
                if (key === 'q' && value !== undefined) {
                    const parsed = Number.parseFloat(value)
                    if (!Number.isNaN(parsed)) {
                        q = parsed
                    }
                }
            }
            return {tag, q}
        })
        .filter((entry) => entry.tag.length > 0)
        .sort((a, b) => b.q - a.q)

    for (const {tag} of tags) {
        if (tag === '*') {
            return defaultLocale
        }
        if (isLocale(tag)) {
            return tag
        }
        const base = tag.split('-')[0]
        if (isLocale(base)) {
            return base
        }
    }

    return defaultLocale
}

export function preferredLocale(
    acceptLanguage: string | null | undefined,
    cookieLocale: string | null | undefined,
): Locale {
    if (cookieLocale !== null && cookieLocale !== undefined && isLocale(cookieLocale)) {
        return cookieLocale
    }
    return matchLocale(acceptLanguage)
}

/** Exported for tests — supported locale list stays in sync with config. */
export const supportedLocales: readonly Locale[] = locales
