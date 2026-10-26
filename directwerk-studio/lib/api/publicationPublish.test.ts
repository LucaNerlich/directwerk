import {afterEach, describe, expect, it, vi} from 'vitest'

import {createPublicationWorkflowApi} from '@/lib/api/studioApiCore'

vi.mock('@/lib/auth/session', () => ({
    getValidAccessToken: () => Promise.resolve('test-token'),
    refreshAccessToken: () => Promise.resolve('test-token'),
    clearSessionTokens: () => {},
}))

vi.mock('@directwerk/api/tenant', () => ({
    getClientTenantHost: () => 'tenant.test',
}))

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {'Content-Type': 'application/json'},
    })
}

const envelope = (data: unknown): unknown => ({
    statusCode: 200,
    statusMessage: 'OK',
    data,
    errors: [],
    metadata: {},
})

function publishBody(fetchMock: ReturnType<typeof vi.fn>): unknown {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return JSON.parse(init.body as string)
}

describe('publication workflow publish', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const api = () =>
        createPublicationWorkflowApi<{id: number}, object, object>({
            basePath: '/articles',
            parseEnvelope: (value) => envelope(value) as never,
            parseListEnvelope: (value) => envelope(value) as never,
            messages: {list: 'list failed', detail: 'detail failed'},
        })

    it('forwards a backdated publishedAt', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({id: 1})))
        vi.stubGlobal('fetch', fetchMock)

        await api().publish(1, {publishedAt: '2024-05-01T10:00:00Z'})

        expect(publishBody(fetchMock)).toEqual({
            notifySubscribers: false,
            publishedAt: '2024-05-01T10:00:00Z',
        })
    })

    it('omits publishedAt when no date is chosen', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({id: 1})))
        vi.stubGlobal('fetch', fetchMock)

        await api().publish(1)

        expect(publishBody(fetchMock)).toEqual({notifySubscribers: false})
    })

    it('forwards notifySubscribers true for EMAIL_NOTIFY publish', async () => {
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, envelope({id: 1})))
        vi.stubGlobal('fetch', fetchMock)

        await api().publish(1, {notifySubscribers: true})

        expect(publishBody(fetchMock)).toEqual({notifySubscribers: true})
    })
})
