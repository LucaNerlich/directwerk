/**
 * Shared tenant-origin helpers for SEO routes (`layout`, `robots`, `sitemap`).
 *
 * The public site is served per tenant host; canonical URLs must point at the
 * tenant origin. `publicSiteUrl` (operator-configured) wins, otherwise the
 * request host is used over HTTPS. `https://localhost` is the last-resort
 * fallback so metadata generation never throws.
 */
function originFromHost(raw: string): string {
    const host = raw.includes('://') ? new URL(raw).host : raw
    return `https://${host}`
}

export function resolveTenantOrigin(
    host: string | null,
    publicSiteUrl: string | null = null,
): string {
    if (publicSiteUrl !== null && publicSiteUrl.length > 0) {
        try {
            const parsed = new URL(publicSiteUrl)
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return parsed.origin
            }
        } catch {
            // Fall through to the host-based origin below.
        }
    }
    if (host !== null && host.length > 0) {
        return originFromHost(host)
    }
    return 'https://localhost'
}
