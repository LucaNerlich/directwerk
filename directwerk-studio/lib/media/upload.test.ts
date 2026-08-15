import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {uploadMediaFile} from '@/lib/media/upload'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: vi.fn().mockResolvedValue('token'),
}))
vi.mock('@/lib/auth/tokenStore', () => ({
    clearTokens: vi.fn(),
}))
vi.mock('@/lib/media/limits', () => {
    const limits = {
        AUDIO: {maxBytes: 100, label: '100 B'},
        IMAGE: {maxBytes: 100, label: '100 B'},
        VIDEO: {maxBytes: 100, label: '100 B'},
        DOCUMENT: {maxBytes: 100, label: '100 B'},
    } as const
    type LimitType = keyof typeof limits
    return {
        MEDIA_TYPE_LIMITS: limits,
        mediaLimitLabel: (type: LimitType) => limits[type].label,
        exceedsMediaLimit: (type: LimitType, size: number) => size > limits[type].maxBytes,
    }
})

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

    it('sets metadata headers, reports progress, and resolves with the asset', async () => {
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
        expect(xhr.getRequestHeader('x-filename')).toBe(encodeURIComponent('folge.mp3'))
        expect(xhr.getRequestHeader('content-type')).toBe('audio/mpeg')
        expect(xhr.getRequestHeader('x-visibility')).toBe('PRIVATE')
        expect(xhr.getRequestHeader('x-asset-type')).toBe('AUDIO')
        expect(xhr.getRequestHeader('x-episode-id')).toBeNull()

        xhr.upload.onprogress?.({lengthComputable: true, loaded: 50, total: 100})
        expect(onProgress).toHaveBeenLastCalledWith(50)

        xhr.upload.onprogress?.({lengthComputable: false, loaded: 60, total: 100})
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

    it('rejects files over the per-type limit before creating a request', async () => {
        const file = new File(['x'.repeat(200)], 'big.mp3', {type: 'audio/mpeg'})

        await expect(
            uploadMediaFile('tenant.test', file, {assetType: 'AUDIO'}),
        ).rejects.toThrow('Datei zu groß')

        expect(MockXMLHttpRequest.instances.length).toBe(0)
    })

    it('rejects with AUTH_REQUIRED when the server responds 401', async () => {
        const file = new File(['x'.repeat(8)], 'folge.mp3', {type: 'audio/mpeg'})

        const promise = uploadMediaFile('tenant.test', file)

        await vi.waitFor(() => {
            expect(MockXMLHttpRequest.instances.length).toBe(1)
        })
        const xhr = MockXMLHttpRequest.instances[0]

        xhr.status = 401
        xhr.setResponseHeader('content-type', 'application/json')
        xhr.responseText = JSON.stringify({error: 'unauthorized'})
        xhr.onload?.()

        await expect(promise).rejects.toThrow('AUTH_REQUIRED')
    })
})
