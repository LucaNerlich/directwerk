import {afterEach, describe, expect, it, vi} from 'vitest'

import {getMembersEffectiveRights, getPlatformAuditPage} from './client'

vi.mock('../auth/session', () => ({
    clearSessionTokens: vi.fn(),
    getValidAccessToken: vi.fn().mockResolvedValue('test-token'),
    refreshAccessToken: vi.fn(),
}))

afterEach(() => vi.unstubAllGlobals())

const auditEvent = {id: 7, action: 'TENANT_CREATED', createdAt: '2026-10-14T00:00:00Z'}

function respondWith(body: unknown): void {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
}

describe('getPlatformAuditPage', () => {
    it('preserves valid audit entries and pagination metadata', async () => {
        respondWith({data: [auditEvent], metadata: {totalElements: 51, page: 1, size: 50}})

        await expect(getPlatformAuditPage({page: 1})).resolves.toEqual({
            content: [auditEvent], totalElements: 51, page: 1, size: 50,
        })
    })

    it.each([
        [auditEvent, {id: 8}],
        [{id: 8}, auditEvent],
        [null],
    ])('rejects a page containing an invalid event: %j', async (...data) => {
        respondWith({data})

        await expect(getPlatformAuditPage({})).rejects.toThrow('Ungültige Audit-Antwort des Servers.')
    })

    it('accepts a valid empty page', async () => {
        respondWith({data: []})

        await expect(getPlatformAuditPage({size: 20})).resolves.toEqual({
            content: [], totalElements: 0, page: 0, size: 20,
        })
    })
})

describe('getMembersEffectiveRights', () => {
    it('batches at the API limit and merges both pages', async () => {
        const calls: string[] = []
        vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
            const url = String(input)
            calls.push(url)
            const ids = new URL(url, 'http://admin.test').searchParams.get('userIds')?.split(',') ?? []
            return Response.json({
                statusCode: 200,
                statusMessage: 'OK',
                data: ids.map((id) => ({userId: Number(id), roles: ['EDITOR'], restrictions: [], effective: {}})),
                errors: [],
                metadata: {},
            })
        }))

        const rights = await getMembersEffectiveRights(
            '7',
            Array.from({length: 201}, (_, i) => i + 1),
        )

        expect(calls).toHaveLength(2)
        expect(new URL(calls[0], 'http://admin.test').searchParams.get('userIds')?.split(',')).toHaveLength(200)
        expect(new URL(calls[1], 'http://admin.test').searchParams.get('userIds')?.split(',')).toHaveLength(1)
        expect(rights).toHaveLength(201)
    })
})
