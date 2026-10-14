import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {performMediaUpload} from '@directwerk/api/media/serverUpload'
import {createConfiguredPlatformApiRequest} from '@/lib/server/api'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

import {performTenantMediaUpload} from './mediaUpload'

vi.mock('server-only', () => ({}))

vi.mock('@directwerk/api/media/serverUpload', () => ({
    buildConfirmRetryBody: vi.fn(),
    performMediaUpload: vi.fn(),
}))

vi.mock('@/lib/server/api', () => ({
    createConfiguredPlatformApiRequest: vi.fn(),
}))

vi.mock('@/lib/server/platform', () => ({
    resolvePlatformAuthorization: vi.fn(),
}))

describe('performTenantMediaUpload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(resolvePlatformAuthorization).mockResolvedValue({
            ok: true,
            authorization: 'Bearer test',
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('reuses supplied authorization for upload-url and confirm without refreshing', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null)))
        vi.mocked(createConfiguredPlatformApiRequest).mockReturnValue({
            url: 'https://api.example.test',
            init: {method: 'POST'},
        })
        vi.mocked(performMediaUpload).mockImplementation(async ({transport, uploadUrlBody}) => {
            await transport.createUploadUrl(uploadUrlBody)
            await transport.confirmUpload(7)
            return {status: 'confirmed', response: Response.json({data: null})}
        })
        const file = new File(['image'], 'cover.png', {type: 'image/png'})
        Object.defineProperty(file, 'stream', {value: () => new ReadableStream()})
        const formData = new FormData()
        formData.set('file', file)

        await performTenantMediaUpload('7', formData, 'Bearer route-session')

        expect(resolvePlatformAuthorization).not.toHaveBeenCalled()
        expect(createConfiguredPlatformApiRequest).toHaveBeenCalledTimes(2)
        expect(createConfiguredPlatformApiRequest).toHaveBeenNthCalledWith(
            1,
            ['tenants', '7', 'media', 'upload-url'],
            expect.any(Request),
            'Bearer route-session',
        )
        expect(createConfiguredPlatformApiRequest).toHaveBeenNthCalledWith(
            2,
            ['tenants', '7', 'media', '7', 'confirm'],
            expect.any(Request),
            'Bearer route-session',
        )
    })

    it('returns the invalid-envelope response when confirmed JSON is malformed', async () => {
        vi.mocked(performMediaUpload).mockResolvedValue({
            status: 'confirmed',
            response: new Response('{malformed'),
        })
        const file = new File(['image'], 'cover.png', {type: 'image/png'})
        Object.defineProperty(file, 'stream', {
            value: () => new ReadableStream(),
        })
        const formData = new FormData()
        formData.set('file', file)

        await expect(performTenantMediaUpload('7', formData)).resolves.toEqual({
            ok: false,
            status: 502,
            body: {error: 'Invalid confirm response from Directwerk.'},
        })
        expect(resolvePlatformAuthorization).toHaveBeenCalledTimes(1)
    })
})
