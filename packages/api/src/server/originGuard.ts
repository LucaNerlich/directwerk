import {isTrustedOrigin} from '../urls/urlPolicy'

/**
 * Whether a URL is safe to use as an upstream API origin: HTTPS (or plain
 * HTTP on loopback only, for local dev), no embedded credentials, no query
 * or fragment, and no path beyond the root.
 */
export function isAllowedOrigin(url: URL): boolean {
    // Plain HTTP is limited to loopback for the documented local Directwerk setup.
    // Any non-local deployment must provide an HTTPS API URL.
    return (
        isTrustedOrigin(url, {allowLoopback: true}) &&
        url.username === '' &&
        url.password === '' &&
        url.search === '' &&
        url.hash === '' &&
        (url.pathname === '' || url.pathname === '/')
    )
}
