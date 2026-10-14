import {afterEach, describe, expect, it, vi} from 'vitest'

import {getPlatformAuditPage} from './client'

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
