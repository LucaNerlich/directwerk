import {defaultLocale, isLocale, locales, type Locale} from './locale'

/**
 * Shared i18n primitives for the Directwerk frontends.
 *
 * Studio, web and homepage each route on the same `de`/`en` locale set, so the
 * Accept-Language matcher and the path/locale helpers live here once. The apps keep
 * their own thin wrappers (which own app-specific policy such as external-URL
 * pass-through) but delegate the shared rules to this module.
 */

export interface LanguageRange {
    tag: string
    quality: number
}

/**
 * Parses an `Accept-Language` header into quality-ordered language ranges.
 * Ranges with `q <= 0` ("not acceptable") are dropped.
 */
export function parseAcceptLanguage(header: string | null | undefined): LanguageRange[] {
    if (header === null || header === undefined) {
        return []
    }
    const trimmed = header.trim()
    if (trimmed.length === 0) {
        return []
    }
    return trimmed
        .split(',')
        .map(parseLanguageRange)
        .filter((range): range is LanguageRange => range !== null)
        .sort((a, b) => b.quality - a.quality)
}

function parseLanguageRange(part: string): LanguageRange | null {
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

/**
 * Best supported locale for an `Accept-Language` header: exact tag, then primary
 * subtag, then `fallback`. A `*` range resolves to the fallback.
 */
export function matchAcceptLanguage<T extends string>(
    header: string | null | undefined,
    supported: readonly T[],
    fallback: T,
): T {
    const normalized = supported.map((locale) => locale.toLowerCase())
    for (const {tag} of parseAcceptLanguage(header)) {
        if (tag === '*') {
            return fallback
        }
        const exact = normalized.indexOf(tag)
        if (exact >= 0) {
            return supported[exact] as T
        }
        const primary = tag.split('-')[0] ?? tag
        const primaryIndex = normalized.indexOf(primary)
        if (primaryIndex >= 0) {
            return supported[primaryIndex] as T
        }
    }
    return fallback
}

/**
 * Locale preference shared by every app: an explicit cookie choice beats the
 * `Accept-Language` header, which beats the fallback (issue #545).
 */
export function resolveLocalePreference<T extends string>(
    cookieLocale: string | null | undefined,
    acceptLanguage: string | null | undefined,
    supported: readonly T[],
    fallback: T,
): T {
    if (cookieLocale !== null && cookieLocale !== undefined && (supported as readonly string[]).includes(cookieLocale)) {
        return cookieLocale as T
    }
    return matchAcceptLanguage(acceptLanguage, supported, fallback)
}

/**
 * Writes the locale cookie with the attributes every app used to spell out
 * separately: path-wide, one year, SameSite=Lax.
 */
export function writeLocaleCookie(name: string, locale: string, maxAgeSeconds = 31_536_000): void {
    if (typeof document === 'undefined') {
        return
    }
    document.cookie = `${name}=${encodeURIComponent(locale)};path=/;max-age=${maxAgeSeconds};samesite=lax`
}

/** {@link matchAcceptLanguage} for the shared `de`/`en` locale set. */
export function matchLocale(header: string | null | undefined): Locale {
    return matchAcceptLanguage<Locale>(header, locales, defaultLocale)
}

/** Locale from the first path segment, or `null` when unprefixed/unsupported. */
export function localeFromPathname(pathname: string): Locale | null {
    const segment = pathname.split('/')[1]
    if (segment !== undefined && isLocale(segment)) {
        return segment
    }
    return null
}

/** Removes a leading `/de` or `/en` segment; other paths get a leading slash. */
export function stripLocalePrefix(pathname: string): string {
    const segments = pathname.split('/')
    if (segments.length >= 2 && isLocale(segments[1] ?? '')) {
        const rest = segments.slice(2).join('/')
        return rest.length === 0 ? '/' : `/${rest}`
    }
    return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** Splits a path into its pathname and any trailing `?query`/`#hash` suffix. */
export function splitPathSuffix(path: string): {pathname: string; suffix: string} {
    const hashIndex = path.indexOf('#')
    const queryIndex = path.indexOf('?')
    if (hashIndex >= 0 && (queryIndex < 0 || hashIndex < queryIndex)) {
        return {pathname: path.slice(0, hashIndex), suffix: path.slice(hashIndex)}
    }
    if (queryIndex >= 0) {
        return {pathname: path.slice(0, queryIndex), suffix: path.slice(queryIndex)}
    }
    return {pathname: path, suffix: ''}
}
