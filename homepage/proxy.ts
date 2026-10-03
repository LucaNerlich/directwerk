import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

import {defaultLocale, isLocale, localeCookieName, locales} from '@/lib/i18n/config'
import {matchAcceptLanguage} from '@/lib/i18n/match-locale'

function resolveLocale(request: NextRequest): string {
    const cookie = request.cookies.get(localeCookieName)?.value
    if (cookie && isLocale(cookie)) {
        return cookie
    }
    return matchAcceptLanguage(
        request.headers.get('accept-language'),
        locales,
        defaultLocale,
    )
}

export function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl
    const pathnameHasLocale = locales.some(
        (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
    )

    if (pathnameHasLocale) {
        return NextResponse.next()
    }

    const locale = resolveLocale(request)
    const url = request.nextUrl.clone()
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    return NextResponse.redirect(url)
}

export const config = {
    matcher: [
        // Skip API, Next internals, and files with an extension (favicon, assets).
        '/((?!api|_next/static|_next/image|.*\\..*).*)',
    ],
}
