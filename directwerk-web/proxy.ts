import type {NextRequest} from 'next/server'

import {createDirectwerkProxyHandler} from '@directwerk/api/proxy/directwerkProxy'

import {createDirectwerkContentSecurityPolicy} from '../packages/next-config/createDirectwerkNextConfig'

const handleDirectwerkProxy = createDirectwerkProxyHandler({
    buildContentSecurityPolicy: createDirectwerkContentSecurityPolicy,
})

export function proxy(request: NextRequest) {
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
