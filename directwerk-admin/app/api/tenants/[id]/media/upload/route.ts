import {
    buildPlatformApiPath,
    parseBearerAuthorization,
    safeUpstreamResponse,
} from '@/lib/directwerk'
import {createConfiguredPlatformApiRequest} from '@/lib/directwerkServer'

interface RouteContext {
    params: Promise<{id: string}>
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
/** Multipart overhead allowance on top of the file size cap. */
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024
const UPSTREAM_TIMEOUT_MS = 30_000
const STORAGE_PUT_TIMEOUT_MS = 60_000
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

function isTimeoutError(error: unknown): boolean {
    return (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
    )
}

function timeoutResponse(): Response {
    return Response.json(
        {error: 'Upstream request timed out.', code: 'TIMEOUT'},
        {status: 504}
    )
}

/**
 * Reject oversized bodies before buffering the full multipart payload.
 * Uses Content-Length when present, then a streaming byte counter while parsing.
 */
async function readFormDataWithByteLimit(
    request: Request,
    maxBytes: number
): Promise<FormData | Response> {
    const contentLengthHeader = request.headers.get('content-length')
    if (contentLengthHeader !== null) {
        const contentLength = Number(contentLengthHeader)
        if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
            return Response.json(
                {error: 'Invalid Content-Length.'},
                {status: 400}
            )
        }
        if (contentLength > maxBytes) {
            return Response.json(
                {
                    error: `Request exceeds ${maxBytes} byte upload limit.`,
                },
                {status: 413}
            )
        }
    }

    if (!request.body) {
        return Response.json(
            {error: 'Expected multipart form data.'},
            {status: 400}
        )
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
        })
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
            return Response.json(
                {
                    error: `Request exceeds ${maxBytes} byte upload limit.`,
                },
                {status: 413}
            )
        }
        return Response.json(
            {error: 'Expected multipart form data.'},
            {status: 400}
        )
    }
}

/**
 * Server-side test upload for directwerk-admin Storage.
 * Bunny S3 does not expose CORS on the storage endpoint, and admin CSP is
 * connect-src 'self', so the browser cannot PUT the presigned URL directly.
 * Flow: upload-url → Node PUT to S3 → confirm (all with the caller's Bearer).
 */
export async function POST(
    request: Request,
    context: RouteContext
): Promise<Response> {
    const authorization = parseBearerAuthorization(
        request.headers.get('authorization')
    )

    if (!authorization) {
        return Response.json({error: 'Authentication required.'}, {status: 401})
    }

    const {id: tenantId} = await context.params
    if (!/^\d+$/.test(tenantId)) {
        return Response.json({error: 'Invalid tenant identifier.'}, {status: 400})
    }

    const formDataOrError = await readFormDataWithByteLimit(
        request,
        MAX_REQUEST_BYTES
    )
    if (formDataOrError instanceof Response) {
        return formDataOrError
    }
    const formData = formDataOrError

    const fileEntry = formData.get('file')
    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        return Response.json({error: 'Choose a non-empty file to upload.'}, {status: 400})
    }
    if (fileEntry.size > MAX_UPLOAD_BYTES) {
        return Response.json(
            {error: `File exceeds ${MAX_UPLOAD_BYTES} byte test-upload limit.`},
            {status: 413}
        )
    }

    const visibilityRaw = String(formData.get('visibility') ?? 'PUBLIC').trim()
    if (!ASSET_VISIBILITIES.has(visibilityRaw)) {
        return Response.json({error: 'Choose a valid visibility.'}, {status: 400})
    }

    const mimeType = fileEntry.type || 'application/octet-stream'
    const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
    const assetType = assetTypeRaw || inferAssetType(mimeType)
    if (!ASSET_TYPES.has(assetType)) {
        return Response.json({error: 'Choose a valid asset type.'}, {status: 400})
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
        return Response.json({error: 'Invalid platform API path.'}, {status: 400})
    }

    try {
        const uploadUrlRequest = createConfiguredPlatformApiRequest(
            ['tenants', tenantId, 'media', 'upload-url'],
            new Request('http://admin.local/api/internal', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(uploadUrlBody),
            }),
            authorization
        )
        const uploadUrlUpstream = await fetch(uploadUrlRequest.url, {
            ...uploadUrlRequest.init,
            signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        })
        if (!uploadUrlUpstream.ok) {
            return safeUpstreamResponse(uploadUrlUpstream)
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
            return Response.json(
                {error: 'Invalid upload-url response from Directwerk.'},
                {status: 502}
            )
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
            return Response.json(
                {
                    error: `Object storage rejected the upload (HTTP ${putResponse.status}).`,
                },
                {status: 502}
            )
        }

        const confirmRequest = createConfiguredPlatformApiRequest(
            ['tenants', tenantId, 'media', String(uploadData.assetId), 'confirm'],
            new Request('http://admin.local/api/internal', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: '{}',
            }),
            authorization
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
            return Response.json(
                {
                    ...(typeof failurePayload === 'object' && failurePayload !== null
                        ? failurePayload
                        : {error: 'Directwerk request failed.'}),
                    assetId: uploadData.assetId,
                    retryConfirm: true,
                },
                {status: failure.status}
            )
        }

        return safeUpstreamResponse(confirmUpstream)
    } catch (error: unknown) {
        if (isTimeoutError(error)) {
            return timeoutResponse()
        }
        return Response.json(
            {error: 'Directwerk or object storage is unavailable.'},
            {status: 502}
        )
    }
}
