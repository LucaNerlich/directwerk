import {
    localeFromPathname as sharedLocaleFromPathname,
    splitPathSuffix,
    stripLocalePrefix as sharedStripLocalePrefix,
} from '@directwerk/ui/lib/i18n'

import type {Locale} from './config'

/**
 * Logical (unprefixed) path → `/{lang}{path}`.
 * Preserves query/hash. Absolute http(s) URLs and already-prefixed paths pass through.
 */
export function localizedPath(lang: Locale, path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
        return path
    }

    const {pathname: rawPathname, suffix} = splitPathSuffix(path)
    const pathname = rawPathname === '' ? '/' : rawPathname
    const stripped = sharedStripLocalePrefix(pathname)
    if (stripped === '/') {
        return `/${lang}${suffix}`
    }
    return `/${lang}${stripped}${suffix}`
}

/** Removes a leading `/de` or `/en` segment when present. */
export const stripLangPrefix = sharedStripLocalePrefix

/** Reads the locale segment from a pathname, if any. */
export const localeFromPathname = sharedLocaleFromPathname

/** Swaps `/de/...` ↔ `/en/...` keeping the rest of the path (and query/hash). */
export function swapLangInPath(path: string, nextLang: Locale): string {
    const {pathname, suffix} = splitPathSuffix(path)
    const logical = sharedStripLocalePrefix(pathname === '' ? '/' : pathname)
    return `${localizedPath(nextLang, logical)}${suffix}`
}

export function pathHasLocalePrefix(pathname: string): boolean {
    return sharedLocaleFromPathname(pathname) !== null
}
