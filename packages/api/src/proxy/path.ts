import {ASSET_STATUSES, ASSET_TYPES} from '../constants'

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

/**
 * Media-library endpoints carry bounded filter params (folders update):
 * `GET /api/v1/media?assetType=…&status=…&limit=…&offset=…&folderId=…&recursive=true&unassignedOnly=true&unreferencedOnly=true`
 * and `DELETE /api/v1/media/folders/{id}?mode=…`. The tenant BFF proxy
 * otherwise rejects every query string, so these get a strict allowlist:
 * only known keys with known values, no duplicates, rebuilt canonically
 * so nothing unvalidated reaches the upstream URL.
 */
const MEDIA_LIST_PATH = '/api/v1/media'
const MEDIA_FOLDER_DELETE_PATH = /^\/api\/v1\/media\/folders\/\d+$/
const MEDIA_FOLDER_DELETE_MODES = new Set(['move_to_parent', 'delete_contents'])
const MAX_MEDIA_LIST_LIMIT = 100

const ALLOWED_MEDIA_TYPES = new Set<string>(ASSET_TYPES)
const ALLOWED_MEDIA_STATUSES = new Set<string>(ASSET_STATUSES)

/** The single value of `name`, or null when absent/duplicated. */
function singleValue(searchParams: URLSearchParams, name: string): string | null {
    if (!searchParams.has(name)) {
        return null
    }
    const values = searchParams.getAll(name)
    return values.length === 1 ? (values[0] ?? null) : null
}

/**
 * Builds a canonical `?…` query for `GET /api/v1/media` filter params.
 * Returns `null` for any other path, unknown key, duplicate key, or
 * invalid value.
 */
export function buildSafeMediaListQueryString(
    apiPath: string,
    searchParams: URLSearchParams,
): string | null {
    if (apiPath !== MEDIA_LIST_PATH) {
        return null
    }

    const names = [...searchParams.keys()]
    if (new Set(names).size !== names.length) {
        return null
    }

    const safeParams = new URLSearchParams()
    for (const name of names) {
        const value = singleValue(searchParams, name)
        if (value === null) {
            return null
        }

        switch (name) {
            case 'assetType':
                if (!ALLOWED_MEDIA_TYPES.has(value)) {
                    return null
                }
                break
            case 'status':
                if (!ALLOWED_MEDIA_STATUSES.has(value)) {
                    return null
                }
                break
            case 'limit': {
                if (!POSITIVE_ID.test(value)) {
                    return null
                }
                const limit = Number.parseInt(value, 10)
                if (limit < 1 || limit > MAX_MEDIA_LIST_LIMIT) {
                    return null
                }
                break
            }
            case 'offset': {
                if (!/^\d{1,9}$/.test(value)) {
                    return null
                }
                break
            }
            case 'folderId':
                if (!POSITIVE_ID.test(value)) {
                    return null
                }
                break
            case 'recursive':
            case 'unassignedOnly':
            case 'unreferencedOnly':
                if (value !== 'true') {
                    return null
                }
                break
            default:
                return null
        }

        safeParams.set(name, value)
    }

    return `?${safeParams.toString()}`
}

/**
 * Builds a canonical `?mode=…` query for the media-folder delete endpoint.
 * Returns `null` for any other path (or non-numeric folder id), unknown
 * keys, or invalid mode values.
 */
export function buildSafeMediaFolderDeleteQueryString(
    apiPath: string,
    searchParams: URLSearchParams,
): string | null {
    if (!MEDIA_FOLDER_DELETE_PATH.test(apiPath)) {
        return null
    }

    const names = [...searchParams.keys()]
    if (names.length !== 1 || names[0] !== 'mode') {
        return null
    }

    const mode = singleValue(searchParams, 'mode')
    if (mode === null || !MEDIA_FOLDER_DELETE_MODES.has(mode)) {
        return null
    }

    return `?mode=${mode}`
}

/**
 * Studio episode/article list pages page with `limit`/`offset`
 * (`GET /api/v1/episodes`, `GET /api/v1/articles` — Spring caps limit at
 * 500). Same strict allowlist pattern as the media library: known keys
 * only, no duplicates, rebuilt canonically.
 */
const PUBLICATION_LIST_PATHS = new Set(['/api/v1/episodes', '/api/v1/articles'])
const MAX_PUBLICATION_LIST_LIMIT = 500

/**
 * Builds a canonical `?limit=&offset=` query for episode/article lists.
 * Returns `null` for any other path, unknown key, duplicate key, or
 * invalid value.
 */
export function buildSafePublicationListQueryString(
    apiPath: string,
    searchParams: URLSearchParams,
): string | null {
    if (!PUBLICATION_LIST_PATHS.has(apiPath)) {
        return null
    }

    const names = [...searchParams.keys()]
    if (names.length === 0 || new Set(names).size !== names.length) {
        return null
    }

    const safeParams = new URLSearchParams()
    for (const name of names) {
        const value = singleValue(searchParams, name)
        if (value === null) {
            return null
        }

        switch (name) {
            case 'limit': {
                if (!POSITIVE_ID.test(value)) {
                    return null
                }
                const limit = Number.parseInt(value, 10)
                if (limit < 1 || limit > MAX_PUBLICATION_LIST_LIMIT) {
                    return null
                }
                break
            }
            case 'offset': {
                if (!/^\d{1,9}$/.test(value)) {
                    return null
                }
                break
            }
            default:
                return null
        }

        safeParams.set(name, value)
    }

    return `?${safeParams.toString()}`
}

/**
 * Tenant directory endpoints page with `page`/`size` and optional `q`
 * (`GET /api/v1/tenant/users`, `GET /api/v1/tenant/subscribers` — #561).
 * Same strict allowlist pattern as episode/article lists.
 */
const DIRECTORY_LIST_PATHS = new Set([
    '/api/v1/tenant/users',
    '/api/v1/tenant/subscribers',
])
const MAX_DIRECTORY_PAGE_SIZE = 100
const MAX_DIRECTORY_QUERY_LENGTH = 100

/**
 * Builds a canonical `?page=&size=&q=` query for tenant directory lists.
 * Returns `null` for any other path, unknown key, duplicate key, or
 * invalid value.
 */
export function buildSafeDirectoryListQueryString(
    apiPath: string,
    searchParams: URLSearchParams,
): string | null {
    if (!DIRECTORY_LIST_PATHS.has(apiPath)) {
        return null
    }

    const names = [...searchParams.keys()]
    if (names.length === 0 || new Set(names).size !== names.length) {
        return null
    }

    const safeParams = new URLSearchParams()
    for (const name of names) {
        const value = singleValue(searchParams, name)
        if (value === null) {
            return null
        }

        switch (name) {
            case 'page': {
                if (!/^\d{1,9}$/.test(value)) {
                    return null
                }
                break
            }
            case 'size': {
                if (!POSITIVE_ID.test(value)) {
                    return null
                }
                const size = Number.parseInt(value, 10)
                if (size < 1 || size > MAX_DIRECTORY_PAGE_SIZE) {
                    return null
                }
                break
            }
            case 'q': {
                if (
                    value.length === 0 ||
                    value.length > MAX_DIRECTORY_QUERY_LENGTH ||
                    /[<>"']/.test(value)
                ) {
                    return null
                }
                break
            }
            default:
                return null
        }

        safeParams.set(name, value)
    }

    return `?${safeParams.toString()}`
}

/**
 * Resolves the canonical upstream `?…` query for an allowlisted
 * proxy call (feed-builder previews, media library list/delete,
 * episode/article lists, tenant directory lists). Returns `null`
 * when the path/method/query combination is not allowlisted —
 * callers keep the blanket query rejection then.
 */
export function buildSafeProxyQuery(
    apiPath: string,
    method: string,
    searchParams: URLSearchParams,
): string | null {
    if (method === 'GET') {
        return (
            buildSafePreviewQueryString(apiPath, searchParams) ??
            buildSafeMediaListQueryString(apiPath, searchParams) ??
            buildSafePublicationListQueryString(apiPath, searchParams) ??
            buildSafeDirectoryListQueryString(apiPath, searchParams)
        )
    }
    if (method === 'DELETE') {
        return buildSafeMediaFolderDeleteQueryString(apiPath, searchParams)
    }
    return null
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
