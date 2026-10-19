import {afterEach, describe, expect, it, vi} from 'vitest'

import {getPlatformTenantsPage} from './client'

vi.mock('../auth/session', () => ({
    clearSessionTokens: vi.fn(),
    getValidAccessToken: vi.fn().mockResolvedValue('test-token'),
    refreshAccessToken: vi.fn(),
}))

afterEach(() => vi.unstubAllGlobals())

function respondWith(body: unknown): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

describe('getPlatformTenantsPage search', () => {
    it('sends the search term to the server so it spans the whole estate', async () => {
        const fetchMock = respondWith({data: {content: []}, metadata: {totalElements: 0}})

        await getPlatformTenantsPage(0, 25, ' alpha show ')

        const url = String(fetchMock.mock.calls[0]?.[0])
        expect(url).toContain('q=alpha%20show')
        expect(url).toContain('page=0')
        expect(url).toContain('size=25')
    })

    it('omits the q parameter when the search is blank', async () => {
        const fetchMock = respondWith({data: {content: []}, metadata: {totalElements: 0}})

        await getPlatformTenantsPage(0, 25, '   ')

        expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('q=')
    })
})
