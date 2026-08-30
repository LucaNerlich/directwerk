import {parseTenantHost} from '../proxy/tenantHost'

export interface ResolveTenantHostOptions {
    /** Cookie or explicit override from workspace selection. */
    selectedTenantHost?: string | null
}

export function resolveTenantHost(
    rawHost: string | null,
    options: ResolveTenantHostOptions = {},
): string | null {
    const selected = parseTenantHost(options.selectedTenantHost ?? null)
    if (selected !== null) {
        return selected
    }

    if (rawHost === null || rawHost.length === 0) {
        return null
    }

    const candidate = rawHost.split(',')[0]?.trim() ?? ''
    if (candidate.length === 0) {
        return null
    }

    const parsed = parseTenantHost(candidate)
    if (parsed === null) {
        throw new Error('Invalid tenant host')
    }

    return parsed
}

export interface TenantHostHeaderReader {
    get(name: string): string | null
}

export interface ResolveTenantHostFromHeadersOptions {
    preferForwardedHost?: boolean
    selectedTenantHost?: string | null
}

export function resolveTenantHostFromHeaders(
    headers: TenantHostHeaderReader,
    options: ResolveTenantHostFromHeadersOptions = {},
): string | null {
    const preferForwardedHost = options.preferForwardedHost === true
    const rawHost = preferForwardedHost
        ? (headers.get('x-forwarded-host') ?? headers.get('host'))
        : (headers.get('host') ?? headers.get('x-forwarded-host'))
    return resolveTenantHost(rawHost, {
        selectedTenantHost: options.selectedTenantHost,
    })
}
