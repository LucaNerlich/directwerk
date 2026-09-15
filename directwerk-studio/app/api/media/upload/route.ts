import {buildUploadUrlBody, parseBrowserUploadHeaders} from '@directwerk/api/media/uploadProtocol'
import {
    buildConfirmRetryBody,
    performMediaUpload,
    type MediaUploadTransport,
} from '@directwerk/api/media/serverUpload'
import {readBearerToken} from '@directwerk/api/proxy'
import {jsonError, toClientResponse, parseTenantHost} from '@directwerk/api/proxy'
import {parseJsonText} from '@directwerk/api/validation/json'

import {directwerkFetch} from '@/lib/server/api'

// The idle timeout only trips when the storage socket stalls; steady progress
// keeps resetting it, so large-but-legitimate uploads are not cut off. The
// absolute ceiling still bounds worst-case resource usage.
const STORAGE_PUT_IDLE_TIMEOUT_MS = 60_000
const STORAGE_PUT_ABSOLUTE_TIMEOUT_MS = 30 * 60_000

/**
 * Browser sends raw file bytes (no multipart); BFF streams to presigned S3 URL.
 * Flow: upload-url → PUT body to S3 → confirm. The sequence lives in
 * `@directwerk/api/media/serverUpload`, shared with the admin upload action.
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
    const requestBody = request.body

    // Shared with the browser client in @directwerk/api/media/uploadProtocol.
    const parsedUpload = parseBrowserUploadHeaders(request.headers)
    if (!parsedUpload.ok) {
        return jsonError(parsedUpload.error, parsedUpload.status)
    }

    const transport: MediaUploadTransport = {
        createUploadUrl: (body) =>
            directwerkFetch({
                path: '/api/v1/media/upload-url',
                tenantHost,
                method: 'POST',
                bearerToken,
                body: JSON.stringify(body),
                contentType: 'application/json',
            }),
        confirmUpload: (assetId) =>
            directwerkFetch({
                path: `/api/v1/media/${assetId}/confirm`,
                tenantHost,
                method: 'POST',
                bearerToken,
            }),
    }

    const result = await performMediaUpload({
        body: requestBody,
        sizeBytes: parsedUpload.value.sizeBytes,
        mimeType: parsedUpload.value.mimeType,
        uploadUrlBody: buildUploadUrlBody(parsedUpload.value),
        transport,
        // Studio's local object storage is reached over loopback HTTP.
        allowLoopbackUploadTarget: true,
        storageTimeouts: {
            idleTimeoutMs: STORAGE_PUT_IDLE_TIMEOUT_MS,
            absoluteTimeoutMs: STORAGE_PUT_ABSOLUTE_TIMEOUT_MS,
        },
    })

    switch (result.status) {
        case 'confirmed':
        case 'upload-url-failed':
            return toClientResponse(result.response)
        case 'invalid-upload-url':
        case 'storage-rejected':
            return jsonError(result.message, 502)
        case 'confirm-failed': {
            const failure = await toClientResponse(result.response)
            const failureJson = parseJsonText(await failure.text())
            const failureBody =
                typeof failureJson === 'object' && failureJson !== null
                    ? (failureJson as Record<string, unknown>)
                    : {error: 'Directwerk confirm failed.'}
            return Response.json(buildConfirmRetryBody(failureBody, result.assetId), {
                status: failure.status,
                headers: {'Cache-Control': 'no-store'},
            })
        }
        case 'body-too-large':
            return jsonError('Uploaded body exceeds the declared Content-Length.', 413)
        case 'timeout':
            return jsonError('Upstream request timed out.', 504)
        case 'unavailable':
            return jsonError('Directwerk or object storage is unavailable.', 502)
    }
}
