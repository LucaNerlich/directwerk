import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))

const createConfiguredPlatformApiRequest = vi.fn()
vi.mock('@/lib/server/api', () => ({
    createConfiguredPlatformApiRequest: (...args: unknown[]) =>
        createConfiguredPlatformApiRequest(...args),
}))

import {GET} from './route'

describe('platform proxy route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        createConfiguredPlatformApiRequest.mockReturnValue({
            url: 'https://api.example.test/api/v1/tenants',
            init: {headers: {}},
        })
    })

    it('bounds the upstream fetch with an abort signal', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {status: 200}))
        vi.stubGlobal('fetch', fetchMock)
        const request = new Request('http://localhost/api/proxy/tenants', {
            headers: {authorization: 'Bearer platform-token'},
        })

        await GET(request, {params: Promise.resolve({path: ['tenants']})})

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    })
})
