import {defaultLocale, isLocale, type Locale} from '@/lib/i18n/config'
import {localizedPath, stripLocalePrefix} from '@/lib/i18n/paths'

const ALLOWED_PREFIXES = [
    '/account',
    '/pricing',
    '/feeds',
    '/downloads',
    '/episodes',
    '/articles',
    '/checkout',
] as const

function localeFromReturnPath(path: string): Locale {
    const segment = path.split('/')[1]
    if (segment !== undefined && isLocale(segment)) {
        return segment
    }
    return defaultLocale
}

/**
 * Validates an in-app return path after login/register (open-redirect safe).
 * Accepts locale-prefixed paths (`/de/account`) and bare paths (`/account`).
 */
export function safeReturnTo(
    value: string | null,
    fallback = '/account',
    lang: Locale = defaultLocale,
): string {
    const fallbackLocalized = localizedPath(lang, stripLocalePrefix(fallback))

    if (value === null || value.trim().length === 0) {
        return fallbackLocalized
    }

    const trimmed = value.trim()
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return fallbackLocalized
    }
    if (trimmed.includes('://') || trimmed.includes('\\')) {
        return fallbackLocalized
    }

    const path = trimmed.split(/[?#]/)[0] ?? trimmed
    const barePath = stripLocalePrefix(path)
    const allowed = ALLOWED_PREFIXES.some(
        (prefix) => barePath === prefix || barePath.startsWith(`${prefix}/`),
    )

    if (!allowed) {
        return fallbackLocalized
    }

    const pathLocale = localeFromReturnPath(path)
    // Preserve an explicit locale on the returnTo value; otherwise use caller lang.
    const effectiveLang = isLocale(path.split('/')[1] ?? '') ? pathLocale : lang
    const suffix = trimmed.slice(path.length)
    return `${localizedPath(effectiveLang, barePath)}${suffix}`
}
