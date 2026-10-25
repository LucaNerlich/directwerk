import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {TenantUser} from '@directwerk/api/types'

const getPlatformData = vi.fn()

vi.mock('@/lib/api/client', () => ({
    getPlatformData: (...args: unknown[]) => getPlatformData(...args),
}))

import {listAllPlatformTenantUsers} from '@/lib/api/listAllPlatformTenantUsers'

function user(userId: number): TenantUser {
    return {
        userId,
        email: `user-${userId}@example.com`,
        name: `User ${userId}`,
        roles: ['EDITOR'],
        status: 'ACTIVE',
        invitedAt: null,
        lastLoginAt: null,
    }
}

describe('listAllPlatformTenantUsers (#561 review)', () => {
    beforeEach(() => {
        getPlatformData.mockReset()
    })

    it('walks pages beyond the first 100 members', async () => {
        const first = Array.from({length: 100}, (_, index) => user(index + 1))
        const second = [user(101)]
        getPlatformData
            .mockResolvedValueOnce({
                content: first,
                totalElements: 101,
                page: 0,
                size: 100,
            })
            .mockResolvedValueOnce({
                content: second,
                totalElements: 101,
                page: 1,
                size: 100,
            })

        const result = await listAllPlatformTenantUsers('9')
        expect(result.totalElements).toBe(101)
        expect(result.content).toHaveLength(101)
        expect(result.content[100]?.userId).toBe(101)
        expect(getPlatformData).toHaveBeenNthCalledWith(
            1,
            'tenants/9/users?page=0&size=100',
        )
        expect(getPlatformData).toHaveBeenNthCalledWith(
            2,
            'tenants/9/users?page=1&size=100',
        )
    })
})
