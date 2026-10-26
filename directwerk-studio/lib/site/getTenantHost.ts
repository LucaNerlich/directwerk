import 'server-only'

import {cache} from 'react'
import {cookies, headers} from 'next/headers'

import {
    resolveTenantHostFromHeaders,
    TENANT_HOST_COOKIE,
} from '@directwerk/api/tenant'

export const getTenantHost = cache(async (): Promise<string | null> => {
    const headerStore = await headers()
    const cookieStore = await cookies()
    return resolveTenantHostFromHeaders(headerStore, {
        preferForwardedHost: false,
        selectedTenantHost: cookieStore.get(TENANT_HOST_COOKIE)?.value ?? null,
    })
})
