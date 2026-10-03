import {isLocale, type Locale, locales} from './config'

/**
 * Logical (unprefixed) path → `/{lang}{path}`.
 * Preserves query/hash. Absolute http(s) URLs and already-prefixed paths pass through.
 */
export function localizedPath(lang: Locale, path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
        return path
    }

    const hashIndex = path.indexOf('#')
    const queryIndex = path.indexOf('?')
    let pathname = path
    let suffix = ''

    if (hashIndex >= 0 && (queryIndex < 0 || hashIndex < queryIndex)) {
        pathname = path.slice(0, hashIndex)
        suffix = path.slice(hashIndex)
    } else if (queryIndex >= 0) {
        pathname = path.slice(0, queryIndex)
        suffix = path.slice(queryIndex)
    }

    if (pathname === '') {
        pathname = '/'
    }
    if (!pathname.startsWith('/')) {
        pathname = `/${pathname}`
    }

    const stripped = stripLangPrefix(pathname)
    if (stripped === '/') {
        return `/${lang}${suffix}`
    }
    return `/${lang}${stripped}${suffix}`
}

/** Removes a leading `/de` or `/en` segment when present. */
export function stripLangPrefix(pathname: string): string {
    for (const locale of locales) {
        if (pathname === `/${locale}`) {
            return '/'
        }
        const prefix = `/${locale}/`
        if (pathname.startsWith(prefix)) {
            return pathname.slice(prefix.length - 1)
        }
    }
    return pathname
}

/** Reads the locale segment from a pathname, if any. */
export function localeFromPathname(pathname: string): Locale | null {
    const segment = pathname.split('/').filter(Boolean)[0]
    if (segment !== undefined && isLocale(segment)) {
        return segment
    }
    return null
}

/** Swaps `/de/...` ↔ `/en/...` keeping the rest of the path (and query/hash). */
export function swapLangInPath(path: string, nextLang: Locale): string {
    const hashIndex = path.indexOf('#')
    const queryIndex = path.indexOf('?')
    let pathname = path
    let suffix = ''

    if (hashIndex >= 0 && (queryIndex < 0 || hashIndex < queryIndex)) {
        pathname = path.slice(0, hashIndex)
        suffix = path.slice(hashIndex)
    } else if (queryIndex >= 0) {
        pathname = path.slice(0, queryIndex)
        suffix = path.slice(queryIndex)
    }

    const logical = stripLangPrefix(pathname === '' ? '/' : pathname)
    return `${localizedPath(nextLang, logical)}${suffix}`
}

export function pathHasLocalePrefix(pathname: string): boolean {
    return localeFromPathname(pathname) !== null
}
