'use client'

import type {ModuleDescriptor, ModulePresetKey, TenantModules} from '@directwerk/api/types'
import {
    isModuleCatalog,
    isTenantModules,
} from '@directwerk/api/validation/adminModules'

import {
    deletePlatformData,
    getPlatformData,
    postPlatformData,
} from '@/lib/api/client'

async function listPlatformModules(): Promise<ModuleDescriptor[]> {
    const modules = await getPlatformData<ModuleDescriptor[]>('modules')
    if (!isModuleCatalog(modules)) {
        throw new Error('Could not load modules.')
    }
    return modules
}

async function getTenantModules(tenantId: string): Promise<TenantModules> {
    const modules = await getPlatformData<TenantModules>(`tenants/${tenantId}/modules`)
    if (!isTenantModules(modules)) {
        throw new Error('Could not load modules.')
    }
    return modules
}

export async function loadTenantModulesPanelData(tenantId: string): Promise<{
    catalog: ModuleDescriptor[]
    enabledModules: Set<string>
}> {
    const [catalog, tenantModules] = await Promise.all([
        listPlatformModules(),
        getTenantModules(tenantId),
    ])
    return {
        catalog,
        enabledModules: new Set(tenantModules.enabledModules),
    }
}

export async function activateTenantModule(
    tenantId: string,
    moduleKey: string,
): Promise<TenantModules> {
    const result = await postPlatformData<TenantModules>(
        `tenants/${tenantId}/modules/${moduleKey}/activate`,
        {},
    )
    if (!isTenantModules(result)) {
        throw new Error('Module update failed. Try again later.')
    }
    return result
}

export async function deactivateTenantModule(
    tenantId: string,
    moduleKey: string,
): Promise<TenantModules> {
    const result = await deletePlatformData<TenantModules>(
        `tenants/${tenantId}/modules/${moduleKey}`,
    )
    if (!isTenantModules(result)) {
        throw new Error('Module update failed. Try again later.')
    }
    return result
}

export async function applyTenantModulePreset(
    tenantId: string,
    preset: ModulePresetKey,
): Promise<TenantModules> {
    const result = await postPlatformData<TenantModules>(
        `tenants/${tenantId}/modules/preset/${preset}`,
        {},
    )
    if (!isTenantModules(result)) {
        throw new Error('Module update failed. Try again later.')
    }
    return result
}
