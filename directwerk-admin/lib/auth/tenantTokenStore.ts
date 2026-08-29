'use client'

import {createSessionTokenStore} from '@directwerk/api/auth/tokenStore'


export const tenantTokenStore = createSessionTokenStore({
    accessTokenKey: 'publish_admin_tenant_access',
    accessTokenExpiresAtKey: 'publish_admin_tenant_access_expires_at',
    tenantHostKey: 'publish_admin_tenant_host',
})

export const getTenantAccessToken =
    tenantTokenStore.getAccessToken.bind(tenantTokenStore)
export function getTenantSessionHost(): string | null {
    return tenantTokenStore.getTenantHost()
}
export const isTenantAccessTokenExpired =
    tenantTokenStore.isAccessTokenExpired.bind(tenantTokenStore)
export function storeTenantTokens(tokens: Parameters<typeof tenantTokenStore.setTokens>[0], tenantHost: string): void {
    tenantTokenStore.setTokens(tokens, tenantHost)
}
export const clearTenantTokens = tenantTokenStore.clearTokens.bind(tenantTokenStore)
