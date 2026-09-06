/**
 * Reads `request.body` incrementally up to a hard byte cap.
 *
 * Returns null when the stream fails or exceeds the cap. A null body stream
 * (bodyless requests) yields an empty string.
 */
export async function readBoundedBody(
    body: ReadableStream<Uint8Array> | null,
    maxBytes = 16_384,
): Promise<string | null> {
    if (!body) {
        return null
    }

    const reader = body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) break

            totalBytes += value.byteLength
            if (totalBytes > maxBytes) {
                reader.cancel()
                return null
            }
            chunks.push(value)
        }

        const bodyBytes = new Uint8Array(totalBytes)
        let offset = 0
        for (const chunk of chunks) {
            bodyBytes.set(chunk, offset)
            offset += chunk.byteLength
        }

        return new TextDecoder().decode(bodyBytes)
    } catch {
        return null
    }
}

export type BoundedBodyResult =
    | {ok: true; text: string}
    | {ok: false; status: 400 | 413; error: string}

export type JsonBodyOptions = {
    /** Maximum accepted request-body size in bytes (bounded stream read). */
    jsonBodyLimit: number
    /**
     * Treat an empty body as absent (`{ok:true, text:undefined}`) instead
     * of rejecting it. Tenant wrappers take this from their
     * `PROXY_POLICIES` row; platform handlers pass `true` for bodyless
     * DELETE only.
     */
    allowMissingBody: boolean
}

export type JsonBodyResult =
    | {ok: true; text: string | undefined}
    | {ok: false; status: 400 | 413 | 415}

/**
 * Shared JSON body gate for all BFF proxy factories (tenant + platform).
 *
 * - Reads the stream with a hard byte cap — never trusts Content-Length,
 *   so a lying (small) header with a big body still yields 413.
 * - Empty bodies bypass the Content-Type check only when `allowMissingBody`
 *   is set; otherwise a missing/incorrect Content-Type yields 415 (tenant
 *   converged from 400 to match the long-standing platform behaviour).
 * - Empty bodies with a JSON Content-Type, and unparseable bodies, yield
 *   400 so callers keep their existing "missing/invalid JSON" responses.
 */
export async function readJsonBody(
    request: Request,
    options: JsonBodyOptions,
): Promise<JsonBodyResult> {
    const bounded = await readBoundedRequestBody(
        request,
        options.jsonBodyLimit,
    )
    if (!bounded.ok) {
        return {ok: false, status: 413}
    }

    const text = bounded.text
    if (text.length === 0 && options.allowMissingBody === true) {
        return {ok: true, text: undefined}
    }

    const contentType = request.headers.get('content-type') ?? ''
    const mediaType = contentType.split(';', 1)[0]?.trim().toLowerCase()
    if (mediaType !== 'application/json') {
        return {ok: false, status: 415}
    }

    if (text.length === 0) {
        return {ok: false, status: 400}
    }

    try {
        JSON.parse(text)
    } catch {
        return {ok: false, status: 400}
    }

    return {ok: true, text}
}

/**
 * Reads request.body incrementally and rejects as soon as total bytes exceed maxBytes.
 * When request.body is null (common for bodyless DELETE), returns an empty string.
 */
export async function readBoundedRequestBody(
    request: Request,
    maxBytes: number,
): Promise<BoundedBodyResult> {
    if (!request.body) {
        return {ok: true, text: ''}
    }

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
        const {done, value} = await reader.read()
        if (done) break

        totalBytes += value.byteLength
        if (totalBytes > maxBytes) {
            await reader.cancel()
            return {
                ok: false,
                status: 413,
                error: 'Request body is too large.',
            }
        }

        chunks.push(value)
    }

    const bodyBytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
        bodyBytes.set(chunk, offset)
        offset += chunk.byteLength
    }

    return {ok: true, text: new TextDecoder().decode(bodyBytes)}
}
