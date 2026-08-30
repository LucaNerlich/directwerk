import 'server-only'

import {STUDIO_BFF_TIMEOUT_MS} from '@directwerk/api/constants'
import {createTenantBffClient} from '@directwerk/api/server'

const bff = createTenantBffClient({
    refreshCookieName: 'dw_studio_refresh',
    timeoutMs: STUDIO_BFF_TIMEOUT_MS,
})

export const REFRESH_COOKIE = bff.REFRESH_COOKIE
export const directwerkFetch = bff.directwerkFetch
export const getOAuthClientId = bff.getOAuthClientId
