'use client'

import {resolveTenantHost} from './resolveTenantHost'

export function getClientTenantHost(): string {
    if (typeof window === 'undefined') {
        return resolveTenantHost(null)
    }
    return resolveTenantHost(window.location.hostname)
}
