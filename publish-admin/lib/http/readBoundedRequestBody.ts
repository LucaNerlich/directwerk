export type BoundedBodyResult =
    | {ok: true; text: string}
    | {ok: false; status: 400 | 413; error: string}

/**
 * Reads request.body incrementally and rejects as soon as total bytes exceed maxBytes.
 * When request.body is null (common for bodyless DELETE), returns an empty string.
 */
export async function readBoundedRequestBody(
    request: Request,
    maxBytes: number
): Promise<BoundedBodyResult> {
    if (!request.body) {
        return {ok: true, text: ''}
    }

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    while (true) {
        const {done, value} = await reader.read()
        if (done) {
            break
        }

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
