import 'server-only'

import {isTrustedOrigin, isTrustedUploadUrl} from '../urls/urlPolicy'
import {parseUploadUrlResponse} from '../validation/catalog'
import {putStreamToStorage} from './storagePut'

export {isTrustedUploadUrl} from '../urls/urlPolicy'
export {buildConfirmRetryBody, type MediaUploadRetryResponse} from './uploadProtocol'

/** The presigned-upload flow the server BFF runs for both studio and admin. */
export interface MediaUploadTransport {
    /** Calls Directwerk's upload-url endpoint; a non-2xx is a normal result. */
    createUploadUrl(body: Record<string, unknown>): Promise<Response>
    /** Calls Directwerk's confirm endpoint for an asset; non-2xx is a result. */
    confirmUpload(assetId: number): Promise<Response>
}

export interface MediaUploadStorageTimeouts {
    /** Socket-stall watchdog while PUTting to object storage. */
    idleTimeoutMs: number
    /** Hard ceiling for the storage PUT, regardless of progress. */
    absoluteTimeoutMs: number
}

export interface PerformMediaUploadOptions {
    /** Raw bytes forwarded to the presigned storage URL, streamed with backpressure. */
    body: ReadableStream<Uint8Array>
    /** Declared byte count; the PUT is aborted if `body` ever exceeds it. */
    sizeBytes: number
    /** Fallback `Content-Type` when the presigned headers do not set one. */
    mimeType: string
    /** JSON body for Directwerk's upload-url endpoint. */
    uploadUrlBody: Record<string, unknown>
    transport: MediaUploadTransport
    /**
     * Trust policy for the presigned upload target. `true` accepts HTTPS or
     * plain HTTP on loopback hosts (studio's local object storage); `false`
     * accepts HTTPS only (admin's platform uploads). Defaults to `false`.
     */
    allowLoopbackUploadTarget?: boolean
    storageTimeouts: MediaUploadStorageTimeouts
}

/**
 * Normalized outcome of {@link performMediaUpload}. The upload *sequence* and
 * the upload-target trust check are shared, while each caller keeps its own
 * public response shape (a BFF proxy forwards Responses; the admin server
 * action maps to a discriminated result).
 */
export type PerformMediaUploadResult =
    | {status: 'confirmed'; response: Response}
    /** Directwerk's upload-url call failed; forward/format the raw response. */
    | {status: 'upload-url-failed'; response: Response}
    | {status: 'invalid-upload-url'; message: string}
    | {status: 'storage-rejected'; message: string}
    /** Bytes reached storage but confirm failed; keep the asset id for retry. */
    | {status: 'confirm-failed'; response: Response; assetId: number}
    | {status: 'body-too-large'}
    | {status: 'timeout'}
    | {status: 'unavailable'}

export const INVALID_UPLOAD_URL_MESSAGE =
    'Invalid upload-url response from Directwerk.'

/** Message shared by both callers when object storage rejects the PUT. */
export function storageRejectedMessage(status: number): string {
    return `Object storage rejected the upload (HTTP ${status}).`
}

/** Unwraps a `{data: …}` Directwerk envelope; `null` when it is not one. */
export function readUploadEnvelope(payload: unknown): unknown {
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
 * Aborts the stream as soon as the actual byte count exceeds the declared
 * Content-Length, so a client cannot declare a small size and stream an
 * arbitrarily large body through to object storage.
 */
function limitStreamToSize(
    body: ReadableStream<Uint8Array>,
    maxBytes: number,
): ReadableStream<Uint8Array> {
    let totalBytes = 0
    return body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                totalBytes += chunk.byteLength
                if (totalBytes > maxBytes) {
                    const error = new Error(
                        'Uploaded body exceeds the declared Content-Length.',
                    )
                    error.name = 'BodyTooLargeError'
                    controller.error(error)
                    return
                }
                controller.enqueue(chunk)
            },
        }),
    )
}

function isTimeoutError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
    )
}

/**
 * Runs upload-url → PUT-to-storage → confirm and reports a normalized outcome.
 *
 * Both server callers previously reimplemented this dance with divergent
 * upload-target trust checks and confirm-retry bodies; the upload-target check
 * now comes from `urlPolicy` and the retry contract from `uploadProtocol`.
 */
export async function performMediaUpload(
    options: PerformMediaUploadOptions,
): Promise<PerformMediaUploadResult> {
    const {
        body,
        sizeBytes,
        mimeType,
        uploadUrlBody,
        transport,
        storageTimeouts,
    } = options
    const allowLoopback = options.allowLoopbackUploadTarget === true

    try {
        const uploadUrlResponse = await transport.createUploadUrl(uploadUrlBody)
        if (!uploadUrlResponse.ok) {
            return {status: 'upload-url-failed', response: uploadUrlResponse}
        }

        const uploadData = parseUploadUrlResponse(
            readUploadEnvelope(await uploadUrlResponse.json()),
        )
        // Studio's local object storage is loopback HTTP; admin's platform
        // storage is HTTPS only. Both variants are enforced by `urlPolicy`.
        const uploadTargetTrusted =
            uploadData !== null &&
            (allowLoopback
                ? isTrustedUploadUrl(uploadData.uploadUrl)
                : isTrustedOrigin(uploadData.uploadUrl))
        if (uploadData === null || !uploadTargetTrusted) {
            return {status: 'invalid-upload-url', message: INVALID_UPLOAD_URL_MESSAGE}
        }

        const putHeaders = new Headers(uploadData.headers ?? {})
        if (!putHeaders.has('Content-Type')) {
            putHeaders.set('Content-Type', mimeType)
        }
        const headers: Record<string, string> = {}
        putHeaders.forEach((value, key) => {
            headers[key] = value
        })

        const putResult = await putStreamToStorage(
            uploadData.uploadUrl,
            headers,
            limitStreamToSize(body, sizeBytes),
            storageTimeouts,
        )

        if (putResult.status < 200 || putResult.status >= 300) {
            return {
                status: 'storage-rejected',
                message: storageRejectedMessage(putResult.status),
            }
        }

        const confirmResponse = await transport.confirmUpload(uploadData.assetId)
        if (!confirmResponse.ok) {
            return {
                status: 'confirm-failed',
                response: confirmResponse,
                assetId: uploadData.assetId,
            }
        }

        return {status: 'confirmed', response: confirmResponse}
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'BodyTooLargeError') {
            return {status: 'body-too-large'}
        }
        if (isTimeoutError(error)) {
            return {status: 'timeout'}
        }
        return {status: 'unavailable'}
    }
}
