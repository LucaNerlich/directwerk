import type {NextRequest} from 'next/server'

import {defaultLocale, isLocale, LOCALE_COOKIE, type Locale} from './config'
import {negotiateLocale} from './negotiate'

/** Cookie → Accept-Language → default `de`. */
export function resolveRequestLocale(request: NextRequest): Locale {
    const cookieValue = request.cookies.get(LOCALE_COOKIE)?.value
    if (cookieValue !== undefined && isLocale(cookieValue)) {
        return cookieValue
    }
    return negotiateLocale(request.headers.get('accept-language')) ?? defaultLocale
}
