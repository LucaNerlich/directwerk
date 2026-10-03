import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

import {createDirectwerkProxyHandler} from '@directwerk/api/proxy/directwerkProxy'

import {createDirectwerkContentSecurityPolicy} from '../packages/next-config/createDirectwerkNextConfig'
import {locales} from './lib/i18n/config'
import {resolveRequestLocale} from './lib/i18n/resolveRequestLocale'

const handleDirectwerkProxy = createDirectwerkProxyHandler({
    buildContentSecurityPolicy: createDirectwerkContentSecurityPolicy,
})

function pathnameHasLocale(pathname: string): boolean {
    return locales.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
    )
}

/**
 * Locale gate + CSP nonce. Unprefixed UI paths redirect to `/de|en/...`.
 * `/api/**` is excluded by the matcher; `/feeds/<tenant>/…` (RSS proxy) is also
 * excluded so podcast clients keep stable unprefixed feed URLs. Exact `/feeds`
 * (UI) still matches and redirects to the locale-prefixed feeds page.
 */
export function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl

    if (pathnameHasLocale(pathname)) {
        return handleDirectwerkProxy(request)
    }

    const locale = resolveRequestLocale(request)
    const url = request.nextUrl.clone()
    url.pathname =
        pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    return NextResponse.redirect(url)
}

// Inline literal: Next.js must statically parse `config` at build time, so it
// cannot be imported from `@directwerk/api`. Keep in sync with
// `directwerkWebProxyMatcher` assertions in `proxy.test.ts`.
// Skips `api` and nested `feeds/` (RSS/enclosure protocol), not exact `/feeds`.
export const config = {
    matcher: [
        {
            source: '/((?!api|feeds/|_next/static|_next/image|favicon.ico).*)',
            missing: [
                {type: 'header', key: 'next-router-prefetch'},
                {type: 'header', key: 'purpose', value: 'prefetch'},
            ],
        },
    ],
}
