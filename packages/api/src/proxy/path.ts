// Allow '.' so domain hosts (e.g. podcast.example.com) can be path segments.
const SAFE_PATH_SEGMENT = /^[A-Za-z0-9_.-]+$/
const MAX_TOKEN_LENGTH = 8192

/**
 * Feed-builder preview endpoints accept repeated numeric id lists
 * (`GET /api/v1/me/feeds/preview?formatIds=1&formatIds=2`,
 * `GET /api/v1/me/article-feeds/preview?categoryIds=1…`). The tenant BFF
 * proxy otherwise rejects every query string, so these two paths get a
 * strict allowlist: exactly one known key, 1–50 positive ids, rebuilt
 * canonically so nothing unvalidated reaches the upstream URL.
 */
const PREVIEW_ID_LIST_PARAMS: Record<string, string> = {
    '/api/v1/me/feeds/preview': 'formatIds',
    '/api/v1/me/article-feeds/preview': 'categoryIds',
}
const MAX_PREVIEW_IDS = 50
const POSITIVE_ID = /^\d+$/

/**
 * Builds a canonical `?…` query string for the feed-builder preview paths.
 * Returns `null` when `apiPath` is not a preview path or the params fail
 * validation (unknown key, empty list, non-numeric id, too many ids).
 */
export function buildSafePreviewQueryString(
    apiPath: string,
    searchParams: URLSearchParams,
): string | null {
    const allowedKey = PREVIEW_ID_LIST_PARAMS[apiPath]
    if (allowedKey === undefined) {
        return null
    }

    for (const name of searchParams.keys()) {
        if (name !== allowedKey) {
            return null
        }
    }

    const values = searchParams.getAll(allowedKey)
    if (values.length === 0 || values.length > MAX_PREVIEW_IDS) {
        return null
    }

    const safeParams = new URLSearchParams()
    for (const value of values) {
        if (!POSITIVE_ID.test(value)) {
            return null
        }
        const parsed = Number.parseInt(value, 10)
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            return null
        }
        safeParams.append(allowedKey, String(parsed))
    }

    return `?${safeParams.toString()}`
}

/** Builds `/api/v1/<segments>` from catch-all route segments; null when unsafe. */
export function buildProxyPath(segments: string[]): string | null {
    if (
        segments.length === 0 ||
        segments.some(
            (segment) =>
                segment.length === 0 ||
                segment === '.' ||
                segment === '..' ||
                !SAFE_PATH_SEGMENT.test(segment),
        )
    ) {
        return null
    }

    return `/api/v1/${segments.join('/')}`
}

export function hasUnsupportedProxyQuery(requestUrl: string): boolean {
    return new URL(requestUrl).search !== ''
}

export function readBearerToken(value: string | null): string | null {
    if (value === null || !value.startsWith('Bearer ')) {
        return null
    }

    const token = value.slice('Bearer '.length)
    if (token.length === 0 || token.length > MAX_TOKEN_LENGTH || /\s/.test(token)) {
        return null
    }

    return token
}
