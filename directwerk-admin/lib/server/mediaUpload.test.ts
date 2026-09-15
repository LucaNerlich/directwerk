import {beforeEach, describe, expect, it, vi} from 'vitest'

import {performMediaUpload} from '@directwerk/api/media/serverUpload'
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
    })
})
