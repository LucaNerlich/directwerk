import {NextResponse} from 'next/server'
import type {NextRequest} from 'next/server'

export interface DirectwerkProxyOptions {
    /**
     * Builds the per-request Content-Security-Policy for the given nonce.
     * Callers pass `createDirectwerkContentSecurityPolicy` from
     * `packages/next-config` so the CSP string stays defined in exactly one
     * place while this Next-runtime handler lives in `@directwerk/api`
     * (which already depends on `next`).
     */
    buildContentSecurityPolicy: (
        nonce: string,
        isDevelopment: boolean,
    ) => string
}

/**
 * Creates the shared nonce-CSP proxy handler for the tenant apps
 * (`directwerk-studio`, `directwerk-web`). Both keep access tokens in
 * `sessionStorage`, so every page response carries a per-request script
 * nonce that is also forwarded on the request for Next.js script rendering.
 *
 * Each app keeps its own `proxy.ts` that delegates to the created handler so
 * Next.js still sees a static `export function proxy` per app.
 * `directwerk-admin` intentionally keeps a custom proxy (cookie-presence auth
 * redirect); `homepage` is static and sets its headers in `next.config.ts`.
 */
export function createDirectwerkProxyHandler(
    options: DirectwerkProxyOptions,
): (request: NextRequest) => NextResponse {
    return function handleDirectwerkProxy(request: NextRequest): NextResponse {
        const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
        const csp = options.buildContentSecurityPolicy(
            nonce,
            process.env.NODE_ENV === 'development',
        )
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set('x-nonce', nonce)
        requestHeaders.set('Content-Security-Policy', csp)

        const response = NextResponse.next({request: {headers: requestHeaders}})
        response.headers.set('Content-Security-Policy', csp)
        return response
    }
}

/** Shared proxy matcher: every page route, never API/static/prefetch. */
export const directwerkProxyMatcher = {
    matcher: [
        {
            source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
            missing: [
                {type: 'header', key: 'next-router-prefetch'},
                {type: 'header', key: 'purpose', value: 'prefetch'},
            ],
        },
    ],
} as const
