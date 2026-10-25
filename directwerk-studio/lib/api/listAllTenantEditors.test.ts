import {beforeEach, describe, expect, it, vi} from 'vitest'

import type {TenantUser} from '@directwerk/api/types'

const listTenantUsers = vi.fn()

vi.mock('@/lib/api/tenantSettingsApi', () => ({
    listTenantUsers: (...args: unknown[]) => listTenantUsers(...args),
}))

import {listAllTenantEditors} from '@/lib/api/listAllTenantEditors'

function user(
    overrides: Partial<TenantUser> & Pick<TenantUser, 'userId' | 'roles'>,
): TenantUser {
    return {
        email: `user-${overrides.userId}@example.com`,
        name: `User ${overrides.userId}`,
        status: 'ACTIVE',
        invitedAt: null,
        lastLoginAt: null,
        ...overrides,
    }
}

describe('listAllTenantEditors (#561 review)', () => {
    beforeEach(() => {
        listTenantUsers.mockReset()
    })

    it('walks pages so editors past the first 100 memberships are included', async () => {
        const firstPage = Array.from({length: 100}, (_, index) =>
            user({
                userId: index + 1,
                roles: index === 0 ? ['TENANT_ADMIN'] : ['SUBSCRIBER'],
            }),
        )
        const secondPage = [
            user({userId: 101, roles: ['EDITOR']}),
            user({userId: 102, roles: ['EDITOR'], status: 'DISABLED'}),
        ]
        listTenantUsers
            .mockResolvedValueOnce({
                content: firstPage,
                totalElements: 102,
                page: 0,
                size: 100,
            })
            .mockResolvedValueOnce({
                content: secondPage,
                totalElements: 102,
                page: 1,
                size: 100,
            })

        await expect(listAllTenantEditors()).resolves.toEqual([
            expect.objectContaining({userId: 101, roles: ['EDITOR']}),
        ])
        expect(listTenantUsers).toHaveBeenCalledTimes(2)
        expect(listTenantUsers).toHaveBeenNthCalledWith(1, {page: 0, size: 100})
        expect(listTenantUsers).toHaveBeenNthCalledWith(2, {page: 1, size: 100})
    })
})
