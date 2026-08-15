import {parseJsonText} from '@/lib/api/validation'
import {readBearerToken} from '@/lib/api/proxy'
import {jsonError, toClientResponse} from '@/lib/api/upstream'
import {directwerkFetch} from '@/lib/directwerk'
import {putStreamToStorage} from '@/lib/server/storagePut'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

const STORAGE_PUT_TIMEOUT_MS = 120_000
const ASSET_TYPES = new Set(['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT'])
const ASSET_VISIBILITIES = new Set(['PUBLIC', 'PRIVATE'])

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

function isAllowedUploadUrl(value: string): boolean {
    try {
        const url = new URL(value)
        const isLoopback =
            url.hostname === 'localhost' ||
            url.hostname === '127.0.0.1' ||
            url.hostname === '[::1]'
        return (
            url.protocol === 'https:' ||
            (url.protocol === 'http:' && isLoopback)
        )
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

function isTimeoutError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
    )
}

function parseFilename(value: string | null): string | null {
    if (value === null || value.length === 0 || value.length > 1024) {
        return null
    }
    try {
        const decoded = decodeURIComponent(value)
        if (decoded.length === 0 || decoded.length > 255 || decoded.includes('\u0000')) {
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

/**
 * Tenant media upload for studio.
 *
 * The browser sends the raw file bytes as the request body (no multipart) with
 * metadata in headers, so the BFF can stream the body straight through to the
 * presigned object-storage URL without buffering the file in memory.
 *
 * Flow: upload-url → stream request body to S3 → confirm (caller's Bearer).
 */
export async function POST(request: Request): Promise<Response> {
    const tenantHost = parseTenantHost(request.headers.get('x-tenant-host'))
    if (tenantHost === null) {
        return jsonError('A valid tenant is required.', 400)
    }

    const bearerToken = readBearerToken(request.headers.get('authorization'))
    if (bearerToken === null) {
        return jsonError('A valid bearer token is required.', 401)
    }

    if (!request.body) {
        return jsonError('Expected a request body.', 400)
    }

    const filename = parseFilename(request.headers.get('x-filename'))
    if (filename === null) {
        return jsonError('A valid filename is required.', 400)
    }

    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader === '0') {
        return jsonError('File must not be empty.', 400)
    }
    const sizeBytes = parseSizeBytes(contentLengthHeader)
    if (sizeBytes === null) {
        return jsonError('A valid Content-Length is required.', 411)
    }

    const mimeType =
        (request.headers.get('content-type') ?? '')
            .split(';')[0]
            .trim()
            .toLowerCase() || 'application/octet-stream'

    const assetTypeRaw = (request.headers.get('x-asset-type') ?? '').trim()
    const assetType = assetTypeRaw || inferAssetType(mimeType)
    if (!ASSET_TYPES.has(assetType)) {
        return jsonError('Choose a valid asset type.', 400)
    }

    const visibilityRaw = String(request.headers.get('x-visibility') ?? 'PRIVATE').trim()
    if (!ASSET_VISIBILITIES.has(visibilityRaw)) {
        return jsonError('Choose a valid visibility.', 400)
    }

    const episodeIdRaw = (request.headers.get('x-episode-id') ?? '').trim()
    let episodeId: number | undefined
    if (episodeIdRaw.length > 0) {
        const parsed = Number(episodeIdRaw)
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            return jsonError('Invalid episodeId.', 400)
        }
        episodeId = parsed
    }

    const uploadUrlBody = {
        filename,
        mimeType,
        sizeBytes,
        assetType,
        intendedVisibility: visibilityRaw,
        scope: visibilityRaw === 'PUBLIC' ? 'TENANT_PUBLIC' : 'CONTENT',
        ...(episodeId === undefined ? {} : {episodeId}),
    }

    try {
        const uploadUrlUpstream = await directwerkFetch({
            path: '/api/v1/media/upload-url',
            tenantHost,
            method: 'POST',
            bearerToken,
            body: JSON.stringify(uploadUrlBody),
            contentType: 'application/json',
        })

        if (!uploadUrlUpstream.ok) {
            return toClientResponse(uploadUrlUpstream)
        }

        const uploadUrlPayload: unknown = await uploadUrlUpstream.json()
        const uploadData = readEnvelopeData(uploadUrlPayload) as {
            assetId?: number
            uploadUrl?: string
            headers?: Record<string, string>
        } | null

        if (
            uploadData === null ||
            typeof uploadData.assetId !== 'number' ||
            typeof uploadData.uploadUrl !== 'string' ||
            !isAllowedUploadUrl(uploadData.uploadUrl)
        ) {
            return jsonError('Invalid upload-url response from Directwerk.', 502)
        }

        const putHeaders = new Headers(uploadData.headers ?? {})
        if (!putHeaders.has('Content-Type')) {
            putHeaders.set('Content-Type', mimeType)
        }
        const headersObject: Record<string, string> = {}
        putHeaders.forEach((value, key) => {
            headersObject[key] = value
        })

        const putResult = await putStreamToStorage(
            uploadData.uploadUrl,
            headersObject,
            request.body,
            STORAGE_PUT_TIMEOUT_MS,
        )

        if (putResult.status < 200 || putResult.status >= 300) {
            return jsonError(
                `Object storage rejected the upload (HTTP ${putResult.status}).`,
                502,
            )
        }

        const confirmUpstream = await directwerkFetch({
            path: `/api/v1/media/${uploadData.assetId}/confirm`,
            tenantHost,
            method: 'POST',
            bearerToken,
        })

        if (!confirmUpstream.ok) {
            const failure = await toClientResponse(confirmUpstream)
            const failureText = await failure.text()
            const failureJson = parseJsonText(failureText)
            return Response.json(
                {
                    ...(typeof failureJson === 'object' && failureJson !== null
                        ? failureJson
                        : {error: 'Directwerk confirm failed.'}),
                    assetId: uploadData.assetId,
                    retryConfirm: true,
                },
                {status: failure.status},
            )
        }

        return toClientResponse(confirmUpstream)
    } catch (error: unknown) {
        if (isTimeoutError(error)) {
            return jsonError('Upstream request timed out.', 504)
        }
        return jsonError('Directwerk or object storage is unavailable.', 502)
    }
}
