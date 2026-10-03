import type {NextRequest} from 'next/server'
import {NextResponse} from 'next/server'

import {createDirectwerkProxyHandler} from '@directwerk/api/proxy/directwerkProxy'

import {createDirectwerkContentSecurityPolicy} from '../packages/next-config/createDirectwerkNextConfig'
import {LOCALE_COOKIE, locales} from './lib/i18n/config'
import {preferredLocale} from './lib/i18n/matchLocale'
import {pathHasLocalePrefix} from './lib/i18n/paths'

const handleDirectwerkProxy = createDirectwerkProxyHandler({
    buildContentSecurityPolicy: createDirectwerkContentSecurityPolicy,
})

function shouldSkipLocale(pathname: string): boolean {
    return (
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname === '/favicon.ico'
    )
}

export function proxy(request: NextRequest) {
    const {pathname} = request.nextUrl

    if (!shouldSkipLocale(pathname) && !pathHasLocalePrefix(pathname)) {
        const locale = preferredLocale(
            request.headers.get('accept-language'),
            request.cookies.get(LOCALE_COOKIE)?.value,
        )
        const url = request.nextUrl.clone()
        url.pathname =
            pathname === '/' ? `/${locale}` : `/${locale}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
        return NextResponse.redirect(url)
    }

    // Validate locale segment: unknown `/xx/...` → fall through to app `notFound` via CSP next.
    // (Invalid langs are handled in [lang]/layout with notFound().)
    void locales

    return handleDirectwerkProxy(request)
}

// Inline literal: Next.js must statically parse `config` at build time, so it
// cannot be imported from `@directwerk/api`. Keep in sync with
// `directwerkProxyMatcher` (see packages/api/src/proxy/directwerkProxy.ts).
export const config = {
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
            missing: [
                {type: 'header', key: 'next-router-prefetch'},
                {type: 'header', key: 'purpose', value: 'prefetch'},
            ],
        },
    ],
}
