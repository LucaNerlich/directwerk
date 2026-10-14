import {stripLocalePrefix as sharedStripLocalePrefix} from '@directwerk/ui/lib/i18n'

import {type Locale} from './config'

/** Prefix a site-relative path with the active locale (`/developers` → `/de/developers`). */
export function hrefFor(lang: Locale, path: string = '/'): string {
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('mailto:')) {
        return path
    }

    const hashIndex = path.indexOf('#')
    const hash = hashIndex >= 0 ? path.slice(hashIndex) : ''
    const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path

    if (withoutHash === '' || withoutHash === '/') {
        // Keep a slash before hash anchors on the locale home (`/de/#contact`).
        return hash.length > 0 ? `/${lang}/${hash}` : `/${lang}`
    }

    const normalized = withoutHash.startsWith('/') ? withoutHash : `/${withoutHash}`
    return `/${lang}${normalized}${hash}`
}

/** Strip a leading `/de` or `/en` segment from a pathname. */
export const stripLangPrefix = sharedStripLocalePrefix

/** Swap `/de/...` ↔ `/en/...` while keeping the remainder of the path. */
export function swapLangPath(pathname: string, nextLang: Locale): string {
    const rest = sharedStripLocalePrefix(pathname)
    return hrefFor(nextLang, rest === '/' ? '/' : rest)
}

/**
 * Issue #445: the hreflang map was hand-written in five generateMetadata functions. One helper
 * keeps a new locale (or an x-default change) to a single edit.
 */
export function localeAlternates(path: string = '/'): Record<string, string> {
    return {
        de: hrefFor('de', path),
        en: hrefFor('en', path),
        'x-default': hrefFor('de', path),
    }
}
