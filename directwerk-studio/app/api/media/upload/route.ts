import {parseJsonText} from '@/lib/api/validation'
import {readBearerToken} from '@/lib/api/proxy'
import {jsonError} from '@/lib/api/upstream'
import {directwerkFetch} from '@/lib/directwerk'
import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024
const UPSTREAM_TIMEOUT_MS = 30_000
const STORAGE_PUT_TIMEOUT_MS = 120_000
const ASSET_TYPES = new Set(['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT'])
const ASSET_VISIBILITIES = new Set(['PUBLIC', 'PRIVATE'])
const NDJSON_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8'

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

interface UpstreamPayload {
    status: number
    body: unknown
}

/**
 * Reads an upstream (Directwerk) response into `{status, body}` while applying
 * the same status-mapping rules as `toClientResponse`.
 */
async function upstreamPayload(response: Response): Promise<UpstreamPayload> {
    if (response.status >= 500 && response.status <= 599) {
        return {
            status: 502,
            body: {error: 'The upstream service returned an invalid response.'},
        }
    }

    if (response.status === 204 || response.status === 205) {
        return {status: response.status, body: null}
    }

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        if (response.status >= 400 && response.status < 500) {
            return {
                status: response.status,
                body: {error: 'The upstream service rejected the request.'},
            }
        }
        return {
            status: 502,
            body: {error: 'The upstream service returned an invalid response.'},
        }
    }

    const data = parseJsonText(await response.text())
    if (data === null) {
        if (response.status >= 400 && response.status < 500) {
            return {
                status: response.status,
                body: {error: 'The upstream service rejected the request.'},
            }
        }
        return {
            status: 502,
            body: {error: 'The upstream service returned an invalid response.'},
        }
    }

    return {status: response.status, body: data}
}

async function readFormDataWithByteLimit(
    request: Request,
    maxBytes: number,
): Promise<FormData | Response> {
    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader !== null) {
        const contentLength = Number(contentLengthHeader)
        if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
            return jsonError('Invalid Content-Length.', 400)
        }
        if (contentLength > maxBytes) {
            return jsonError(`Request exceeds ${maxBytes} byte upload limit.`, 413)
        }
    }

    if (!request.body) {
        return jsonError('Expected multipart form data.', 400)
    }

    let totalBytes = 0
    const limitedBody = request.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                totalBytes += chunk.byteLength
                if (totalBytes > maxBytes) {
                    controller.error(new DOMException('BODY_TOO_LARGE', 'AbortError'))
                    return
                }
                controller.enqueue(chunk)
            },
        }),
    )

    try {
        const limitedRequest = new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: limitedBody,
            duplex: 'half',
        } as RequestInit)
        return await limitedRequest.formData()
    } catch (error: unknown) {
        if (
            (error instanceof DOMException && error.message === 'BODY_TOO_LARGE') ||
            (error instanceof Error && error.message.includes('BODY_TOO_LARGE'))
        ) {
            return jsonError(`Request exceeds ${maxBytes} byte upload limit.`, 413)
        }
        return jsonError('Expected multipart form data.', 400)
    }
}

interface UploadStreamInput {
    tenantHost: string
    bearerToken: string
    fileEntry: File
    mimeType: string
    uploadUrlBody: Record<string, unknown>
}

/**
 * Runs the upload flow (upload-url → S3 PUT → confirm) while streaming
 * newline-delimited JSON progress events to the browser.
 *
 * Events: `{"type":"progress","percent":N}`, `{"type":"result","body":…}`,
 * and `{"type":"error","status":N,"body":…}`.
 */
function uploadStream({
    tenantHost,
    bearerToken,
    fileEntry,
    mimeType,
    uploadUrlBody,
}: UploadStreamInput): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder()
    let lastPercent = -1
    let sentBytes = 0
    const totalBytes = fileEntry.size

    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (event: unknown): void => {
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
            }

            const sendProgress = (percent: number): void => {
                if (percent !== lastPercent) {
                    lastPercent = percent
                    send({type: 'progress', percent})
                }
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
                    const failure = await upstreamPayload(uploadUrlUpstream)
                    send({type: 'error', status: failure.status, body: failure.body})
                    controller.close()
                    return
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
                    send({
                        type: 'error',
                        status: 502,
                        body: {error: 'Invalid upload-url response from Directwerk.'},
                    })
                    controller.close()
                    return
                }

                const putHeaders = new Headers(uploadData.headers ?? {})
                if (!putHeaders.has('Content-Type')) {
                    putHeaders.set('Content-Type', mimeType)
                }

                const progressStream = new TransformStream<Uint8Array, Uint8Array>({
                    transform(chunk, sink) {
                        sentBytes += chunk.byteLength
                        sendProgress(Math.min(99, Math.round((sentBytes / totalBytes) * 100)))
                        sink.enqueue(chunk)
                    },
                })

                const putResponse = await fetch(uploadData.uploadUrl, {
                    method: 'PUT',
                    headers: putHeaders,
                    body: fileEntry.stream().pipeThrough(progressStream),
                    cache: 'no-store',
                    redirect: 'manual',
                    signal: AbortSignal.timeout(STORAGE_PUT_TIMEOUT_MS),
                    duplex: 'half',
                } as RequestInit)

                if (!putResponse.ok) {
                    send({
                        type: 'error',
                        status: 502,
                        body: {
                            error: `Object storage rejected the upload (HTTP ${putResponse.status}).`,
                        },
                    })
                    controller.close()
                    return
                }

                sendProgress(100)

                const confirmUpstream = await directwerkFetch({
                    path: `/api/v1/media/${uploadData.assetId}/confirm`,
                    tenantHost,
                    method: 'POST',
                    bearerToken,
                })

                if (!confirmUpstream.ok) {
                    const failure = await upstreamPayload(confirmUpstream)
                    const failureBody =
                        typeof failure.body === 'object' && failure.body !== null
                            ? failure.body
                            : {error: 'Directwerk confirm failed.'}
                    send({
                        type: 'error',
                        status: failure.status,
                        body: {
                            ...failureBody,
                            assetId: uploadData.assetId,
                            retryConfirm: true,
                        },
                    })
                    controller.close()
                    return
                }

                const success = await upstreamPayload(confirmUpstream)
                send({type: 'result', status: success.status, body: success.body})
                controller.close()
            } catch (error: unknown) {
                if (isTimeoutError(error)) {
                    send({type: 'error', status: 504, body: {error: 'Upstream request timed out.'}})
                } else {
                    send({
                        type: 'error',
                        status: 502,
                        body: {error: 'Directwerk or object storage is unavailable.'},
                    })
                }
                controller.close()
            }
        },
    })
}

/**
 * Tenant media upload for studio.
 * Bunny S3 has no CORS; browser cannot PUT the presigned URL.
 * Flow: upload-url → Node PUT to S3 → confirm (caller's Bearer).
 *
 * The upload flow is streamed as NDJSON so the browser can render real upload
 * progress for the object-storage leg.
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

    const formDataOrError = await readFormDataWithByteLimit(request, MAX_REQUEST_BYTES)
    if (formDataOrError instanceof Response) {
        return formDataOrError
    }
    const formData = formDataOrError

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        return jsonError('Choose a non-empty file to upload.', 400)
    }
    if (fileEntry.size > MAX_UPLOAD_BYTES) {
        return jsonError(`File exceeds ${MAX_UPLOAD_BYTES} byte upload limit.`, 413)
    }

    const visibilityRaw = String(formData.get('visibility') ?? 'PRIVATE').trim()
    if (!ASSET_VISIBILITIES.has(visibilityRaw)) {
        return jsonError('Choose a valid visibility.', 400)
    }

    const mimeType = fileEntry.type || 'application/octet-stream'
    const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
    const assetType = assetTypeRaw || inferAssetType(mimeType)
    if (!ASSET_TYPES.has(assetType)) {
        return jsonError('Choose a valid asset type.', 400)
    }

    const episodeIdRaw = String(formData.get('episodeId') ?? '').trim()
    let episodeId: number | undefined
    if (episodeIdRaw.length > 0) {
        const parsed = Number(episodeIdRaw)
        if (!Number.isSafeInteger(parsed) || parsed < 1) {
            return jsonError('Invalid episodeId.', 400)
        }
        episodeId = parsed
    }

    const uploadUrlBody = {
        filename: fileEntry.name,
        mimeType,
        sizeBytes: fileEntry.size,
        assetType,
        intendedVisibility: visibilityRaw,
        scope: visibilityRaw === 'PUBLIC' ? 'TENANT_PUBLIC' : 'CONTENT',
        ...(episodeId === undefined ? {} : {episodeId}),
    }

    return new Response(
        uploadStream({tenantHost, bearerToken, fileEntry, mimeType, uploadUrlBody}),
        {
            status: 200,
            headers: {
                'Content-Type': NDJSON_CONTENT_TYPE,
                'Cache-Control': 'no-store',
            },
        },
    )
}
