import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('../src/media/storagePut', () => ({
    putStreamToStorage: vi.fn(),
}))

import {putStreamToStorage} from '../src/media/storagePut'
import {
    buildConfirmRetryBody,
    isMediaUploadRetryResponse,
} from '../src/media/uploadProtocol'
import {
    INVALID_UPLOAD_URL_MESSAGE,
    performMediaUpload,
    readUploadEnvelope,
    type MediaUploadTransport,
    type PerformMediaUploadOptions,
} from '../src/media/serverUpload'

const putMock = vi.mocked(putStreamToStorage)

function bodyStream(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]))
            controller.close()
        },
    })
}

function uploadUrlResponse(uploadUrl: string, assetId = 7): Response {
    return Response.json({
        data: {assetId, uploadUrl, headers: null, expiresAt: null},
    })
}

function options(
    transport: MediaUploadTransport,
    extra: Partial<PerformMediaUploadOptions> = {},
): PerformMediaUploadOptions {
    return {
        body: bodyStream(),
        sizeBytes: 3,
        mimeType: 'image/png',
        uploadUrlBody: {filename: 'cover.png'},
        transport,
        storageTimeouts: {idleTimeoutMs: 1_000, absoluteTimeoutMs: 2_000},
        ...extra,
    }
}

const CONFIRM_OK = (): Promise<Response> =>
    Promise.resolve(Response.json({data: {id: 7}}))

beforeEach(() => {
    vi.clearAllMocks()
})

describe('readUploadEnvelope', () => {
    it('unwraps a {data} envelope and rejects other shapes', () => {
        expect(readUploadEnvelope({data: {assetId: 1}})).toEqual({assetId: 1})
        expect(readUploadEnvelope({error: 'x'})).toBeNull()
        expect(readUploadEnvelope(null)).toBeNull()
        expect(readUploadEnvelope('nope')).toBeNull()
    })
})

describe('confirm-retry contract', () => {
    it('builds the recovery body and recognises it', () => {
        const body = buildConfirmRetryBody({error: 'boom'}, 42)
        expect(body).toEqual({error: 'boom', assetId: 42, retryConfirm: true})
        expect(isMediaUploadRetryResponse(body)).toBe(true)
        expect(isMediaUploadRetryResponse({assetId: 42})).toBe(false)
        expect(isMediaUploadRetryResponse({retryConfirm: true})).toBe(false)
    })
})

describe('performMediaUpload', () => {
    it('runs upload-url → PUT → confirm and returns the confirm response', async () => {
        putMock.mockResolvedValue({status: 200})
        const confirmResponse = Response.json({data: {id: 7}})
        const transport: MediaUploadTransport = {
            createUploadUrl: () =>
                Promise.resolve(uploadUrlResponse('https://s3.example.test/key')),
            confirmUpload: () => Promise.resolve(confirmResponse),
        }

        const result = await performMediaUpload(options(transport))

        expect(result).toEqual({status: 'confirmed', response: confirmResponse})
        expect(putMock).toHaveBeenCalledOnce()
    })

    it('forwards a failed upload-url response untouched', async () => {
        const upstream = Response.json({error: 'nope'}, {status: 409})
        const result = await performMediaUpload(
            options({
                createUploadUrl: () => Promise.resolve(upstream),
                confirmUpload: CONFIRM_OK,
            }),
        )

        expect(result).toEqual({status: 'upload-url-failed', response: upstream})
        expect(putMock).not.toHaveBeenCalled()
    })

    it('rejects a loopback-http target when the caller is HTTPS-only', async () => {
        putMock.mockResolvedValue({status: 200})
        const result = await performMediaUpload(
            options({
                createUploadUrl: () =>
                    Promise.resolve(uploadUrlResponse('http://127.0.0.1:9000/key')),
                confirmUpload: CONFIRM_OK,
            }),
        )

        expect(result).toEqual({
            status: 'invalid-upload-url',
            message: INVALID_UPLOAD_URL_MESSAGE,
        })
        expect(putMock).not.toHaveBeenCalled()
    })

    it('accepts a loopback-http target only when explicitly enabled', async () => {
        putMock.mockResolvedValue({status: 200})
        const result = await performMediaUpload(
            options(
                {
                    createUploadUrl: () =>
                        Promise.resolve(
                            uploadUrlResponse('http://127.0.0.1:9000/key'),
                        ),
                    confirmUpload: CONFIRM_OK,
                },
                {allowLoopbackUploadTarget: true},
            ),
        )

        expect(result.status).toBe('confirmed')
        expect(putMock).toHaveBeenCalledOnce()
    })

    it('maps a non-2xx storage PUT to storage-rejected', async () => {
        putMock.mockResolvedValue({status: 500})
        const result = await performMediaUpload(
            options({
                createUploadUrl: () =>
                    Promise.resolve(uploadUrlResponse('https://s3.example.test/key')),
                confirmUpload: CONFIRM_OK,
            }),
        )

        expect(result).toEqual({
            status: 'storage-rejected',
            message: 'Object storage rejected the upload (HTTP 500).',
        })
    })

    it('keeps the asset id when confirm fails so the caller can retry', async () => {
        putMock.mockResolvedValue({status: 200})
        const failure = Response.json({error: 'conflict'}, {status: 409})
        const result = await performMediaUpload(
            options({
                createUploadUrl: () =>
                    Promise.resolve(uploadUrlResponse('https://s3.example.test/key')),
                confirmUpload: () => Promise.resolve(failure),
            }),
        )

        expect(result).toEqual({
            status: 'confirm-failed',
            response: failure,
            assetId: 7,
        })
    })

    it('classifies timeout and unavailable failures', async () => {
        const transport: MediaUploadTransport = {
            createUploadUrl: () =>
                Promise.resolve(uploadUrlResponse('https://s3.example.test/key')),
            confirmUpload: CONFIRM_OK,
        }

        const timeout = new Error('stalled')
        timeout.name = 'TimeoutError'
        putMock.mockRejectedValueOnce(timeout)
        expect((await performMediaUpload(options(transport))).status).toBe('timeout')

        putMock.mockRejectedValueOnce(new Error('boom'))
        expect((await performMediaUpload(options(transport))).status).toBe(
            'unavailable',
        )
    })
})
