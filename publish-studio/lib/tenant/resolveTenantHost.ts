import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])
const SAFE_DEFAULT_TENANT_HOST = 'alpha-a.localhost'

/**
 * Map a browser/request host to the Directwerk tenant Host header.
 * Loopback hosts are not tenants — fall back to the seeded local tenant.
 */
export function resolveTenantHost(rawHost: string | null): string {
    const configuredHost = parseTenantHost(
        process.env.NEXT_PUBLIC_DIRECTWERK_DEFAULT_TENANT_HOST ?? null,
    )
    const fallback =
        configuredHost !== null && !LOOPBACK_HOSTS.has(configuredHost)
            ? configuredHost
            : SAFE_DEFAULT_TENANT_HOST

    if (rawHost === null || rawHost.length === 0) {
        return fallback
    }

    const candidate = rawHost.split(',')[0]?.trim() ?? ''
    if (candidate.length === 0) {
        return fallback
    }

    const parsed = parseTenantHost(candidate)
    if (parsed === null) {
        throw new Error('Invalid tenant host')
    }
    if (LOOPBACK_HOSTS.has(parsed)) {
        return fallback
    }

    return parsed
}
