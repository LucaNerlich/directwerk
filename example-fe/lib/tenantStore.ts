'use client'

import {parseTenantHost, TENANTS, type TenantHost} from '@/lib/tenants'

const TENANT_HOST_KEY = 'example_fe_tenant_host'

let tenantCache: TenantHost | undefined

const tenantListeners = new Set<() => void>()

function notifyTenantListeners(): void {
    tenantListeners.forEach((fn) => fn())
}

export function subscribeToTenantStore(callback: () => void): () => void {
    tenantListeners.add(callback)
    return () => {
        tenantListeners.delete(callback)
    }
}

function initializeTenantCache(): void {
    if (tenantCache === undefined) {
        tenantCache =
            parseTenantHost(sessionStorage.getItem(TENANT_HOST_KEY)) ?? TENANTS[0].host
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
        if (event.key === TENANT_HOST_KEY || event.key === null) {
            tenantCache = undefined
            notifyTenantListeners()
        }
    })
}

export function getSelectedTenant(): TenantHost {
    initializeTenantCache()
    return tenantCache!
}

export function setSelectedTenant(host: TenantHost): void {
    sessionStorage.setItem(TENANT_HOST_KEY, host)
    tenantCache = host
    notifyTenantListeners()
}
