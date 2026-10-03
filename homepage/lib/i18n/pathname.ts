import {defaultLocale, isLocale, type Locale} from './config'

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
export function stripLangPrefix(pathname: string): string {
    const segments = pathname.split('/')
    if (segments.length >= 2 && isLocale(segments[1]!)) {
        const rest = `/${segments.slice(2).join('/')}`.replace(/\/$/, '') || '/'
        return rest === '/' ? '/' : rest.replace(/\/+/g, '/')
    }
    return pathname || '/'
}

/** Swap `/de/...` ↔ `/en/...` while keeping the remainder of the path. */
export function swapLangPath(pathname: string, nextLang: Locale): string {
    const rest = stripLangPrefix(pathname)
    return hrefFor(nextLang, rest === '/' ? '/' : rest)
}

export function langFromPathname(pathname: string): Locale {
    const segment = pathname.split('/')[1]
    return segment && isLocale(segment) ? segment : defaultLocale
}
