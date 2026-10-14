// @vitest-environment node
import {beforeEach, describe, expect, it, vi} from 'vitest'

import {performTenantMediaUpload} from '@/lib/server/mediaUpload'
import {resolvePlatformAuthorization} from '@/lib/server/platform'

import {POST} from './route'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/mediaUpload', () => ({performTenantMediaUpload: vi.fn()}))
vi.mock('@/lib/server/platform', () => ({resolvePlatformAuthorization: vi.fn()}))

describe('POST tenant media upload', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes the route authorization to the upload helper', async () => {
        vi.mocked(resolvePlatformAuthorization).mockResolvedValue({
            ok: true,
            authorization: 'Bearer route-session',
        })
        vi.mocked(performTenantMediaUpload).mockResolvedValue({
            ok: false,
            status: 400,
            body: {error: 'Choose a non-empty file to upload.'},
        })
        const body = new FormData()
        body.set('visibility', 'PUBLIC')
        const response = await POST(
            new Request('http://admin.local/api/tenants/7/media/upload', {method: 'POST', body}),
            {params: Promise.resolve({id: '7'})},
        )

        expect(response.status).toBe(400)
        expect(resolvePlatformAuthorization).toHaveBeenCalledTimes(1)
        expect(performTenantMediaUpload).toHaveBeenCalledWith(
            '7', expect.any(FormData), 'Bearer route-session',
        )
    })

    it('rejects unauthorized requests before reading the body', async () => {
        vi.mocked(resolvePlatformAuthorization).mockResolvedValue({ok: false, status: 401})
        const request = new Request('http://admin.local/api/tenants/7/media/upload', {
            method: 'POST', body: 'invalid multipart body',
        })

        const response = await POST(request, {params: Promise.resolve({id: '7'})})

        expect(response.status).toBe(401)
        expect(request.bodyUsed).toBe(false)
        expect(performTenantMediaUpload).not.toHaveBeenCalled()
    })
})
