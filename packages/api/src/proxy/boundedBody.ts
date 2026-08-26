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
