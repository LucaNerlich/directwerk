import type {Locale} from '@/lib/i18n/config'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Locale-prefixed login URL with a `returnTo` query (same pattern as pricing checkout).
 * `returnPath` should already be an in-app path (typically the current pathname).
 */
export function loginHref(lang: Locale, returnPath: string): string {
    return `${localizedPath(lang, '/login')}?returnTo=${encodeURIComponent(returnPath)}`
}
