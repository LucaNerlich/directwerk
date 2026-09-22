const DEVELOPMENT_API_URL = 'http://localhost:8080'

/**
 * Resolves the public API origin used by the contact form, ALTCHA widget and
 * the CSP `connect-src` allowance.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a production build
 * without `NEXT_PUBLIC_API_URL` would silently ship the localhost fallback to
 * every visitor (and whitelist `http://localhost:8080` in the CSP). Fail that
 * build instead; only development/test builds may fall back.
 */
export function resolveApiBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_API_URL
    if (configured !== undefined) {
        return configured.replace(/\/$/, '')
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'NEXT_PUBLIC_API_URL must be set at build time for a production homepage build.',
        )
    }
    return DEVELOPMENT_API_URL
}
