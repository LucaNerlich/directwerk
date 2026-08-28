const ALLOWED_PREFIXES = [
    '/account',
    '/pricing',
    '/feeds',
    '/downloads',
    '/episodes',
    '/articles',
    '/checkout',
] as const

/**
 * Validates an in-app return path after login/register (open-redirect safe).
 */
export function safeReturnTo(value: string | null, fallback = '/account'): string {
    if (value === null || value.trim().length === 0) {
        return fallback
    }

    const trimmed = value.trim()
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
        return fallback
    }
    if (trimmed.includes('://') || trimmed.includes('\\')) {
        return fallback
    }

    const path = trimmed.split(/[?#]/)[0] ?? trimmed
    const allowed = ALLOWED_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    )

    return allowed ? trimmed : fallback
}
