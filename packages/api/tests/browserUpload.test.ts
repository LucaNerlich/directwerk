import {afterEach, describe, expect, it, vi} from 'vitest'

import {uploadMediaFileBrowser, type BrowserMediaUploadConfig} from '../src/media/browserUpload'
import type {MediaAsset} from '../src/types'

class FakeXhr {
    status = 500
    responseText = ''
    onload: (() => void) | null = null
    upload = {onprogress: null as null | ((event: ProgressEvent) => void)}
    open = vi.fn()
    setRequestHeader = vi.fn()
    send = vi.fn(() => {
        queueMicrotask(() => this.onload?.())
    })
    getResponseHeader = (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null)
}

function config(overrides: Partial<BrowserMediaUploadConfig> = {}): BrowserMediaUploadConfig {
    return {
        tenantHost: 'acme.test',
        file: new File(['x'], 'cover.png', {type: 'image/png'}),
        getAccessToken: async () => 'token',
        onAuthRequired: vi.fn(),
        confirmUpload: vi.fn(),
        ...overrides,
    }
}

const asset = {id: 7} as MediaAsset

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('uploadMediaFileBrowser', () => {
    it('retries the confirm from a non-401 retry body without a second XHR', async () => {
        const xhr = new FakeXhr()
        xhr.responseText = JSON.stringify({error: 'boom', assetId: 7, retryConfirm: true})
        vi.stubGlobal('XMLHttpRequest', class {
            constructor() {
                return xhr
            }
        })
        const confirmUpload = vi.fn().mockResolvedValue(asset)

        await expect(uploadMediaFileBrowser(config({confirmUpload}))).resolves.toBe(asset)

        expect(confirmUpload).toHaveBeenCalledWith(7)
        expect(xhr.send).toHaveBeenCalledTimes(1)
    })
})
