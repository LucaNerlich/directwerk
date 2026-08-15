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
    onerror: (() => void) | null = null
    ontimeout: (() => void) | null = null
    onabort: (() => void) | null = null

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

    it('reports progress and resolves with the parsed media asset', async () => {
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
        expect(xhr).toBeDefined()
        expect(xhr.getRequestHeader('authorization')).toBe('Bearer token')
        expect(xhr.getRequestHeader('x-tenant-host')).toBe('tenant.test')

        xhr.upload.onprogress?.({lengthComputable: true, loaded: 25, total: 100})
        expect(onProgress).toHaveBeenLastCalledWith(25)

        xhr.upload.onprogress?.({lengthComputable: false, loaded: 50, total: 100})
        expect(onProgress).toHaveBeenCalledTimes(1)

        xhr.upload.onprogress?.({lengthComputable: true, loaded: 100, total: 100})
        expect(onProgress).toHaveBeenLastCalledWith(100)

        xhr.status = 200
        xhr.setResponseHeader('content-type', 'application/json')
        xhr.responseText = JSON.stringify({
            data: {
                id: 8,
                status: 'READY',
                assetType: 'AUDIO',
                mimeType: 'audio/mpeg',
                originalFilename: 'folge.mp3',
                sizeBytes: 64,
            },
        })
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
})
