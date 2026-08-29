'use client'

import {createAuthedRequest} from '@directwerk/api/client/authedRequest'
import {parseApiEnvelope} from '@directwerk/api/envelope'
import {platformTenantAdminPolicy} from '@directwerk/api/client/policies'
import {API_CONTRACT_ERROR, AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    clearTenantTokens,
    getTenantSessionHost,
} from '@/lib/auth/tenantTokenStore'
import {
    getValidTenantAccessToken,
    refreshTenantAccessToken,
} from '@/lib/auth/tenantSession'

const tenantFetch = createAuthedRequest({
    session: {
        getValidAccessToken: getValidTenantAccessToken,
        refreshAccessToken: refreshTenantAccessToken,
    },
    clearTokens: clearTenantTokens,
    baseHeaders: (): Record<string, string> => {
        const host = getTenantSessionHost()
        if (host === null) return {}
        return {'X-Tenant-Host': host}
    },
    ...platformTenantAdminPolicy,
})

async function tenantRequest<T>(
    path: string,
    init: RequestInit,
): Promise<T> {
    const tenantHost = getTenantSessionHost()
    if (!tenantHost) {
        throw new Error(AUTH_REQUIRED)
    }

    const raw = await tenantFetch(`/api/tenant-proxy/${path}`, {
        ...init,
        cache: 'no-store',
    })

    try {
        return parseApiEnvelope<T>(raw)
    } catch {
        throw new Error(API_CONTRACT_ERROR)
    }
}

export async function getTenantData<T>(path: string): Promise<T> {
    return tenantRequest<T>(path, {method: 'GET'})
}

export async function postTenantData<T>(
    path: string,
    body: unknown
): Promise<T> {
    return tenantRequest<T>(path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

export async function putTenantData<T>(
    path: string,
    body: unknown
): Promise<T> {
    return tenantRequest<T>(path, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

export async function deleteTenantData<T>(path: string): Promise<T> {
    return tenantRequest<T>(path, {method: 'DELETE'})
}
