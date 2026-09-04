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
 * `GET /api/v1/media?assetType=…&status=…&limit=…&folderId=…&recursive=true&unassignedOnly=true`
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
            case 'folderId':
                if (!POSITIVE_ID.test(value)) {
                    return null
                }
                break
            case 'recursive':
            case 'unassignedOnly':
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
 * Resolves the canonical upstream `?…` query for an allowlisted
 * proxy call (feed-builder previews, media library list/delete).
 * Returns `null` when the path/method/query combination is not
 * allowlisted — callers keep the blanket query rejection then.
 */
export function buildSafeProxyQuery(
    apiPath: string,
    method: string,
    searchParams: URLSearchParams,
): string | null {
    if (method === 'GET') {
        return (
            buildSafePreviewQueryString(apiPath, searchParams) ??
            buildSafeMediaListQueryString(apiPath, searchParams)
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
