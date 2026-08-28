import {createGetTenantHost} from '@directwerk/api/tenant'

export const getTenantHost = createGetTenantHost({preferForwardedHost: false})
