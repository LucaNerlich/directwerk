import type {Locale} from '@/lib/i18n/config'
import type {Dictionary} from '@/lib/i18n/dictionary'

/**
 * Locale and timezone are pinned so server-rendered HTML and client hydration
 * produce byte-identical strings (see `@directwerk/api/format/datetime`).
 */
const FORMATTERS: Record<Locale, Intl.DateTimeFormat> = {
    de: new Intl.DateTimeFormat('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Berlin',
    }),
    en: new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Berlin',
    }),
}

/** Localized publication date; the raw string when unparsable, a label for `null`. */
export function formatPublishedAt(
    value: string | null,
    lang: Locale,
    format: Dictionary['format'],
): string {
    if (value === null) {
        return format.unknownDate
    }
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return FORMATTERS[lang].format(date)
}
