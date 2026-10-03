import {defaultLocale, isLocale, type Locale, locales} from './config'

/**
 * Builds a locale-prefixed in-app path. `path` must be absolute (`/…`) or empty.
 * Query/hash on `path` are preserved.
 */
export function localizedPath(lang: Locale, path = '/'): string {
    const trimmed = path.trim()
    const raw = trimmed.length === 0 ? '/' : trimmed
    if (!raw.startsWith('/') || raw.startsWith('//')) {
        return `/${lang}`
    }

    const match = raw.match(/^([^?#]*)(.*)$/)
    const pathname = match?.[1] ?? raw
    const suffix = match?.[2] ?? ''
    const withoutLocale = stripLocalePrefix(pathname)
    if (withoutLocale === '/') {
        return `/${lang}${suffix}`
    }
    return `/${lang}${withoutLocale}${suffix}`
}

/** Strips a leading `/de` or `/en` segment when present. */
export function stripLocalePrefix(pathname: string): string {
    const segments = pathname.split('/')
    if (segments.length >= 2 && isLocale(segments[1] ?? '')) {
        const rest = segments.slice(2).join('/')
        return rest.length === 0 ? '/' : `/${rest}`
    }
    return pathname.startsWith('/') ? pathname : `/${pathname}`
}

/** Locale from the first path segment, or `null` when unprefixed/invalid. */
export function localeFromPathname(pathname: string): Locale | null {
    const segment = pathname.split('/')[1]
    if (segment !== undefined && isLocale(segment)) {
        return segment
    }
    return null
}

export function hasLocalePrefix(pathname: string): boolean {
    return localeFromPathname(pathname) !== null
}

/**
 * Swaps `/de/...` ↔ `/en/...` keeping the remainder of the path + query/hash.
 * Unprefixed paths are prefixed with the target locale.
 */
export function swapLocalePath(pathnameWithSearch: string, nextLang: Locale): string {
    const match = pathnameWithSearch.match(/^([^?#]*)(.*)$/)
    const pathname = match?.[1] ?? pathnameWithSearch
    const suffix = match?.[2] ?? ''
    return `${localizedPath(nextLang, stripLocalePrefix(pathname))}${suffix}`
}

export function resolveLocaleParam(lang: string | undefined): Locale {
    if (lang !== undefined && isLocale(lang)) {
        return lang
    }
    return defaultLocale
}

export {locales, defaultLocale}
