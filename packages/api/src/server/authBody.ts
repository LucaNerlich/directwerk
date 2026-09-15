import {readBoundedRequestBody} from '../proxy/boundedBody'
import {jsonError} from '../proxy/upstreamResponse'

export interface AuthJsonBodyMessages {
    /** 415 response text when `Content-Type` is not JSON. */
    contentType: string
    /** 413 response text when the body exceeds the byte cap. */
    tooLarge: string
    /** 400 response text when the body is not valid JSON. */
    invalidJson: string
    /**
     * 400 response text when the request has no body stream at all. When
     * omitted, an absent body falls through to `invalidJson`.
     */
    missingBody?: string
}

export interface AuthJsonBodyOptions {
    /** Hard byte cap for the bounded stream read. */
    jsonBodyLimit: number
    /** Response messages; see `AuthJsonBodyMessages`. */
    messages: AuthJsonBodyMessages
}

export type AuthJsonBodyResult =
    | {ok: true; value: unknown}
    | {ok: false; response: Response}

/**
 * JSON body gate shared by the platform BFF auth factories.
 *
 * Preserves the long-standing `directwerk-admin` ordering and statuses, while
 * reading the stream through the shared bounded-body helper (which never
 * trusts `Content-Length`):
 * - non-JSON `Content-Type` → 415
 * - `Content-Length` over the cap → 413 (fast path)
 * - streamed body over the hard byte cap → 413 (the real guard)
 * - absent body stream → 400 (`missingBody`, when configured)
 * - unparseable JSON → 400
 */
export async function readAuthJsonBody(
    request: Request,
    options: AuthJsonBodyOptions,
): Promise<AuthJsonBodyResult> {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
        return {ok: false, response: jsonError(options.messages.contentType, 415)}
    }

    const contentLength = request.headers.get('content-length')
    if (contentLength !== null && Number(contentLength) > options.jsonBodyLimit) {
        return {ok: false, response: jsonError(options.messages.tooLarge, 413)}
    }

    if (request.body === null && options.messages.missingBody !== undefined) {
        return {ok: false, response: jsonError(options.messages.missingBody, 400)}
    }

    const bounded = await readBoundedRequestBody(request, options.jsonBodyLimit)
    if (!bounded.ok) {
        return {ok: false, response: jsonError(options.messages.tooLarge, 413)}
    }

    let value: unknown
    try {
        value = JSON.parse(bounded.text)
    } catch {
        return {ok: false, response: jsonError(options.messages.invalidJson, 400)}
    }

    return {ok: true, value}
}
