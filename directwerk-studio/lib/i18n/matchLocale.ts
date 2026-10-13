import {matchLocale as matchSharedLocale} from '@directwerk/ui/lib/i18n'

import {isLocale, type Locale} from './config'

/**
 * Accept-Language matcher — delegates to the shared implementation in
 * `@directwerk/ui/lib/i18n` so studio, web and homepage cannot drift.
 */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
    return matchSharedLocale(acceptLanguage)
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
