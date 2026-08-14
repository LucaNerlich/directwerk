'use client'

import {useSyncExternalStore} from 'react'

import {getSelectedTenant, subscribeToTenantStore} from '@/lib/tenantStore'
import {TENANTS, type TenantHost} from '@/lib/tenants'

export function useSelectedTenant(): TenantHost {
    return useSyncExternalStore(
        subscribeToTenantStore,
        getSelectedTenant,
        () => TENANTS[0].host,
    )
}
