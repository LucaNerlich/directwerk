'use client'

import {resolveTenantHost} from '@/lib/tenant/resolveTenantHost'

export function getClientTenantHost(): string {
    return resolveTenantHost(window.location.hostname)
}
