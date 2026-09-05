import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {
    changeTenantUserRoleAction,
    createTenantAction,
    forceVerifyDomainAction,
    inviteTenantUserAction,
    updateTenantAction,
    updateUploadLimitsAction,
} from './actions'
import {
    INITIAL_CREATE_TENANT_STATE,
    INITIAL_DOMAIN_VERIFY_STATE,
    INITIAL_INVITE_TENANT_USER_STATE,
    INITIAL_ROLE_CHANGE_STATE,
    INITIAL_TENANT_EDIT_STATE,
    INITIAL_UPLOAD_LIMITS_STATE,
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

afterEach(() => {
    vi.unstubAllEnvs()
})

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

    it('does not return tenant-creation invite tokens in production', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        callPlatformApiMock.mockResolvedValue({
            ok: true,
            data: {
                id: 7,
                name: 'Alpha',
                slug: 'alpha',
                adminInvitation: {
                    email: 'admin@example.com',
                    status: 'INVITED',
                    inviteToken: 'secret-create-token',
                },
            },
        })

        const result = await createTenantAction(
            INITIAL_CREATE_TENANT_STATE,
            formData({
                name: 'Alpha',
                slug: 'alpha',
                primaryDomain: '',
                modulePreset: '',
                adminEmail: 'admin@example.com',
                adminName: 'Admin',
            }),
        )

        expect(result.inviteToken).toBeNull()
    })

    it('does not return tenant-user invite tokens in production', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        callPlatformApiMock.mockResolvedValue({
            ok: true,
            data: {email: 'editor@example.com', inviteToken: 'secret-user-token'},
        })

        const result = await inviteTenantUserAction(
            '7',
            INITIAL_INVITE_TENANT_USER_STATE,
            formData({email: 'editor@example.com', name: 'Editor', role: 'EDITOR'}),
        )

        expect(result.inviteToken).toBeNull()
    })

    it('sends upload limits in bytes and empties as defaults', async () => {
        callPlatformApiMock.mockResolvedValue({
            ok: true,
            data: {
                maxAudioBytes: 104857600,
                maxImageBytes: null,
                maxVideoBytes: null,
                maxDocumentBytes: 52428800,
            },
        })

        const result = await updateUploadLimitsAction(
            '7',
            INITIAL_UPLOAD_LIMITS_STATE,
            formData({maxAudioBytes: '100', maxImageBytes: '', maxVideoBytes: '', maxDocumentBytes: '50'}),
        )

        expect(callPlatformApiMock).toHaveBeenCalledWith(
            ['tenants', '7', 'upload-limits'],
            {
                method: 'PUT',
                body: {
                    maxAudioBytes: 104857600,
                    maxImageBytes: null,
                    maxVideoBytes: null,
                    maxDocumentBytes: 52428800,
                },
            },
        )
        expect(result).toEqual({
            error: null,
            success: 'Upload limits updated.',
            limits: {
                maxAudioBytes: 104857600,
                maxImageBytes: null,
                maxVideoBytes: null,
                maxDocumentBytes: 52428800,
            },
        })
    })

    it('preserves a sub-megabyte upload limit with byte precision', async () => {
        callPlatformApiMock.mockResolvedValue({
            ok: true,
            data: {
                maxAudioBytes: 1,
                maxImageBytes: null,
                maxVideoBytes: null,
                maxDocumentBytes: null,
            },
        })

        await updateUploadLimitsAction(
            '7',
            INITIAL_UPLOAD_LIMITS_STATE,
            formData({
                maxAudioBytes: String(1 / (1024 * 1024)),
                maxImageBytes: '',
                maxVideoBytes: '',
                maxDocumentBytes: '',
            }),
        )

        expect(callPlatformApiMock).toHaveBeenCalledWith(
            ['tenants', '7', 'upload-limits'],
            {
                method: 'PUT',
                body: {
                    maxAudioBytes: 1,
                    maxImageBytes: null,
                    maxVideoBytes: null,
                    maxDocumentBytes: null,
                },
            },
        )
    })

    it('rejects out-of-range upload limits without calling the API', async () => {
        const result = await updateUploadLimitsAction(
            '7',
            INITIAL_UPLOAD_LIMITS_STATE,
            formData({maxAudioBytes: '0', maxImageBytes: '', maxVideoBytes: '', maxDocumentBytes: ''}),
        )

        expect(result.error).toContain('1 byte–5120 MB')
        expect(callPlatformApiMock).not.toHaveBeenCalled()
    })
})
