import {
    httpsOriginFromHost,
    normalizeHttpOrigin,
} from '@directwerk/api/urls/urlPolicy'

/**
 * Shared tenant-origin helpers for SEO routes (`layout`, `robots`, `sitemap`).
 *
 * The public site is served per tenant host; canonical URLs must point at the
 * tenant origin. `publicSiteUrl` (operator-configured) wins, otherwise the
 * request host is used over HTTPS. `https://localhost` is the last-resort
 * fallback so metadata generation never throws.
 */
export function resolveTenantOrigin(
    host: string | null,
    publicSiteUrl: string | null = null,
): string {
    if (publicSiteUrl !== null && publicSiteUrl.length > 0) {
        // Operator-configured: any HTTP(S) origin is accepted and preserved.
        const origin = normalizeHttpOrigin(publicSiteUrl, {allowAnyHostHttp: true})
        if (origin !== null) {
            return origin
        }
        // Fall through to the host-based origin below.
    }
    if (host !== null && host.length > 0) {
        return httpsOriginFromHost(host)
    }
    return 'https://localhost'
}
