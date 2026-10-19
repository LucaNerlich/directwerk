import {afterEach, describe, expect, it, vi} from 'vitest'

import {API_CONTRACT_ERROR, AUTH_REQUIRED, CONFLICT, REQUEST_FAILED} from '@directwerk/api/constants'
import {postTenantData} from '@/lib/api/tenantClient'

const tenantFetch = vi.fn()

vi.mock('@directwerk/api/client/authedRequest', () => ({
    createAuthedRequest: () => (...args: unknown[]) => tenantFetch(...args),
}))
vi.mock('@/lib/auth/tenantTokenStore', () => ({
    getTenantSessionHost: () => 'tenant.example.test',
}))
vi.mock('@/lib/auth/tenantSession', () => ({
    clearTenantSessionTokens: vi.fn(),
    getValidTenantAccessToken: vi.fn(),
    refreshTenantAccessToken: vi.fn(),
}))

afterEach(() => {
    tenantFetch.mockReset()
})

describe('tenantRequest error classification', () => {
    it('passes a transport CONFLICT through instead of flattening it', async () => {
        tenantFetch.mockRejectedValue(new Error(CONFLICT))

        await expect(postTenantData('/products', {slug: 'taken'})).rejects.toThrow(CONFLICT)
    })

    it('passes REQUEST_FAILED and AUTH_REQUIRED through', async () => {
        tenantFetch.mockRejectedValueOnce(new Error(REQUEST_FAILED))
        await expect(postTenantData('/products', {})).rejects.toThrow(REQUEST_FAILED)

        tenantFetch.mockRejectedValueOnce(new Error(AUTH_REQUIRED))
        await expect(postTenantData('/products', {})).rejects.toThrow(AUTH_REQUIRED)
    })

    it('still reports a malformed envelope as API_CONTRACT_ERROR', async () => {
        tenantFetch.mockResolvedValue({unexpected: true})

        await expect(postTenantData('/products', {})).rejects.toThrow(API_CONTRACT_ERROR)
    })

    it('returns the unwrapped data for a valid envelope', async () => {
        tenantFetch.mockResolvedValue({data: {id: 1}})

        await expect(postTenantData<{id: number}>('/products', {})).resolves.toEqual({id: 1})
    })
})
