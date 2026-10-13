/**
 * Shared UI locale contract for the Directwerk frontends.
 *
 * The German/English locale set, default locale, preference cookie and guard
 * must agree across apps: studio and web share the same `NEXT_LOCALE` cookie,
 * so they cannot diverge per app.
 */

export const locales = ['de', 'en'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'de'

/** Cookie carrying the visitor's locale preference. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: string): value is Locale {
    return (locales as readonly string[]).includes(value)
}
