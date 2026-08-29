import 'server-only'

import {createTenantBffClient} from '@directwerk/api/server'

const bff = createTenantBffClient({refreshCookieName: 'dw_studio_refresh'})

export const REFRESH_COOKIE = bff.REFRESH_COOKIE
export const directwerkFetch = bff.directwerkFetch
export const getOAuthClientId = bff.getOAuthClientId
