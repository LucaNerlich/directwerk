import 'server-only'

import {
    buildPlatformApiPath,
    safeUpstreamResponse,
} from '@directwerk/api/server'
import {ASSET_TYPES, ASSET_VISIBILITIES} from '@directwerk/api/types'

import {createConfiguredPlatformApiRequest} from '@/lib/server/api'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 30_000
const STORAGE_PUT_TIMEOUT_MS = 60_000
const ASSET_TYPE_VALUES = new Set<string>(ASSET_TYPES)
const ASSET_VISIBILITY_VALUES = new Set<string>(ASSET_VISIBILITIES)

export type MediaUploadOutcome =
    | {ok: true; asset: unknown}
    | {
          ok: false
          status: number
          body: Record<string, unknown> | null
          /** Set when the S3 PUT succeeded but confirm failed — retry confirm. */
          assetId?: number
          retryConfirm?: boolean
      }

function isHttpsUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'https:'
    } catch {
        return false
    }
}

function readEnvelopeData(payload: unknown): unknown {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        !Object.hasOwn(payload, 'data')
    ) {
        return null
    }
    return (payload as {data: unknown}).data
}

/**
 * Server-side tenant media test upload shared by the BFF route and the
 * upload server action. Bunny S3 does not expose CORS on the storage endpoint
 * and admin CSP is connect-src 'self', so the browser cannot PUT the
 * presigned URL directly.
 * Flow: upload-url → Node PUT to S3 → confirm (all with the resolved bearer).
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

    const uploadUrlBody = {
        filename: fileEntry.name,
        mimeType,
        sizeBytes: fileEntry.size,
        assetType,
        intendedVisibility: visibilityRaw,
        scope: visibilityRaw === 'PUBLIC' ? 'TENANT_PUBLIC' : 'CONTENT',
    }

    try {
        buildPlatformApiPath(['tenants', tenantId, 'media', 'upload-url'])
    } catch {
        return {ok: false, status: 400, body: {error: 'Invalid platform API path.'}}
    }

    try {
        const uploadUrlRequest = createConfiguredPlatformApiRequest(
            ['tenants', tenantId, 'media', 'upload-url'],
            new Request('http://admin.local/api/internal', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(uploadUrlBody),
            }),
            auth.authorization
        )
        const uploadUrlUpstream = await fetch(uploadUrlRequest.url, {
            ...uploadUrlRequest.init,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
        if (!uploadUrlUpstream.ok) {
            const failure = await safeUpstreamResponse(uploadUrlUpstream)
            const failurePayload = await failure.json().catch(() => null)
            return {
                ok: false,
                status: failure.status,
                body:
                    failurePayload && typeof failurePayload === 'object'
                        ? (failurePayload as Record<string, unknown>)
                        : {error: 'Directwerk request failed.'},
            }
        }

        const uploadUrlPayload = await uploadUrlUpstream.json()
        const uploadData = readEnvelopeData(uploadUrlPayload) as {
            assetId?: number
            uploadUrl?: string
            headers?: Record<string, string>
        } | null

        if (
            !uploadData ||
            typeof uploadData.assetId !== 'number' ||
            typeof uploadData.uploadUrl !== 'string' ||
            !isHttpsUrl(uploadData.uploadUrl)
        ) {
            return {
                ok: false,
                status: 502,
                body: {error: 'Invalid upload-url response from Directwerk.'},
            }
        }

        const putHeaders = new Headers(uploadData.headers ?? {})
        if (!putHeaders.has('Content-Type')) {
            putHeaders.set('Content-Type', mimeType)
        }

        const putResponse = await fetch(uploadData.uploadUrl, {
            method: 'PUT',
            headers: putHeaders,
            body: Buffer.from(await fileEntry.arrayBuffer()),
            cache: 'no-store',
            redirect: 'manual',
            signal: AbortSignal.timeout(STORAGE_PUT_TIMEOUT_MS),
        })

        if (!putResponse.ok) {
            return {
                ok: false,
                status: 502,
                body: {
                    error: `Object storage rejected the upload (HTTP ${putResponse.status}).`,
                },
            }
        }

        const confirmRequest = createConfiguredPlatformApiRequest(
            ['tenants', tenantId, 'media', String(uploadData.assetId), 'confirm'],
            new Request('http://admin.local/api/internal', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: '{}',
            }),
            auth.authorization
        )
        const confirmUpstream = await fetch(confirmRequest.url, {
            ...confirmRequest.init,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })

        if (!confirmUpstream.ok) {
            const failure = await safeUpstreamResponse(confirmUpstream)
            const failurePayload = await failure.json().catch(() => ({
                error: 'Directwerk request failed.',
            }))
            return {
                ok: false,
                status: failure.status,
                body:
                    typeof failurePayload === 'object' && failurePayload !== null
                        ? {
                              ...(failurePayload as Record<string, unknown>),
                              assetId: uploadData.assetId,
                              retryConfirm: true,
                          }
                        : {
                              error: 'Directwerk request failed.',
                              assetId: uploadData.assetId,
                              retryConfirm: true,
                          },
                assetId: uploadData.assetId,
                retryConfirm: true,
            }
        }

        const confirmed = await confirmUpstream.json()
        return {ok: true, asset: readEnvelopeData(confirmed)}
    } catch (error: unknown) {
        if (
            error instanceof Error &&
            (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
            return {
                ok: false,
                status: 504,
                body: {error: 'Upstream request timed out.', code: 'TIMEOUT'},
            }
        }
        return {
            ok: false,
            status: 502,
            body: {error: 'Directwerk or object storage is unavailable.'},
        }
    }
}

function inferAssetType(mimeType: string): string {
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
