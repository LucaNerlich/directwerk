import type {Locale} from '@/lib/i18n/config'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Unlock target for paid content. The pricing page lists every tier; there is no
 * preselection to deep-link to (#1092).
 */
export function unlockHref(lang: Locale): string {
    return localizedPath(lang, '/pricing')
}
