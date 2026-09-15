/**
 * One trust policy for URLs that come from outside the app: feed/enclosure
 * redirects, upstream API origins, presigned upload URLs and tenant-site
 * origins.
 *
 * "Trusted" means HTTPS on any host, plus plain HTTP on loopback hosts when a
 * caller explicitly opts in. The per-call-site differences (whether HTTP is
 * allowed at all, whether `*.localhost` counts as loopback, whether any-host
 * HTTP is acceptable) are explicit options rather than being re-derived at
 * each call site.
 */

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1'])
const IPV6_LOOPBACK_HOSTNAME = '[::1]'
const RELATIVE_REDIRECT_BASE = new URL('https://directwerk.invalid')

/** Loopback variant controls. */
export interface LoopbackOptions {
    /** Also treat any `*.localhost` hostname as loopback. Default false. */
    allowLocalhostSubdomains?: boolean
    /** Also treat `[::1]` as loopback. Default true. */
    allowIpv6Loopback?: boolean
}

/** Trust-policy variant controls. */
export interface UrlPolicyOptions extends LoopbackOptions {
    /**
     * Accept plain `http:` URLs on loopback hosts. Default false (HTTPS only).
     * Cannot be combined meaningfully with {@link allowAnyHostHttp}.
     */
    allowLoopback?: boolean
    /**
     * Accept plain `http:` URLs on any host. Reserved for operator-configured
     * origins (e.g. `publicSiteUrl`); never use it for values from upstream
     * responses or redirect `Location` headers. Default false.
     */
    allowAnyHostHttp?: boolean
}

/** True when `host` names the local machine (or a `*.localhost` alias). */
export function isLoopbackHostname(
    host: string,
    options: LoopbackOptions = {},
): boolean {
    const normalized = host.trim().toLowerCase()
    if (LOOPBACK_HOSTNAMES.has(normalized)) {
        return true
    }
    if (normalized === IPV6_LOOPBACK_HOSTNAME) {
        return options.allowIpv6Loopback !== false
    }
    return (
        options.allowLocalhostSubdomains === true &&
        normalized.endsWith('.localhost')
    )
}

function isTrustedParsedOrigin(parsed: URL, options: UrlPolicyOptions): boolean {
    if (parsed.protocol === 'https:') {
        return true
    }
    if (parsed.protocol !== 'http:') {
        return false
    }
    if (options.allowAnyHostHttp === true) {
        return true
    }
    if (options.allowLoopback !== true) {
        return false
    }
    return isLoopbackHostname(parsed.hostname, options)
}

/**
 * Whether `url` is a trusted HTTPS origin (or an allowed loopback/any-host
 * HTTP origin). Invalid URLs are not trusted.
 */
export function isTrustedOrigin(
    url: string | URL,
    options: UrlPolicyOptions = {},
): boolean {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return false
    }
    return isTrustedParsedOrigin(parsed, options)
}

/**
 * Normalises `url` to its serialized origin when it is trusted, otherwise
 * returns null. The scheme is preserved (`http` stays `http`).
 */
export function normalizeHttpOrigin(
    url: string | URL,
    options: UrlPolicyOptions = {},
): string | null {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return null
    }
    return isTrustedParsedOrigin(parsed, options) ? parsed.origin : null
}

/**
 * Redirect `Location` values the feed proxy may forward. Same-origin absolute
 * paths are always allowed; otherwise this is the feed-URL variant (HTTPS, or
 * HTTP on loopback including `*.localhost`) so a compromised upstream cannot
 * turn the relay into an open redirector.
 */
export function isSafeRedirectTarget(location: string): boolean {
    if (location.startsWith('/') && !location.startsWith('//')) {
        try {
            return new URL(location, RELATIVE_REDIRECT_BASE).origin ===
                RELATIVE_REDIRECT_BASE.origin
        } catch {
            return false
        }
    }
    return isTrustedOrigin(location, {
        allowLoopback: true,
        allowLocalhostSubdomains: true,
    })
}

/**
 * Presigned object-storage URLs: HTTPS, or HTTP on bare loopback hosts. CDN
 * hosts never come back as `*.localhost`, so those are not accepted.
 */
export function isTrustedUploadUrl(url: string): boolean {
    return isTrustedOrigin(url, {allowLoopback: true})
}

/**
 * Normalises a host or absolute URL to an HTTPS origin without dropping the
 * port. Mirrors the tenant-site canonical-URL fallback: a raw host becomes
 * `https://host`, an absolute URL keeps only its authority.
 */
export function httpsOriginFromHost(raw: string): string {
    const host = raw.includes('://') ? new URL(raw).host : raw
    return `https://${host}`
}
