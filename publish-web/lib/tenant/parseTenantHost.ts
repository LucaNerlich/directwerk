const HOSTNAME_PATTERN =
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)*$/i

export function parseTenantHost(value: string | null): string | null {
    if (value === null || value.length === 0) {
        return null
    }

    const host = value.split(':')[0]?.trim().toLowerCase() ?? ''
    if (host.length === 0 || host.length > 253 || !HOSTNAME_PATTERN.test(host)) {
        return null
    }

    return host
}
