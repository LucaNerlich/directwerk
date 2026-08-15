import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {uploadMediaFile} from '@/lib/media/upload'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: vi.fn().mockResolvedValue('token'),
}))
vi.mock('@/lib/auth/tokenStore', () => ({
    clearTokens: vi.fn(),
}))

interface ProgressEventLike {
    lengthComputable: boolean
    loaded: number
    total: number
}

class MockXMLHttpRequest {
    static instances: MockXMLHttpRequest[] = []

    upload: {onprogress: ((event: ProgressEventLike) => void) | null} = {onprogress: null}
    onload: (() => void) | null = null
    onprogress: (() => void) | null = null
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    onabort: (() => void) | null = null

    readyState = 0
    status = 0
    responseText = ''

    private requestHeaders = new Map<string, string>()
    private responseHeaders = new Map<string, string>()

    constructor() {
        MockXMLHttpRequest.instances.push(this)
    }

    open(): void {}
    setRequestHeader(name: string, value: string): void {
        this.requestHeaders.set(name.toLowerCase(), value)
    }
    getRequestHeader(name: string): string | null {
        return this.requestHeaders.get(name.toLowerCase()) ?? null
    }
    getResponseHeader(name: string): string | null {
        return this.responseHeaders.get(name.toLowerCase()) ?? null
    }
    setResponseHeader(name: string, value: string): void {
        this.responseHeaders.set(name.toLowerCase(), value)
    }
    send(): void {}
}

describe('uploadMediaFile', () => {
    beforeEach(() => {
        MockXMLHttpRequest.instances = []
        vi.stubGlobal('XMLHttpRequest', MockXMLHttpRequest)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reports combined progress across both legs and resolves with the asset', async () => {
        const onProgress = vi.fn()
        const file = new File(['x'.repeat(64)], 'folge.mp3', {type: 'audio/mpeg'})

        const promise = uploadMediaFile('tenant.test', file, {
            assetType: 'AUDIO',
            visibility: 'PRIVATE',
            onProgress,
        })

        await vi.waitFor(() => {
            expect(MockXMLHttpRequest.instances.length).toBe(1)
        })
        const xhr = MockXMLHttpRequest.instances[0]
        expect(xhr.getRequestHeader('authorization')).toBe('Bearer token')
        expect(xhr.getRequestHeader('x-tenant-host')).toBe('tenant.test')

        // Leg 1: browser → BFF upload progress (maps to 0–50 %).
        xhr.upload.onprogress?.({lengthComputable: true, loaded: 50, total: 100})
        expect(onProgress).toHaveBeenLastCalledWith(25)

        xhr.upload.onprogress?.({lengthComputable: false, loaded: 60, total: 100})
        expect(onProgress).toHaveBeenCalledTimes(1)

        xhr.upload.onprogress?.({lengthComputable: true, loaded: 100, total: 100})
        expect(onProgress).toHaveBeenLastCalledWith(50)

        // Leg 2: BFF → S3 progress streamed back as NDJSON (maps to 50–100 %).
        xhr.readyState = 3
        xhr.responseText = '{"type":"progress","percent":50}\n'
        xhr.onprogress?.()
        expect(onProgress).toHaveBeenLastCalledWith(75)

        xhr.responseText += '{"type":"progress","percent":100}\n'
        xhr.onprogress?.()
        expect(onProgress).toHaveBeenLastCalledWith(100)

        // Final result event.
        xhr.readyState = 4
        xhr.setResponseHeader('content-type', 'application/x-ndjson; charset=utf-8')
        xhr.responseText += `${JSON.stringify({
            type: 'result',
            status: 200,
            body: {
                data: {
                    id: 8,
                    status: 'READY',
                    assetType: 'AUDIO',
                    mimeType: 'audio/mpeg',
                    originalFilename: 'folge.mp3',
                    sizeBytes: 64,
                },
            },
        })}\n`
        xhr.onload?.()

        await expect(promise).resolves.toEqual({
            id: 8,
            status: 'READY',
            assetType: 'AUDIO',
            mimeType: 'audio/mpeg',
            originalFilename: 'folge.mp3',
            sizeBytes: 64,
        })
    })

    it('rejects with AUTH_REQUIRED when the stream reports a 401', async () => {
        const file = new File(['x'.repeat(8)], 'folge.mp3', {type: 'audio/mpeg'})

        const promise = uploadMediaFile('tenant.test', file)

        await vi.waitFor(() => {
            expect(MockXMLHttpRequest.instances.length).toBe(1)
        })
        const xhr = MockXMLHttpRequest.instances[0]

        xhr.readyState = 4
        xhr.setResponseHeader('content-type', 'application/x-ndjson; charset=utf-8')
        xhr.responseText = `${JSON.stringify({
            type: 'error',
            status: 401,
            body: {error: 'unauthorized'},
        })}\n`
        xhr.onload?.()

        await expect(promise).rejects.toThrow('AUTH_REQUIRED')
    })
})
