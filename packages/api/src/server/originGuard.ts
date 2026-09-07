/**
 * Whether a URL is safe to use as an upstream API origin: HTTPS (or plain
 * HTTP on loopback only, for local dev), no embedded credentials, no query
 * or fragment, and no path beyond the root.
 */
export function isAllowedOrigin(url: URL): boolean {
    const isLoopback =
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname === '[::1]'
    // Plain HTTP is limited to loopback for the documented local Directwerk setup.
    // Any non-local deployment must provide an HTTPS API URL.
    const usesAllowedProtocol =
        url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback)

    return (
        usesAllowedProtocol &&
        url.username === '' &&
        url.password === '' &&
        url.search === '' &&
        url.hash === '' &&
        (url.pathname === '' || url.pathname === '/')
    )
}
