'use client'

import {resolveTenantHost} from './resolveTenantHost'

export function getClientTenantHost(): string {
    return resolveTenantHost(window.location.hostname)
}
