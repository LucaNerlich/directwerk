'use client'

import {parseApiEnvelope} from '@/lib/api/client'
import {
    API_CONTRACT_ERROR,
    AUTH_REQUIRED,
    CONFLICT,
    FORBIDDEN,
    REQUEST_FAILED,
} from '@/lib/api/errors'
import {
    clearTenantTokens,
    getTenantSessionHost,
} from '@/lib/auth/tenantTokenStore'
import {
    getValidTenantAccessToken,
    refreshTenantAccessToken,
} from '@/lib/auth/tenantSession'

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

async function tenantRequest<T>(
    path: string,
    init: RequestInit,
    retried = false
): Promise<T> {
    const tenantHost = getTenantSessionHost()
    if (!tenantHost) {
        throw new Error(AUTH_REQUIRED)
    }

    let token: string
    try {
        token = await getValidTenantAccessToken()
    } catch {
        throw new Error(AUTH_REQUIRED)
    }

    const response = await fetch(`/api/tenant-proxy/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Tenant-Host': tenantHost,
            ...init.headers,
        },
        cache: 'no-store',
    })

    if (response.status === 401 && !retried) {
        try {
            await refreshTenantAccessToken()
        } catch {
            clearTenantTokens()
            throw new Error(AUTH_REQUIRED)
        }

        return tenantRequest<T>(path, init, true)
    }

    if (response.status === 401) {
        clearTenantTokens()
        throw new Error(AUTH_REQUIRED)
    }

    if (response.status === 403) {
        // Authorization denied with a valid token — the session is fine.
        throw new Error(FORBIDDEN)
    }

    if (!response.ok) {
        if (response.status === 409) {
            throw new Error(CONFLICT)
        }

        throw new Error(REQUEST_FAILED)
    }

    try {
        return parseApiEnvelope<T>(await response.json())
    } catch {
        throw new Error(API_CONTRACT_ERROR)
    }
}
