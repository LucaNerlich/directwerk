import {beforeEach, describe, expect, it, vi} from 'vitest'

import {
    changeTenantUserRoleAction,
    forceVerifyDomainAction,
    inviteTenantUserAction,
    updateTenantAction,
} from './actions'
import {
    INITIAL_DOMAIN_VERIFY_STATE,
    INITIAL_INVITE_TENANT_USER_STATE,
    INITIAL_ROLE_CHANGE_STATE,
    INITIAL_TENANT_EDIT_STATE,
} from './actionState'

vi.mock('@/lib/server/mediaUpload', () => ({
    performTenantMediaUpload: vi.fn(),
}))

vi.mock('@/lib/server/platform', () => ({
    callPlatformApi: vi.fn(),
    createTenantConflictMessage: vi.fn(),
    statusToFormError: vi.fn(),
}))

import {callPlatformApi} from '@/lib/server/platform'

const callPlatformApiMock = vi.mocked(callPlatformApi)

function formData(entries: Record<string, string>): FormData {
    const data = new FormData()
    for (const [key, value] of Object.entries(entries)) {
        data.set(key, value)
    }
    return data
}

describe('tenant server-action guards', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects updates for a non-numeric tenant id without calling the API', async () => {
        const result = await updateTenantAction(
            '1; DROP TABLE tenants',
            INITIAL_TENANT_EDIT_STATE,
            formData({name: 'Renamed', slug: ''}),
        )

        expect(result.error).toBe('Invalid tenant identifier.')
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })

    it('rejects tenant names over the length limit without calling the API', async () => {
        const result = await updateTenantAction(
            '1',
            INITIAL_TENANT_EDIT_STATE,
            formData({name: 'x'.repeat(256), slug: ''}),
        )

        expect(result.error).toBe('Name must be 255 characters or fewer.')
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })

    it('rejects domain verification for invalid hosts without calling the API', async () => {
        const result = await forceVerifyDomainAction(
            '1',
            INITIAL_DOMAIN_VERIFY_STATE,
            formData({host: '..'}),
        )

        expect(result.error).toBe('Enter a valid domain host.')
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })

    it('normalizes the verified host before calling the API', async () => {
        callPlatformApiMock.mockResolvedValue({
            ok: true,
            data: {host: 'tenant.example.com'},
        })

        const result = await forceVerifyDomainAction(
            '1',
            INITIAL_DOMAIN_VERIFY_STATE,
            formData({host: 'Tenant.Example.COM '}),
        )

        expect(result).toEqual({
            error: null,
            success: 'tenant.example.com force-verified.',
        })
        expect(callPlatformApiMock).toHaveBeenCalledWith(
            ['tenants', '1', 'domains', 'tenant.example.com', 'verify'],
            {method: 'POST', body: {}},
        )
    })

    it('rejects role changes to non-invitable roles without calling the API', async () => {
        const result = await changeTenantUserRoleAction(
            '1',
            7,
            INITIAL_ROLE_CHANGE_STATE,
            formData({role: 'PLATFORM_ADMIN'}),
        )

        expect(result).toEqual({error: 'Choose a valid role.'})
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })

    it('rejects role changes for invalid tenant/user identifiers', async () => {
        const result = await changeTenantUserRoleAction(
            'abc',
            Number.NaN,
            INITIAL_ROLE_CHANGE_STATE,
            formData({role: 'EDITOR'}),
        )

        expect(result).toEqual({error: 'Invalid tenant or user identifier.'})
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })

    it('rejects invites for a non-numeric tenant id without calling the API', async () => {
        const result = await inviteTenantUserAction(
            '../other',
            INITIAL_INVITE_TENANT_USER_STATE,
            formData({email: 'editor@example.com', role: 'EDITOR'}),
        )

        expect(result.error).toBe('Invalid tenant identifier.')
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })
})
