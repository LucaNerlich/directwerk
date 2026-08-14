import {describe, expect, it} from 'vitest'

import {readBoundedRequestBody} from './readBoundedRequestBody'

function requestFromChunks(chunks: Uint8Array[]): Request {
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(chunk)
            }
            controller.close()
        },
    })

    return new Request('http://localhost/test', {
        method: 'POST',
        body: stream,
        duplex: 'half',
    } as RequestInit)
}

describe('readBoundedRequestBody', () => {
    it('returns empty text when request has no body', async () => {
        const request = new Request('http://localhost/test', {method: 'DELETE'})
        await expect(readBoundedRequestBody(request, 1024)).resolves.toEqual({
            ok: true,
            text: '',
        })
    })

    it('decodes a body within the limit', async () => {
        const request = requestFromChunks([new TextEncoder().encode('{"a":1}')])
        await expect(readBoundedRequestBody(request, 1024)).resolves.toEqual({
            ok: true,
            text: '{"a":1}',
        })
    })

    it('rejects when accumulated bytes exceed the limit', async () => {
        const request = requestFromChunks([
            new Uint8Array(20),
            new Uint8Array(20),
        ])

        await expect(readBoundedRequestBody(request, 25)).resolves.toEqual({
            ok: false,
            status: 413,
            error: 'Request body is too large.',
        })
    })
})
