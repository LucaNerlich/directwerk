import type {NextRequest} from 'next/server'

import {resolveLocalePreference} from '@directwerk/ui/lib/i18n'

import {defaultLocale, LOCALE_COOKIE, locales, type Locale} from './config'

/** Cookie → Accept-Language → default `de`, from the shared policy (issue #545). */
export function resolveRequestLocale(request: NextRequest): Locale {
    return resolveLocalePreference(
        request.cookies.get(LOCALE_COOKIE)?.value,
        request.headers.get('accept-language'),
        locales,
        defaultLocale,
    )
}
