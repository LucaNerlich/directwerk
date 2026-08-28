import {createGetTenantHost} from '@directwerk/api/tenant/server'

export const getTenantHost = createGetTenantHost({preferForwardedHost: false})
