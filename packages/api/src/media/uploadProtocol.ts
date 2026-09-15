import {ASSET_TYPES, ASSET_VISIBILITIES} from '../types'
import type {AssetType} from '../types'

/**
 * One contract for the browser → BFF media upload headers, shared by the
 * browser client that builds them and the server route that parses them.
 */
export const MEDIA_UPLOAD_HEADERS = {
    filename: 'x-filename',
    visibility: 'x-visibility',
    assetType: 'x-asset-type',
    episodeId: 'x-episode-id',
    folderId: 'x-folder-id',
} as const

const ASSET_TYPE_VALUES = new Set<string>(ASSET_TYPES)
const ASSET_VISIBILITY_VALUES = new Set<string>(ASSET_VISIBILITIES)

export function inferAssetType(mimeType: string): AssetType {
    if (mimeType.startsWith('image/')) {
        return 'IMAGE'
    }
    if (mimeType.startsWith('audio/')) {
        return 'AUDIO'
    }
    if (mimeType.startsWith('video/')) {
        return 'VIDEO'
    }
    return 'DOCUMENT'
}

export interface BrowserUploadRequest {
    filename: string
    sizeBytes: number
    mimeType: string
    assetType: AssetType
    visibility: 'PUBLIC' | 'PRIVATE'
    episodeId?: number
    folderId?: number
}

export type BrowserUploadHeaderResult =
    | {ok: true; value: BrowserUploadRequest}
    | {ok: false; status: number; error: string}

/** Parses the studio BFF upload headers, returning a structured 4xx on bad input. */
export function parseBrowserUploadHeaders(headers: Headers): BrowserUploadHeaderResult {
    const filename = parseFilename(headers.get(MEDIA_UPLOAD_HEADERS.filename))
    if (filename === null) {
        return {ok: false, status: 400, error: 'A valid filename is required.'}
    }

    const contentLength = headers.get('content-length')
    if (contentLength === null || !/^\d+$/.test(contentLength)) {
        return {ok: false, status: 411, error: 'A valid Content-Length is required.'}
    }
    if (/^0+$/.test(contentLength)) {
        return {ok: false, status: 400, error: 'File must not be empty.'}
    }
    const sizeBytes = parseSizeBytes(contentLength)
    if (sizeBytes === null) {
        return {ok: false, status: 400, error: 'File size exceeds the supported limit.'}
    }

    const mimeType =
        (headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() ||
        'application/octet-stream'

    const assetTypeRaw = (headers.get(MEDIA_UPLOAD_HEADERS.assetType) ?? '').trim()
    const assetType = assetTypeRaw || inferAssetType(mimeType)
    if (!ASSET_TYPE_VALUES.has(assetType)) {
        return {ok: false, status: 400, error: 'Choose a valid asset type.'}
    }

    const visibilityRaw = String(headers.get(MEDIA_UPLOAD_HEADERS.visibility) ?? 'PRIVATE').trim()
    if (!ASSET_VISIBILITY_VALUES.has(visibilityRaw)) {
        return {ok: false, status: 400, error: 'Choose a valid visibility.'}
    }

    const episodeId = parseOptionalPositiveId(headers.get(MEDIA_UPLOAD_HEADERS.episodeId))
    if (episodeId === null) {
        return {ok: false, status: 400, error: 'Invalid episodeId.'}
    }
    const folderId = parseOptionalPositiveId(headers.get(MEDIA_UPLOAD_HEADERS.folderId))
    if (folderId === null) {
        return {ok: false, status: 400, error: 'Invalid folderId.'}
    }

    return {
        ok: true,
        value: {
            filename,
            sizeBytes,
            mimeType,
            assetType: assetType as AssetType,
            visibility: visibilityRaw as 'PUBLIC' | 'PRIVATE',
            ...(episodeId === undefined ? {} : {episodeId}),
            ...(folderId === undefined ? {} : {folderId}),
        },
    }
}

/** The `/api/v1/media/upload-url` body implied by a parsed upload request. */
export function buildUploadUrlBody(request: BrowserUploadRequest): Record<string, unknown> {
    return {
        filename: request.filename,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        assetType: request.assetType,
        intendedVisibility: request.visibility,
        scope: request.visibility === 'PUBLIC' ? 'TENANT_PUBLIC' : 'CONTENT',
        ...(request.episodeId === undefined ? {} : {episodeId: request.episodeId}),
        ...(request.folderId === undefined ? {} : {folderId: request.folderId}),
    }
}

function parseFilename(value: string | null): string | null {
    if (value === null || value.length === 0 || value.length > 1024) {
        return null
    }
    try {
        const decoded = decodeURIComponent(value)
        // eslint-disable-next-line no-control-regex
        if (decoded.length === 0 || decoded.length > 255 || /[\u0000-\u001f\u007f]/.test(decoded)) {
            return null
        }
        return decoded
    } catch {
        return null
    }
}

function parseSizeBytes(value: string | null): number | null {
    if (value === null) {
        return null
    }
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return null
    }
    return parsed
}

/** `undefined` when absent/blank, `null` when present but invalid. */
function parseOptionalPositiveId(value: string | null): number | undefined | null {
    const raw = (value ?? '').trim()
    if (raw.length === 0) {
        return undefined
    }
    const parsed = Number(raw)
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return null
    }
    return parsed
}
