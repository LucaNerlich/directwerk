import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

import {resolveLocalePreference} from '@directwerk/ui/lib/i18n'

import {defaultLocale, localeCookieName, locales} from '@/lib/i18n/config'

function resolveLocale(request: NextRequest): string {
    return resolveLocalePreference(
        request.cookies.get(localeCookieName)?.value,
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
    const response = NextResponse.redirect(url)
    // Issue #441: the target depends on Accept-Language and the NEXT_LOCALE cookie; without Vary a
    // shared/CDN cache can pin one locale's redirect for every visitor.
    response.headers.set('Vary', 'Accept-Language, Cookie')
    return response
}

export const config = {
    matcher: [
        // Skip API, Next internals, and files with an extension (favicon, assets).
        '/((?!api|_next/static|_next/image|.*\\..*).*)',
    ],
}
