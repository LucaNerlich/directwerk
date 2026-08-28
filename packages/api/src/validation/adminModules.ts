import type {ModuleDescriptor, TenantModules} from '../types'
import {isRecord} from './primitives'

export function isModuleDescriptor(value: unknown): value is ModuleDescriptor {
    if (!isRecord(value)) {
        return false
    }

    return (
        typeof value.moduleKey === 'string' &&
        typeof value.name === 'string' &&
        (value.description === undefined ||
            value.description === null ||
            typeof value.description === 'string') &&
        Array.isArray(value.dependsOn) &&
        value.dependsOn.every((item) => typeof item === 'string') &&
        typeof value.core === 'boolean'
    )
}

export function isModuleCatalog(value: unknown): value is ModuleDescriptor[] {
    return Array.isArray(value) && value.every(isModuleDescriptor)
}

export function isTenantModules(value: unknown): value is TenantModules {
    if (!isRecord(value)) {
        return false
    }

    return (
        Array.isArray(value.enabledModules) &&
        value.enabledModules.every((item) => typeof item === 'string')
    )
}
