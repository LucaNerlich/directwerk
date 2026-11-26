import 'server-only'

import {STUDIO_BFF_TIMEOUT_MS} from '@directwerk/api/constants'
import {createTenantBffClient} from '@directwerk/api/server'

const bff = createTenantBffClient({
    refreshCookieName: 'dw_studio_refresh',
})

// Remote ingest can hold a request for 15 minutes; only those routes may wait that long, so
// ordinary pages/API calls keep the transport's 10s default (#1051).
const longRunningBff = createTenantBffClient({
    refreshCookieName: 'dw_studio_refresh',
    timeoutMs: STUDIO_BFF_TIMEOUT_MS,
})

export const REFRESH_COOKIE = bff.REFRESH_COOKIE
export const directwerkFetch = bff.directwerkFetch
export const longRunningDirectwerkFetch = longRunningBff.directwerkFetch
export const getOAuthClientId = bff.getOAuthClientId
