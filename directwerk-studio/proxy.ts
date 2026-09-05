import type {NextRequest} from 'next/server'

import {
    createDirectwerkProxyHandler,
    directwerkProxyMatcher,
} from '@directwerk/api/proxy/directwerkProxy'

import {createDirectwerkContentSecurityPolicy} from '../packages/next-config/createDirectwerkNextConfig'

const handleDirectwerkProxy = createDirectwerkProxyHandler({
    buildContentSecurityPolicy: createDirectwerkContentSecurityPolicy,
})

export function proxy(request: NextRequest) {
    return handleDirectwerkProxy(request)
}

export const config = directwerkProxyMatcher
