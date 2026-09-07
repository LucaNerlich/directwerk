/**
 * Scheme allow-lists for API-supplied URLs that end up as `href`/`src` values.
 *
 * The API is trusted to serve well-formed values today, but if it ever serves a
 * `javascript:`/`data:` value (misconfiguration, compromise, future field reuse) it must
 * not execute in the studio origin — same defense-in-depth rule as the Stripe onboarding
 * URL parser in `@directwerk/api/validation`.
 */

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_IMAGE_PROTOCOLS = new Set(['https:'])

function safeUrlWithProtocols(
    value: string | null | undefined,
    allowedProtocols: Set<string>,
): string | null {
    if (value == null || value.length === 0 || value.length > 4096) {
        return null
    }
    try {
        return allowedProtocols.has(new URL(value).protocol) ? value : null
    } catch {
        return null
    }
}

export function safeLinkHref(value: string | null | undefined): string | null {
    return safeUrlWithProtocols(value, SAFE_LINK_PROTOCOLS)
}

export function safeImageSrc(value: string | null | undefined): string | null {
    return safeUrlWithProtocols(value, SAFE_IMAGE_PROTOCOLS)
}
