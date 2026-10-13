import {matchAcceptLanguage as matchSharedAcceptLanguage} from '@directwerk/ui/lib/i18n'

/**
 * Accept-Language matcher — delegates to the shared implementation in
 * `@directwerk/ui/lib/i18n` so homepage, studio and web cannot drift.
 */
export function matchAcceptLanguage(
    header: string | null | undefined,
    locales: readonly string[],
    defaultLocale: string,
): string {
    return matchSharedAcceptLanguage(header, locales, defaultLocale)
}
