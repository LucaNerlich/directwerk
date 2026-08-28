import {jsonError, parseBearerAuthorization} from '@directwerk/api/server'

import {performTenantMediaUpload} from '@/lib/server/mediaUpload'

interface RouteContext {
    params: Promise<{id: string}>
}

/** Multipart overhead allowance on top of the file size cap. */
const MAX_REQUEST_BYTES = 10 * 1024 * 1024 + 64 * 1024

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
            return jsonError('Invalid Content-Length.', 400)
        }
        if (contentLength > maxBytes) {
            return jsonError(
                `Request exceeds ${maxBytes} byte upload limit.`,
                413
            )
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
            return jsonError(
                `Request exceeds ${maxBytes} byte upload limit.`,
                413
            )
        }
        return jsonError('Expected multipart form data.', 400)
    }
}

/**
 * Server-side test upload for directwerk-admin Storage. The upload flow
 * (upload-url → Node PUT to S3 → confirm) lives in `@/lib/server/mediaUpload`
 * and is shared with the storage upload server action.
 */
export async function POST(
    request: Request,
    context: RouteContext
): Promise<Response> {
    const authorization = parseBearerAuthorization(
        request.headers.get('authorization')
    )

    if (!authorization) {
        return jsonError('Authentication required.', 401)
    }

    const {id: tenantId} = await context.params
    if (!/^\d+$/.test(tenantId)) {
        return jsonError('Invalid tenant identifier.', 400)
    }

    const formDataOrError = await readFormDataWithByteLimit(
        request,
        MAX_REQUEST_BYTES
    )
    if (formDataOrError instanceof Response) {
        return formDataOrError
    }

    const result = await performTenantMediaUpload(tenantId, formDataOrError)

    if (result.ok) {
        // Keep the upstream `{data}` envelope contract for BFF consumers.
        return Response.json({data: result.asset}, {
            status: 200,
            headers: {'Cache-Control': 'no-store'},
        })
    }

    return Response.json(
        result.body ?? {error: 'Directwerk request failed.'},
        {status: result.status, headers: {'Cache-Control': 'no-store'}}
    )
}
