import {
    localeFromPathname as sharedLocaleFromPathname,
    splitPathSuffix,
    stripLocalePrefix as sharedStripLocalePrefix,
} from '@directwerk/ui/lib/i18n'

import type {Locale} from './config'

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

    const {pathname, suffix} = splitPathSuffix(raw)
    const withoutLocale = sharedStripLocalePrefix(pathname)
    if (withoutLocale === '/') {
        return `/${lang}${suffix}`
    }
    return `/${lang}${withoutLocale}${suffix}`
}

/** Strips a leading `/de` or `/en` segment when present. */
export const stripLocalePrefix = sharedStripLocalePrefix

/** Locale from the first path segment, or `null` when unprefixed/invalid. */
export const localeFromPathname = sharedLocaleFromPathname

/**
 * Swaps `/de/...` ↔ `/en/...` keeping the remainder of the path + query/hash.
 * Unprefixed paths are prefixed with the target locale.
 */
export function swapLocalePath(pathnameWithSearch: string, nextLang: Locale): string {
    const {pathname, suffix} = splitPathSuffix(pathnameWithSearch)
    return `${localizedPath(nextLang, sharedStripLocalePrefix(pathname))}${suffix}`
}
