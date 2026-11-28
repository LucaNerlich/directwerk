import {beforeEach, describe, expect, it, vi} from 'vitest'

vi.mock('server-only', () => ({}))

const {directwerkFetch, longRunningDirectwerkFetch} = vi.hoisted(() => ({
    directwerkFetch: vi.fn(),
    longRunningDirectwerkFetch: vi.fn(),
}))
vi.mock('@/lib/server/api', () => ({directwerkFetch, longRunningDirectwerkFetch}))

import {GET} from './route'

function request(): Request {
    return new Request('http://localhost/api/proxy/x', {
        headers: {
            authorization: 'Bearer token',
            'x-tenant-host': 'acme.example.test',
        },
    })
}

async function call(path: string[]): Promise<void> {
    await GET(request(), {params: Promise.resolve({path})})
}

describe('studio proxy client selection', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        directwerkFetch.mockResolvedValue(new Response('{}', {status: 200}))
        longRunningDirectwerkFetch.mockResolvedValue(new Response('{}', {status: 200}))
    })

    it('uses the long-running client for import, verification and media confirm', async () => {
        await call(['podcast', 'import', 'preview'])
        await call(['tenant', 'domains', '7', 'verify'])
        await call(['media', '7', 'confirm'])

        expect(longRunningDirectwerkFetch).toHaveBeenCalledTimes(3)
        expect(directwerkFetch).not.toHaveBeenCalled()
    })

    it('keeps the default deadline for ordinary tenant paths', async () => {
        await call(['episodes'])

        expect(directwerkFetch).toHaveBeenCalledTimes(1)
        expect(longRunningDirectwerkFetch).not.toHaveBeenCalled()
    })
})
