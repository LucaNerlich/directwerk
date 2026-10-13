import {matchLocale} from '@directwerk/ui/lib/i18n'

import type {Locale} from './config'

/**
 * Accept-Language negotiation — delegates to the shared matcher in
 * `@directwerk/ui/lib/i18n` so web, studio and homepage cannot drift.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
    return matchLocale(acceptLanguage)
}
