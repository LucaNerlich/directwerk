import 'server-only'

import {safeUpstreamResponse} from '@directwerk/api/server'
import type {MediaAsset} from '@directwerk/api/types'
import {ASSET_TYPES, ASSET_VISIBILITIES} from '@directwerk/api/types'
import {
    buildConfirmRetryBody,
    performMediaUpload,
    type MediaUploadTransport,
} from '@directwerk/api/media/serverUpload'
import {inferAssetType} from '@directwerk/api/media/uploadProtocol'
import {parseMediaAssetEnvelope} from '@directwerk/api/validation/catalog'
import {isRecord} from '@directwerk/api/validation/primitives'

import {createConfiguredPlatformApiRequest} from '@/lib/server/api'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 30_000
const STORAGE_PUT_TIMEOUT_MS = 60_000
const ASSET_TYPE_VALUES = new Set<string>(ASSET_TYPES)
const ASSET_VISIBILITY_VALUES = new Set<string>(ASSET_VISIBILITIES)

export type MediaUploadOutcome =
    | {ok: true; asset: MediaAsset}
    | {
          ok: false
          status: number
          body: Record<string, unknown> | null
          assetId?: number
          retryConfirm?: boolean
      }

/** POSTs a platform media request with the admin upstream timeout applied. */
async function platformMediaFetch(
    segments: string[],
    body: string,
    authorization: string
): Promise<Response> {
    const request = createConfiguredPlatformApiRequest(
        segments,
        new Request('http://admin.local/api/internal', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body,
        }),
        authorization
    )
    return fetch(request.url, {
        ...request.init,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
}

/** Platform transport for the shared upload sequence. */
function platformMediaTransport(
    tenantId: string,
    authorization: string
): MediaUploadTransport {
    return {
        createUploadUrl: (body) =>
            platformMediaFetch(
                ['tenants', tenantId, 'media', 'upload-url'],
                JSON.stringify(body),
                authorization
            ),
        confirmUpload: (assetId) =>
            platformMediaFetch(
                ['tenants', tenantId, 'media', String(assetId), 'confirm'],
                '{}',
                authorization
            ),
    }
}

/**
 * Server-side test upload for a tenant's Storage: upload-url → PUT to S3 →
 * confirm. The sequence is delegated to `@directwerk/api/media/serverUpload`;
 * this module owns the multipart/auth adaptation and the admin result shape.
 * The file bytes are streamed from the already-buffered multipart `File`.
 */
export async function performTenantMediaUpload(
    tenantId: string,
    formData: FormData
): Promise<MediaUploadOutcome> {
    const auth = await resolvePlatformAuthorization()
    if (!auth.ok) {
        return {ok: false, status: auth.status, body: null}
    }

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        return {ok: false, status: 400, body: {error: 'Choose a non-empty file to upload.'}}
    }
    if (fileEntry.size > MAX_UPLOAD_BYTES) {
        return {
            ok: false,
            status: 413,
            body: {error: `File exceeds ${MAX_UPLOAD_BYTES} byte test-upload limit.`},
        }
    }

    const visibilityRaw = String(formData.get('visibility') ?? 'PUBLIC').trim()
    if (!ASSET_VISIBILITY_VALUES.has(visibilityRaw)) {
        return {ok: false, status: 400, body: {error: 'Choose a valid visibility.'}}
    }

    const mimeType = fileEntry.type || 'application/octet-stream'
    const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
    const assetType = assetTypeRaw || inferAssetType(mimeType)
    if (!ASSET_TYPE_VALUES.has(assetType)) {
        return {ok: false, status: 400, body: {error: 'Choose a valid asset type.'}}
    }

    const result = await performMediaUpload({
        body: fileEntry.stream(),
        sizeBytes: fileEntry.size,
        mimeType,
        uploadUrlBody: {
            filename: fileEntry.name,
            mimeType,
            sizeBytes: fileEntry.size,
            assetType,
            intendedVisibility: visibilityRaw,
            scope: visibilityRaw === 'PUBLIC' ? 'TENANT_PUBLIC' : 'CONTENT',
        },
        transport: platformMediaTransport(tenantId, auth.authorization),
        // Platform uploads are presigned for HTTPS object storage only.
        allowLoopbackUploadTarget: false,
        storageTimeouts: {
            idleTimeoutMs: STORAGE_PUT_TIMEOUT_MS,
            absoluteTimeoutMs: STORAGE_PUT_TIMEOUT_MS,
        },
    })

    switch (result.status) {
        case 'confirmed': {
            const payload = await result.response.json().catch(() => null)
            const asset = parseMediaAssetEnvelope(payload)?.data
            if (asset === undefined) {
                return {
                    ok: false,
                    status: 502,
                    body: {error: 'Invalid confirm response from Directwerk.'},
                }
            }
            return {ok: true, asset}
        }
        case 'upload-url-failed': {
            const failure = await safeUpstreamResponse(result.response)
            const failurePayload = await failure.json().catch(() => null)
            return {
                ok: false,
                status: failure.status,
                body: isRecord(failurePayload)
                    ? failurePayload
                    : {error: 'Directwerk request failed.'},
            }
        }
        case 'invalid-upload-url':
        case 'storage-rejected':
            return {ok: false, status: 502, body: {error: result.message}}
        case 'confirm-failed': {
            const failure = await safeUpstreamResponse(result.response)
            const failurePayload = await failure
                .json()
                .catch(() => ({error: 'Directwerk request failed.'}))
            const body = isRecord(failurePayload)
                ? buildConfirmRetryBody(failurePayload, result.assetId)
                : buildConfirmRetryBody(
                      {error: 'Directwerk request failed.'},
                      result.assetId
                  )
            return {
                ok: false,
                status: failure.status,
                body,
                assetId: result.assetId,
                retryConfirm: true,
            }
        }
        case 'body-too-large':
            // The File size cap above makes this unreachable; keep the shared
            // classifier's fallback shape identical to the old catch-all.
            return {
                ok: false,
                status: 502,
                body: {error: 'Directwerk or object storage is unavailable.'},
            }
        case 'timeout':
            return {
                ok: false,
                status: 504,
                body: {error: 'Upstream request timed out.', code: 'TIMEOUT'},
            }
        case 'unavailable':
            return {
                ok: false,
                status: 502,
                body: {error: 'Directwerk or object storage is unavailable.'},
            }
    }
}
